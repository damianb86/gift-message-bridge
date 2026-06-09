import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import styles from "../styles/block-setup.module.css";

const PRODUCT_VISIBILITY_SCOPE = "write_products";
const VISIBILITY_METAFIELD_NAMESPACE = "custom";
const VISIBILITY_METAFIELD_KEY = "show_gift_message";
const VISIBILITY_METAFIELD_REFERENCE = `${VISIBILITY_METAFIELD_NAMESPACE}.${VISIBILITY_METAFIELD_KEY}`;
const VISIBILITY_OWNER_TYPES = ["PRODUCT", "COLLECTION"] as const;
const METAFIELDS_SET_CHUNK_SIZE = 25;

type VisibilityOwnerType = (typeof VISIBILITY_OWNER_TYPES)[number];
type VisibilityResourceType = "product" | "collection";

const VISIBILITY_RESOURCE_LABELS: Record<
  VisibilityResourceType,
  {
    buttonLabel: string;
    description: string;
    gidPrefix: string;
    ownerType: VisibilityOwnerType;
    pluralLabel: string;
    singularLabel: string;
    title: string;
  }
> = {
  product: {
    buttonLabel: "Select products",
    description:
      "Choose specific product pages where the Gift Message block should be visible.",
    gidPrefix: "gid://shopify/Product/",
    ownerType: "PRODUCT",
    pluralLabel: "products",
    singularLabel: "product",
    title: "Products",
  },
  collection: {
    buttonLabel: "Select collections",
    description:
      "Choose collections. Products in those collections can show the Gift Message block.",
    gidPrefix: "gid://shopify/Collection/",
    ownerType: "COLLECTION",
    pluralLabel: "collections",
    singularLabel: "collection",
    title: "Collections",
  },
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, scopes, session } = await authenticate.admin(request);
  const editorBase = `https://${session.shop}/admin/themes/current/editor`;
  const scopeDetails = await scopes.query();
  const hasProductWriteScope = scopeDetails.granted.includes(
    PRODUCT_VISIBILITY_SCOPE,
  );
  const canRequestProductWriteScope = scopeDetails.optional.includes(
    PRODUCT_VISIBILITY_SCOPE,
  );
  const visibilityMetafieldDefinitions = hasProductWriteScope
    ? await getVisibilityMetafieldDefinitions(admin)
    : { product: null, collection: null };

  return {
    canRequestProductWriteScope,
    collectionsUrl: `https://${session.shop}/admin/collections`,
    customDataUrl: `https://${session.shop}/admin/settings/custom_data`,
    editorProductUrl: `${editorBase}?template=product`,
    editorCartUrl: `${editorBase}?template=cart`,
    hasProductWriteScope,
    productsUrl: `https://${session.shop}/admin/products`,
    visibilityMetafieldDefinitions,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, scopes } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (
    intent !== "create-product-visibility-metafield" &&
    intent !== "create-visibility-metafields" &&
    intent !== "set-visibility-metafields"
  ) {
    return {
      ok: false,
      intent,
      message: "Unknown action.",
    };
  }

  const scopeDetails = await scopes.query();
  if (!scopeDetails.granted.includes(PRODUCT_VISIBILITY_SCOPE)) {
    return {
      ok: false,
      intent,
      needsScope: true,
      message:
        "Gift Pulse needs product write permission before it can update product and collection visibility metafields.",
    };
  }

  if (intent === "set-visibility-metafields") {
    const resourceType = String(formData.get("resourceType") ?? "");
    const resourceIds = parseVisibilityResourceIds(
      String(formData.get("resourceIds") ?? ""),
    );

    if (!isVisibilityResourceType(resourceType)) {
      return {
        ok: false,
        intent,
        message: "Choose whether you are updating products or collections.",
      };
    }

    const resourceLabels = VISIBILITY_RESOURCE_LABELS[resourceType];
    const invalidResourceId = resourceIds.find(
      (resourceId) => !resourceId.startsWith(resourceLabels.gidPrefix),
    );

    if (resourceIds.length === 0) {
      return {
        ok: false,
        intent,
        resourceType,
        message: `Select at least one ${resourceLabels.singularLabel}.`,
      };
    }

    if (invalidResourceId) {
      return {
        ok: false,
        intent,
        resourceType,
        message: `One selected item was not a valid ${resourceLabels.singularLabel}.`,
      };
    }

    try {
      await ensureVisibilityMetafieldDefinition(
        admin,
        resourceLabels.ownerType,
      );
      const updatedCount = await setVisibilityMetafields(admin, resourceIds);

      return {
        ok: true,
        intent,
        resourceType,
        updatedCount,
        message: `${updatedCount} ${updatedCount === 1 ? resourceLabels.singularLabel : resourceLabels.pluralLabel} updated successfully.`,
      };
    } catch (error) {
      console.error("[block-setup:set-visibility-metafields]", error);
      return {
        ok: false,
        intent,
        resourceType,
        message:
          error instanceof Error
            ? error.message
            : `Selected ${resourceLabels.pluralLabel} could not be updated.`,
      };
    }
  }

  try {
    const visibilityDefinitions =
      await ensureVisibilityMetafieldDefinitions(admin);

    return {
      ok: true,
      intent: "create-visibility-metafields",
      definitions: visibilityDefinitions,
      message: "Product and collection visibility metafields are ready to use.",
    };
  } catch (error) {
    console.error("[block-setup:create-visibility-metafields]", error);
    return {
      ok: false,
      intent,
      message:
        error instanceof Error
          ? error.message
          : "Visibility metafields could not be created.",
    };
  }
};

export default function GiftMessageSetup() {
  const {
    canRequestProductWriteScope,
    collectionsUrl,
    customDataUrl,
    editorCartUrl,
    editorProductUrl,
    hasProductWriteScope,
    productsUrl,
    visibilityMetafieldDefinitions,
  } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const metafieldFetcher = useFetcher<typeof action>();
  const visibilityApplyFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [hasGrantedProductScope, setHasGrantedProductScope] =
    useState(hasProductWriteScope);
  const [definitionsReady, setDefinitionsReady] = useState({
    collection: Boolean(visibilityMetafieldDefinitions.collection),
    product: Boolean(visibilityMetafieldDefinitions.product),
  });
  const [lastAppliedSelection, setLastAppliedSelection] = useState<{
    count: number;
    resourceType: VisibilityResourceType;
    titles: string[];
  } | null>(null);
  const pendingVisibilitySelectionRef = useRef<{
    count: number;
    resourceType: VisibilityResourceType;
    titles: string[];
  } | null>(null);
  const isCreatingMetafield = metafieldFetcher.state !== "idle";
  const isApplyingVisibility = visibilityApplyFetcher.state !== "idle";
  const allDefinitionsReady =
    definitionsReady.product && definitionsReady.collection;

  useEffect(() => {
    setHasGrantedProductScope(hasProductWriteScope);
    setDefinitionsReady({
      collection: Boolean(visibilityMetafieldDefinitions.collection),
      product: Boolean(visibilityMetafieldDefinitions.product),
    });
  }, [hasProductWriteScope, visibilityMetafieldDefinitions]);

  useEffect(() => {
    if (metafieldFetcher.state !== "idle" || !metafieldFetcher.data) return;

    const data = metafieldFetcher.data;
    if (data.ok) {
      if (
        data.intent === "create-visibility-metafields" &&
        "definitions" in data &&
        data.definitions
      ) {
        const { definitions } = data;
        setDefinitionsReady({
          collection: Boolean(definitions.collection),
          product: Boolean(definitions.product),
        });
      }

      shopify.toast.show(data.message);
      revalidator.revalidate();
      return;
    }

    shopify.toast.show(data.message, { isError: true });
  }, [
    metafieldFetcher.data,
    metafieldFetcher.state,
    revalidator,
    shopify.toast,
  ]);

  useEffect(() => {
    if (
      visibilityApplyFetcher.state !== "idle" ||
      !visibilityApplyFetcher.data
    ) {
      return;
    }

    const data = visibilityApplyFetcher.data;
    if (data.ok) {
      const pendingVisibilitySelection = pendingVisibilitySelectionRef.current;
      if (
        data.intent === "set-visibility-metafields" &&
        pendingVisibilitySelection
      ) {
        setLastAppliedSelection({
          ...pendingVisibilitySelection,
          count:
            "updatedCount" in data && typeof data.updatedCount === "number"
              ? data.updatedCount
              : pendingVisibilitySelection.count,
        });
        pendingVisibilitySelectionRef.current = null;
      }

      shopify.toast.show(data.message);
      return;
    }

    pendingVisibilitySelectionRef.current = null;
    shopify.toast.show(data.message, { isError: true });
  }, [
    shopify.toast,
    visibilityApplyFetcher.data,
    visibilityApplyFetcher.state,
  ]);

  const requestProductPermission = async () => {
    if (hasGrantedProductScope) return true;

    if (!canRequestProductWriteScope) {
      shopify.toast.show(
        "The optional product permission is not available yet. Deploy the updated app configuration first.",
        { isError: true },
      );
      return false;
    }

    try {
      const scopeResult = await shopify.scopes.request([
        PRODUCT_VISIBILITY_SCOPE,
      ]);

      if (
        scopeResult.result !== "granted-all" ||
        !scopeResult.detail.granted.includes(PRODUCT_VISIBILITY_SCOPE)
      ) {
        shopify.toast.show(
          "Product permission was not granted, so the metafields were not updated.",
          { isError: true },
        );
        return false;
      }

      setHasGrantedProductScope(true);
      return true;
    } catch (error) {
      console.error("[block-setup:scope-request]", error);
      shopify.toast.show("Product permission could not be requested.", {
        isError: true,
      });
      return false;
    }
  };

  const createMetafieldWithApp = async () => {
    const hasPermission = await requestProductPermission();
    if (!hasPermission) return;

    metafieldFetcher.submit(
      { intent: "create-visibility-metafields" },
      { method: "post" },
    );
  };

  const openVisibilityPicker = async (resourceType: VisibilityResourceType) => {
    if (!hasGrantedProductScope || !allDefinitionsReady) {
      shopify.toast.show(
        "Create the product and collection visibility metafields before selecting resources.",
        { isError: true },
      );
      return;
    }

    try {
      const selection = await shopify.resourcePicker({
        action: "select",
        filter: resourceType === "product" ? { variants: false } : undefined,
        multiple: true,
        type: resourceType,
      });
      const selectedResources = normalizePickerSelection(selection);

      if (selectedResources.length === 0) return;

      pendingVisibilitySelectionRef.current = {
        count: selectedResources.length,
        resourceType,
        titles: selectedResources
          .slice(0, 3)
          .map((resource) => resource.title ?? resource.id),
      };
      visibilityApplyFetcher.submit(
        {
          intent: "set-visibility-metafields",
          resourceIds: JSON.stringify(
            selectedResources.map((resource) => resource.id),
          ),
          resourceType,
        },
        { method: "post" },
      );
    } catch (error) {
      console.error("[block-setup:resource-picker]", error);
      shopify.toast.show("The Shopify resource picker could not be opened.", {
        isError: true,
      });
    }
  };

  return (
    <s-page heading="Block Setup" inlineSize="large">
      <s-section>
        <div className={styles.setupShowcase}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.blockBadgeRow}>
                <span className={styles.blockIcon}>
                  <BlockIcon />
                </span>
                <span className={styles.blockBadge}>Theme app block</span>
              </div>

              <div>
                <h1 className={styles.blockTitle}>Gift Message block</h1>
                <p className={styles.blockText}>
                  Add a gift message form to your storefront, collect meaningful
                  notes from your customers, keep them attached to the order,
                  and print beautiful messages for packing.
                </p>
              </div>

              <div className={styles.featureRow}>
                <FeatureItem
                  icon="bolt"
                  title="Set up in minutes"
                  description="No coding required"
                />
                <FeatureItem
                  icon="layout"
                  title="Flexible placement"
                  description="Works on product and cart pages"
                />
                <FeatureItem
                  icon="shield"
                  title="Reliable & secure"
                  description="Data stays with your orders"
                />
              </div>
            </div>

            <div className={styles.heroMedia} aria-hidden="true">
              <img src="/block-setup-gift-hero.png" alt="" loading="eager" />
            </div>

            <div className={styles.editorPanel}>
              <div className={styles.editorPanelHeader}>
                <span className={styles.editorHeaderIcon}>
                  <SparkleIcon />
                </span>
                <div>
                  <h2>Open theme editor</h2>
                  <p>
                    Use the same block in either storefront context. Choose the
                    place you want to edit.
                  </p>
                </div>
              </div>

              <div className={styles.editorChoices}>
                <EditorDestination
                  active
                  description="Collect the note before add to cart"
                  href={editorProductUrl}
                  icon={<ProductPageIcon />}
                  preview="product"
                  title="Product page"
                />
                <EditorDestination
                  description="Let shoppers add or edit the note later"
                  href={editorCartUrl}
                  icon={<CartPageIcon />}
                  preview="cart"
                  title="Cart page"
                />
              </div>
            </div>
          </div>

          <div className={styles.workflowPanel}>
            <div className={styles.workflowHeader}>
              <h2>How it works</h2>
              <span>
                <SparkleIcon />
                From note to heartfelt delivery
              </span>
            </div>

            <div className={styles.flowBand}>
              <FlowStep
                icon="write"
                number="1"
                title="Customer writes a message"
                description="They add who it's from, who it's for, and the message."
              />
              <FlowConnector />
              <FlowStep
                icon="data"
                number="2"
                title="App stores the data"
                description="We save the sender, recipient, message, and product with the order."
              />
              <FlowConnector />
              <FlowStep
                icon="print"
                number="3"
                title="Merchant prints messages"
                description="Choose messages and print beautiful gift cards."
              />
              <FlowConnector />
              <FlowStep
                icon="gift"
                number="4"
                title="Gift card goes with the order"
                description="The printed message is packed with the product."
              />
            </div>
          </div>

          <div className={styles.trustStrip}>
            <TrustBadge icon="shield" label="Keeps notes attached to orders" />
            <TrustBadge icon="lock" label="Private & secure" />
            <TrustBadge icon="tag" label="Works with any theme" />
            <TrustBadge icon="star" label="Loved by merchants" />
          </div>
        </div>
      </s-section>

      <s-section>
        <div
          className={styles.metafieldGuide}
          id="product-metafield-visibility"
        >
          <div className={styles.metafieldGuideHeader}>
            <div>
              <span className={styles.actionLabel}>
                Optional visibility rule
              </span>
              <h2 className={styles.metafieldGuideTitle}>
                Show the block only on selected products or collections
              </h2>
              <p className={styles.metafieldGuideText}>
                Use one boolean metafield on products and collections to decide
                which product pages show the Gift Message block. Gift Pulse can
                create the definitions and update selected resources for you.
              </p>
            </div>
            <div className={styles.metafieldName}>
              <span>Recommended metafield for both</span>
              <code>{VISIBILITY_METAFIELD_REFERENCE}</code>
            </div>
          </div>

          <div className={styles.metafieldAutomation}>
            <div>
              <h3>Create it with Gift Pulse</h3>
              <p>
                This asks for optional product permission only when you use this
                setup tool. After approval, Gift Pulse creates the boolean
                metafield definitions for products and collections.
              </p>
              <div className={styles.metafieldStatusRow}>
                <span
                  className={
                    hasGrantedProductScope
                      ? styles.metafieldStatusReady
                      : styles.metafieldStatusPending
                  }
                >
                  {hasGrantedProductScope
                    ? "Product permission granted"
                    : "Product permission not granted"}
                </span>
                <span
                  className={
                    definitionsReady.product
                      ? styles.metafieldStatusReady
                      : styles.metafieldStatusPending
                  }
                >
                  {definitionsReady.product
                    ? "Product definition ready"
                    : "Product definition not created"}
                </span>
                <span
                  className={
                    definitionsReady.collection
                      ? styles.metafieldStatusReady
                      : styles.metafieldStatusPending
                  }
                >
                  {definitionsReady.collection
                    ? "Collection definition ready"
                    : "Collection definition not created"}
                </span>
              </div>
            </div>
            <button
              className={styles.metafieldButton}
              type="button"
              onClick={createMetafieldWithApp}
              disabled={isCreatingMetafield || allDefinitionsReady}
            >
              {allDefinitionsReady
                ? "Metafields ready"
                : isCreatingMetafield
                  ? "Creating..."
                  : "Create with app"}
            </button>
          </div>

          <div className={styles.visibilityManager}>
            <div className={styles.visibilityManagerHeader}>
              <span className={styles.visibilityManagerIcon}>
                <VisibilityRuleIcon />
              </span>
              <div>
                <h3>Set visibility to true</h3>
                <p>
                  Open the native Shopify selector, choose the products or
                  collections where the block should appear, and Gift Pulse will
                  set <code>{VISIBILITY_METAFIELD_REFERENCE}</code> to true.
                </p>
              </div>
            </div>

            <div className={styles.visibilityTargets}>
              <VisibilityTargetCard
                disabled={
                  !hasGrantedProductScope ||
                  !allDefinitionsReady ||
                  isApplyingVisibility
                }
                isBusy={isApplyingVisibility}
                onClick={() => openVisibilityPicker("product")}
                resourceType="product"
              />
              <VisibilityTargetCard
                disabled={
                  !hasGrantedProductScope ||
                  !allDefinitionsReady ||
                  isApplyingVisibility
                }
                isBusy={isApplyingVisibility}
                onClick={() => openVisibilityPicker("collection")}
                resourceType="collection"
              />
            </div>

            {!allDefinitionsReady ? (
              <p className={styles.visibilityManagerHint}>
                Create the metafield definitions above before selecting products
                or collections.
              </p>
            ) : null}

            {lastAppliedSelection ? (
              <div className={styles.visibilityLastUpdate}>
                <span className={styles.visibilityLastUpdateIcon}>
                  <CheckIcon />
                </span>
                <span>
                  Last applied to {lastAppliedSelection.count}{" "}
                  {lastAppliedSelection.count === 1
                    ? VISIBILITY_RESOURCE_LABELS[
                        lastAppliedSelection.resourceType
                      ].singularLabel
                    : VISIBILITY_RESOURCE_LABELS[
                        lastAppliedSelection.resourceType
                      ].pluralLabel}
                  {lastAppliedSelection.titles.length > 0
                    ? `: ${lastAppliedSelection.titles.join(", ")}`
                    : ""}
                  {lastAppliedSelection.count >
                  lastAppliedSelection.titles.length
                    ? "..."
                    : ""}
                </span>
              </div>
            ) : null}
          </div>

          <div className={styles.metafieldSteps}>
            <GuideStep
              number="1"
              title="Create definitions"
              description="Gift Pulse can create Product and Collection definitions automatically, or you can add them manually in Settings > Custom data."
            />
            <GuideStep
              number="2"
              title="Use a boolean value"
              description="Use custom.show_gift_message on both resource types and choose the True or false metafield type."
            />
            <GuideStep
              number="3"
              title="Enable selected resources"
              description="Use the selectors above to set the metafield to true on products or collections where the block should appear."
            />
            <GuideStep
              number="4"
              title="Connect the block"
              description="In the theme editor, enable the visibility setting and keep custom.show_gift_message, or enter matching boolean metafields."
            />
          </div>

          <div className={styles.metafieldActions}>
            <a
              className={styles.metafieldAction}
              href={customDataUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open custom data
            </a>
            <a
              className={styles.metafieldActionSecondary}
              href={productsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open products
            </a>
            <a
              className={styles.metafieldActionSecondary}
              href={collectionsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open collections
            </a>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type VisibilityMetafieldDefinition = {
  id: string;
  key: string;
  name: string;
  namespace: string;
  type?: {
    name: string;
  };
};

type VisibilityMetafieldDefinitions = Record<
  VisibilityResourceType,
  VisibilityMetafieldDefinition | null
>;

type PickerResource = {
  id: string;
  title?: string;
};

function isVisibilityResourceType(
  resourceType: string,
): resourceType is VisibilityResourceType {
  return resourceType === "product" || resourceType === "collection";
}

function normalizePickerSelection(selection: unknown): PickerResource[] {
  if (!selection) return [];

  const resources = Array.isArray(selection)
    ? selection
    : Array.isArray((selection as { selection?: unknown }).selection)
      ? (selection as { selection: unknown[] }).selection
      : [];

  return resources.flatMap((resource): PickerResource[] => {
    if (
      typeof resource !== "object" ||
      resource === null ||
      typeof (resource as { id?: unknown }).id !== "string"
    ) {
      return [];
    }

    return [
      {
        id: (resource as { id: string }).id,
        title:
          typeof (resource as { title?: unknown }).title === "string"
            ? (resource as { title: string }).title
            : undefined,
      },
    ];
  });
}

function parseVisibilityResourceIds(value: string): string[] {
  try {
    const parsedValue = JSON.parse(value);
    if (!Array.isArray(parsedValue)) return [];

    return Array.from(
      new Set(
        parsedValue.filter(
          (resourceId): resourceId is string =>
            typeof resourceId === "string" && resourceId.trim() !== "",
        ),
      ),
    );
  } catch {
    return [];
  }
}

async function getVisibilityMetafieldDefinitions(
  admin: AdminClient,
): Promise<VisibilityMetafieldDefinitions> {
  const [product, collection] = await Promise.all([
    getVisibilityMetafieldDefinition(admin, "PRODUCT"),
    getVisibilityMetafieldDefinition(admin, "COLLECTION"),
  ]);

  return { collection, product };
}

async function ensureVisibilityMetafieldDefinitions(
  admin: AdminClient,
): Promise<Record<VisibilityResourceType, VisibilityMetafieldDefinition>> {
  const product = await ensureVisibilityMetafieldDefinition(admin, "PRODUCT");
  const collection = await ensureVisibilityMetafieldDefinition(
    admin,
    "COLLECTION",
  );

  return { collection, product };
}

async function ensureVisibilityMetafieldDefinition(
  admin: AdminClient,
  ownerType: VisibilityOwnerType,
): Promise<VisibilityMetafieldDefinition> {
  const existingDefinition = await getVisibilityMetafieldDefinition(
    admin,
    ownerType,
  );
  if (existingDefinition) return existingDefinition;

  return createVisibilityMetafieldDefinition(admin, ownerType);
}

async function getVisibilityMetafieldDefinition(
  admin: AdminClient,
  ownerType: VisibilityOwnerType,
): Promise<VisibilityMetafieldDefinition | null> {
  const response = await admin.graphql(
    `#graphql
    query ProductVisibilityMetafieldDefinition(
      $namespace: String!
      $key: String!
      $ownerType: MetafieldOwnerType!
    ) {
      metafieldDefinitions(
        first: 1
        ownerType: $ownerType
        namespace: $namespace
        key: $key
      ) {
        nodes {
          id
          key
          name
          namespace
          type {
            name
          }
        }
      }
    }`,
    {
      variables: {
        namespace: VISIBILITY_METAFIELD_NAMESPACE,
        key: VISIBILITY_METAFIELD_KEY,
        ownerType,
      },
    },
  );
  const json = await response.json();
  const errors = json.errors as { message?: string }[] | undefined;
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join("; "));
  }

  return json.data.metafieldDefinitions.nodes[0] ?? null;
}

async function createVisibilityMetafieldDefinition(
  admin: AdminClient,
  ownerType: VisibilityOwnerType,
): Promise<VisibilityMetafieldDefinition> {
  const ownerLabel = ownerType === "COLLECTION" ? "collections" : "products";
  const response = await admin.graphql(
    `#graphql
    mutation CreateProductVisibilityMetafieldDefinition(
      $definition: MetafieldDefinitionInput!
    ) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          key
          name
          namespace
          type {
            name
          }
        }
        userErrors {
          field
          message
          code
        }
      }
    }`,
    {
      variables: {
        definition: {
          name: "Show gift message block",
          namespace: VISIBILITY_METAFIELD_NAMESPACE,
          key: VISIBILITY_METAFIELD_KEY,
          description: `Set to true on ${ownerLabel} where the Gift Message storefront block should be shown.`,
          type: "boolean",
          ownerType,
        },
      },
    },
  );
  const json = await response.json();
  const errors = json.errors as { message?: string }[] | undefined;
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join("; "));
  }

  const result = json.data.metafieldDefinitionCreate;
  if (result.userErrors.length > 0) {
    throw new Error(
      result.userErrors
        .map((error: { message: string }) => error.message)
        .join("; "),
    );
  }

  return result.createdDefinition;
}

async function setVisibilityMetafields(
  admin: AdminClient,
  resourceIds: string[],
): Promise<number> {
  let updatedCount = 0;

  for (
    let index = 0;
    index < resourceIds.length;
    index += METAFIELDS_SET_CHUNK_SIZE
  ) {
    const chunk = resourceIds.slice(index, index + METAFIELDS_SET_CHUNK_SIZE);
    const response = await admin.graphql(
      `#graphql
      mutation SetVisibilityMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            namespace
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      {
        variables: {
          metafields: chunk.map((resourceId) => ({
            key: VISIBILITY_METAFIELD_KEY,
            namespace: VISIBILITY_METAFIELD_NAMESPACE,
            ownerId: resourceId,
            type: "boolean",
            value: "true",
          })),
        },
      },
    );
    const json = await response.json();
    const errors = json.errors as { message?: string }[] | undefined;
    if (errors?.length) {
      throw new Error(errors.map((error) => error.message).join("; "));
    }

    const result = json.data.metafieldsSet;
    if (result.userErrors.length > 0) {
      throw new Error(
        result.userErrors
          .map((error: { message: string }) => error.message)
          .join("; "),
      );
    }

    updatedCount += result.metafields.length;
  }

  return updatedCount;
}

function GuideStep({
  description,
  number,
  title,
}: {
  description: string;
  number: string;
  title: string;
}) {
  return (
    <div className={styles.metafieldStep}>
      <span className={styles.metafieldStepNumber}>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function FeatureItem({
  description,
  icon,
  title,
}: {
  description: string;
  icon: "bolt" | "layout" | "shield";
  title: string;
}) {
  return (
    <div className={styles.featureItem}>
      <span className={styles.featureIcon}>
        <FeatureIcon type={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </div>
  );
}

function EditorDestination({
  active = false,
  description,
  href,
  icon,
  preview,
  title,
}: {
  active?: boolean;
  description: string;
  href: string;
  icon: ReactNode;
  preview: "cart" | "product";
  title: string;
}) {
  return (
    <a
      className={`${styles.editorChoice} ${
        active ? styles.editorChoiceActive : ""
      }`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span className={styles.editorChoiceStatus}>
        {active ? <CheckIcon /> : null}
      </span>
      <span className={styles.editorChoiceIcon}>{icon}</span>
      <span className={styles.editorChoiceCopy}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <SetupPreview type={preview} />
    </a>
  );
}

function SetupPreview({ type }: { type: "cart" | "product" }) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.setupPreview} ${
        type === "cart" ? styles.setupPreviewCart : ""
      }`}
    >
      <span className={styles.previewImage} />
      <span className={styles.previewLines}>
        <span />
        <span />
        <span />
      </span>
      <span className={styles.previewInput} />
      <span className={styles.previewGift}>
        <GiftMiniIcon />
      </span>
    </span>
  );
}

function TrustBadge({
  icon,
  label,
}: {
  icon: "lock" | "shield" | "star" | "tag";
  label: string;
}) {
  return (
    <span className={styles.trustBadge}>
      <span className={styles.trustIcon}>
        <TrustIcon type={icon} />
      </span>
      {label}
    </span>
  );
}

function VisibilityTargetCard({
  disabled,
  isBusy,
  onClick,
  resourceType,
}: {
  disabled: boolean;
  isBusy: boolean;
  onClick: () => void;
  resourceType: VisibilityResourceType;
}) {
  const labels = VISIBILITY_RESOURCE_LABELS[resourceType];

  return (
    <div className={styles.visibilityTargetCard}>
      <span className={styles.visibilityTargetIcon}>
        {resourceType === "product" ? <ProductPageIcon /> : <CollectionIcon />}
      </span>
      <div>
        <h4>{labels.title}</h4>
        <p>{labels.description}</p>
      </div>
      <button
        className={styles.visibilityTargetButton}
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        {isBusy ? "Applying..." : labels.buttonLabel}
      </button>
    </div>
  );
}

function BlockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <path d="m15 16 1.5-1.5L18 16l-1.5 1.5Z" />
    </svg>
  );
}

function VisibilityRuleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8" />
      <path d="M8 13h4" />
      <path d="m15 14 2 2 4-5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Z" />
      <path d="M19 4v3" />
      <path d="M20.5 5.5h-3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 12 4 4 8-9" />
    </svg>
  );
}

function GiftMiniIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 7v14" />
      <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5V7Z" />
      <path d="M12 7h3.5A2.5 2.5 0 1 0 13 4.5V7Z" />
    </svg>
  );
}

function FeatureIcon({ type }: { type: "bolt" | "layout" | "shield" }) {
  if (type === "layout") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 5h16v11H4z" />
        <path d="M8 20h8" />
        <path d="M12 16v4" />
        <path d="M15 9h4v4h-4z" />
      </svg>
    );
  }

  if (type === "shield") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3 19 6v5c0 4.5-2.8 7.7-7 10-4.2-2.3-7-5.5-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z" />
    </svg>
  );
}

function TrustIcon({ type }: { type: "lock" | "shield" | "star" | "tag" }) {
  if (type === "lock") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
        <path d="M5 11h14v10H5z" />
      </svg>
    );
  }

  if (type === "tag") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20 13 13 20 4 11V4h7l9 9Z" />
        <path d="M8 8h.01" />
      </svg>
    );
  }

  if (type === "star") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3 19 6v5c0 4.5-2.8 7.7-7 10-4.2-2.3-7-5.5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}

function ProductPageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6" />
      <path d="M9 12h4" />
      <path d="M15 16h3" />
    </svg>
  );
}

function CollectionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 6h14v14H5z" />
      <path d="M8 3h8" />
      <path d="M9 10h6" />
      <path d="M9 14h4" />
    </svg>
  );
}

function CartPageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 6h2l2 10h8l2-7H8" />
      <path d="M10 20h.01" />
      <path d="M17 20h.01" />
      <path d="M11 12h4" />
    </svg>
  );
}

function FlowStep({
  description,
  icon,
  number,
  title,
}: {
  description: string;
  icon: "write" | "data" | "print" | "gift";
  number: string;
  title: string;
}) {
  return (
    <div className={styles.flowStep}>
      <div className={styles.flowIconWrap}>
        <span className={styles.flowNumber}>{number}</span>
        <span className={styles.flowIcon}>
          <FlowIcon type={icon} />
        </span>
      </div>
      <div className={styles.flowStepCopy}>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function FlowConnector() {
  return <div className={styles.flowConnector} />;
}

function FlowIcon({ type }: { type: "write" | "data" | "print" | "gift" }) {
  if (type === "data") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    );
  }

  if (type === "print") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 8V3h10v5" />
        <path d="M7 17H5a2 2 0 0 1-2-2v-5h18v5a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v7H7z" />
      </svg>
    );
  }

  if (type === "gift") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20 12v9H4v-9" />
        <path d="M2 7h20v5H2z" />
        <path d="M12 7v14" />
        <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5V7Z" />
        <path d="M12 7h3.5A2.5 2.5 0 1 0 13 4.5V7Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 20h16" />
      <path d="M5 16.5V19h2.5L18 8.5 15.5 6 5 16.5Z" />
      <path d="m14 7 2.5 2.5" />
    </svg>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
