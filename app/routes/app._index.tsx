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
import db from "../db.server";
import {
  parseCardProductConfig,
  serializeCardProductConfig,
  type CardProductConfig,
  type CardProductVariantOption,
} from "../lib/card-products";
import styles from "../styles/block-setup.module.css";

const PRODUCT_VISIBILITY_SCOPE = "write_products";
const PRODUCT_SETUP_SCOPE = PRODUCT_VISIBILITY_SCOPE;
const THEME_SETUP_SCOPE = "read_themes";
const VISIBILITY_METAFIELD_NAMESPACE = "custom";
const VISIBILITY_METAFIELD_KEY = "show_gift_message";
const VISIBILITY_METAFIELD_REFERENCE = `${VISIBILITY_METAFIELD_NAMESPACE}.${VISIBILITY_METAFIELD_KEY}`;
const VISIBILITY_OWNER_TYPES = ["PRODUCT", "COLLECTION"] as const;
const METAFIELDS_SET_CHUNK_SIZE = 25;
const VISIBILITY_METAFIELDS_PAGE_SIZE = 250;
const CARD_PRODUCT_VARIANTS_PAGE_SIZE = 100;
const SHOPIFY_APP_API_KEY =
  process.env.SHOPIFY_API_KEY || "5648b993ebb2c0c32aebf341a158f812";
const GIFT_MESSAGE_BLOCK_HANDLE = "gift-message";
const DRAWER_APP_EMBED_HANDLE = "gift-message-drawer";

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
  const hasThemeReadScope = scopeDetails.granted.includes(THEME_SETUP_SCOPE);
  const canRequestThemeReadScope =
    scopeDetails.optional.includes(THEME_SETUP_SCOPE);
  const themeSetupStatus = hasThemeReadScope
    ? await getThemeSetupStatus(admin).catch((error) => {
        console.error("[block-setup:theme-status]", error);
        return createUnavailableThemeSetupStatus(
          "Gift Pulse could not read the current theme setup.",
        );
      })
    : createUnavailableThemeSetupStatus(
        "Grant theme read permission to check the current theme setup.",
      );
  const visibilityMetafieldDefinitions = hasProductWriteScope
    ? await getVisibilityMetafieldDefinitions(admin)
    : { product: null, collection: null };
  const visibilityResourceSelections = hasProductWriteScope
    ? await getVisibilityResourceSelections(admin)
    : { product: [], collection: [] };
  const cardProductSettings = await db.cardProductSettings.findUnique({
    where: { shop: session.shop },
  });

  return {
    cardProduct: parseCardProductConfig(cardProductSettings?.productsJson),
    canRequestProductWriteScope,
    canRequestThemeReadScope,
    collectionsUrl: `https://${session.shop}/admin/collections`,
    customDataUrl: `https://${session.shop}/admin/settings/custom_data`,
    editorProductUrl: `${editorBase}?template=product`,
    editorCartUrl: `${editorBase}?template=cart`,
    editorDrawerUrl: `${editorBase}?context=apps&template=index&activateAppId=${SHOPIFY_APP_API_KEY}/${DRAWER_APP_EMBED_HANDLE}`,
    hasProductWriteScope,
    hasThemeReadScope,
    productsUrl: `https://${session.shop}/admin/products`,
    themeSetupStatus,
    visibilityMetafieldDefinitions,
    visibilityResourceSelections,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, scopes, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (
    intent !== "create-product-visibility-metafield" &&
    intent !== "create-visibility-metafields" &&
    intent !== "set-card-products" &&
    intent !== "set-visibility-metafields"
  ) {
    return {
      ok: false,
      intent,
      message: "Unknown action.",
    };
  }

  const scopeDetails = await scopes.query();

  if (intent === "set-card-products") {
    const productId = String(formData.get("productId") ?? "").trim();

    if (productId && !productId.startsWith("gid://shopify/Product/")) {
      return {
        ok: false,
        intent,
        message: "One selected item was not a valid product.",
      };
    }

    if (!productId) {
      await db.cardProductSettings.upsert({
        where: { shop: session.shop },
        create: {
          shop: session.shop,
          productsJson: serializeCardProductConfig(null),
        },
        update: {
          productsJson: serializeCardProductConfig(null),
        },
      });

      return {
        ok: true,
        intent,
        cardProduct: null,
        message: "No message card product selected.",
      };
    }

    if (!scopeDetails.granted.includes(PRODUCT_SETUP_SCOPE)) {
      return {
        ok: false,
        intent,
        needsScope: true,
        message:
          "Gift Pulse needs product permission before it can update message card products.",
      };
    }

    try {
      const cardProduct = await getCardProductFromId(admin, productId);

      await db.cardProductSettings.upsert({
        where: { shop: session.shop },
        create: {
          shop: session.shop,
          productsJson: serializeCardProductConfig(cardProduct),
        },
        update: {
          productsJson: serializeCardProductConfig(cardProduct),
        },
      });

      return {
        ok: true,
        intent,
        cardProduct,
        message: `${cardProduct.title} saved with ${cardProduct.variants.length} ${cardProduct.variants.length === 1 ? "variant" : "variants"}.`,
      };
    } catch (error) {
      console.error("[block-setup:set-card-products]", error);
      return {
        ok: false,
        intent,
        message:
          error instanceof Error
            ? error.message
            : "Message card products could not be saved.",
      };
    }
  }

  if (!scopeDetails.granted.includes(PRODUCT_SETUP_SCOPE)) {
    return {
      ok: false,
      intent,
      needsScope: true,
      message:
        "Gift Pulse needs product permission before it can update product-based block setup.",
    };
  }

  if (intent === "set-visibility-metafields") {
    const resourceType = String(formData.get("resourceType") ?? "");
    const selectedResourceIds = parseVisibilityResourceIds(
      String(formData.get("resourceIds") ?? ""),
    );
    const previousResourceIds = parseVisibilityResourceIds(
      String(formData.get("previousResourceIds") ?? ""),
    );

    if (!isVisibilityResourceType(resourceType)) {
      return {
        ok: false,
        intent,
        message: "Choose whether you are updating products or collections.",
      };
    }

    const resourceLabels = VISIBILITY_RESOURCE_LABELS[resourceType];
    const resourceIds = Array.from(
      new Set([...selectedResourceIds, ...previousResourceIds]),
    );
    const invalidResourceId = resourceIds.find(
      (resourceId) => !resourceId.startsWith(resourceLabels.gidPrefix),
    );

    if (resourceIds.length === 0) {
      return {
        ok: true,
        intent,
        resourceType,
        selectedCount: 0,
        unselectedCount: 0,
        updatedCount: 0,
        message: `No ${resourceLabels.pluralLabel} selected.`,
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
      const selectedResourceIdSet = new Set(selectedResourceIds);
      const unselectedResourceIds = previousResourceIds.filter(
        (resourceId) => !selectedResourceIdSet.has(resourceId),
      );
      const selectedCount =
        selectedResourceIds.length > 0
          ? await setVisibilityMetafields(admin, selectedResourceIds, "true")
          : 0;
      const unselectedCount =
        unselectedResourceIds.length > 0
          ? await setVisibilityMetafields(admin, unselectedResourceIds, "false")
          : 0;
      const updatedCount = selectedCount + unselectedCount;

      return {
        ok: true,
        intent,
        resourceType,
        selectedCount,
        unselectedCount,
        updatedCount,
        message:
          updatedCount === 0
            ? `No ${resourceLabels.pluralLabel} changed.`
            : `${selectedCount} ${selectedCount === 1 ? resourceLabels.singularLabel : resourceLabels.pluralLabel} set to visible and ${unselectedCount} set to hidden.`,
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
    cardProduct: initialCardProduct,
    canRequestProductWriteScope,
    canRequestThemeReadScope,
    collectionsUrl,
    customDataUrl,
    editorCartUrl,
    editorDrawerUrl,
    editorProductUrl,
    hasProductWriteScope,
    hasThemeReadScope,
    productsUrl,
    themeSetupStatus,
    visibilityMetafieldDefinitions,
    visibilityResourceSelections,
  } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const cardProductsFetcher = useFetcher<typeof action>();
  const metafieldFetcher = useFetcher<typeof action>();
  const visibilityApplyFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [hasGrantedProductScope, setHasGrantedProductScope] =
    useState(hasProductWriteScope);
  const [hasGrantedThemeScope, setHasGrantedThemeScope] =
    useState(hasThemeReadScope);
  const [isRequestingThemeScope, setIsRequestingThemeScope] = useState(false);
  const [definitionsReady, setDefinitionsReady] = useState({
    collection: Boolean(visibilityMetafieldDefinitions.collection),
    product: Boolean(visibilityMetafieldDefinitions.product),
  });
  const [visibleResources, setVisibleResources] =
    useState<VisibilityResourceSelections>(visibilityResourceSelections);
  const [cardProduct, setCardProduct] = useState<CardProductConfig | null>(
    initialCardProduct,
  );
  const [lastAppliedSelection, setLastAppliedSelection] = useState<{
    resourceType: VisibilityResourceType;
    selectedCount: number;
    titles: string[];
    unselectedCount: number;
  } | null>(null);
  const pendingVisibilitySelectionRef = useRef<{
    resourceType: VisibilityResourceType;
    selectedResources: VisibilityResourceSelection[];
    unselectedCount: number;
  } | null>(null);
  const handledMetafieldResponseRef = useRef<unknown>(null);
  const handledCardProductsResponseRef = useRef<unknown>(null);
  const handledVisibilityApplyResponseRef = useRef<unknown>(null);
  const isCreatingMetafield = metafieldFetcher.state !== "idle";
  const isApplyingVisibility = visibilityApplyFetcher.state !== "idle";
  const isSavingCardProducts = cardProductsFetcher.state !== "idle";
  const allDefinitionsReady =
    definitionsReady.product && definitionsReady.collection;

  useEffect(() => {
    setHasGrantedProductScope(hasProductWriteScope);
    setHasGrantedThemeScope(hasThemeReadScope);
    setDefinitionsReady({
      collection: Boolean(visibilityMetafieldDefinitions.collection),
      product: Boolean(visibilityMetafieldDefinitions.product),
    });
    setVisibleResources(visibilityResourceSelections);
    setCardProduct(initialCardProduct);
  }, [
    hasThemeReadScope,
    hasProductWriteScope,
    initialCardProduct,
    visibilityMetafieldDefinitions,
    visibilityResourceSelections,
  ]);

  useEffect(() => {
    if (metafieldFetcher.state !== "idle" || !metafieldFetcher.data) return;
    if (handledMetafieldResponseRef.current === metafieldFetcher.data) return;

    const data = metafieldFetcher.data;
    handledMetafieldResponseRef.current = data;
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
  }, [metafieldFetcher.data, metafieldFetcher.state, revalidator, shopify]);

  useEffect(() => {
    if (cardProductsFetcher.state !== "idle" || !cardProductsFetcher.data) {
      return;
    }
    if (handledCardProductsResponseRef.current === cardProductsFetcher.data) {
      return;
    }

    const data = cardProductsFetcher.data;
    handledCardProductsResponseRef.current = data;
    if (data.ok) {
      if (data.intent === "set-card-products" && "cardProduct" in data) {
        setCardProduct((data.cardProduct ?? null) as CardProductConfig | null);
      }

      shopify.toast.show(data.message);
      revalidator.revalidate();
      return;
    }

    shopify.toast.show(data.message, { isError: true });
  }, [
    cardProductsFetcher.data,
    cardProductsFetcher.state,
    revalidator,
    shopify,
  ]);

  useEffect(() => {
    if (
      visibilityApplyFetcher.state !== "idle" ||
      !visibilityApplyFetcher.data
    ) {
      return;
    }
    if (
      handledVisibilityApplyResponseRef.current === visibilityApplyFetcher.data
    ) {
      return;
    }

    const data = visibilityApplyFetcher.data;
    handledVisibilityApplyResponseRef.current = data;
    if (data.ok) {
      const pendingVisibilitySelection = pendingVisibilitySelectionRef.current;
      if (
        data.intent === "set-visibility-metafields" &&
        pendingVisibilitySelection
      ) {
        const selectedCount =
          "selectedCount" in data && typeof data.selectedCount === "number"
            ? data.selectedCount
            : pendingVisibilitySelection.selectedResources.length;
        const unselectedCount =
          "unselectedCount" in data && typeof data.unselectedCount === "number"
            ? data.unselectedCount
            : pendingVisibilitySelection.unselectedCount;

        setVisibleResources((currentVisibleResources) => ({
          ...currentVisibleResources,
          [pendingVisibilitySelection.resourceType]:
            pendingVisibilitySelection.selectedResources,
        }));
        setLastAppliedSelection({
          resourceType: pendingVisibilitySelection.resourceType,
          selectedCount,
          titles: pendingVisibilitySelection.selectedResources
            .slice(0, 3)
            .map((resource) => resource.title),
          unselectedCount,
        });
        pendingVisibilitySelectionRef.current = null;
      }

      shopify.toast.show(data.message);
      return;
    }

    pendingVisibilitySelectionRef.current = null;
    shopify.toast.show(data.message, { isError: true });
  }, [shopify, visibilityApplyFetcher.data, visibilityApplyFetcher.state]);

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
      const scopeResult = await shopify.scopes.request([PRODUCT_SETUP_SCOPE]);

      if (
        scopeResult.result !== "granted-all" ||
        !scopeResult.detail.granted.includes(PRODUCT_SETUP_SCOPE)
      ) {
        shopify.toast.show(
          "Product permission was not granted, so product setup was not updated.",
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

  const requestThemePermission = async () => {
    if (hasGrantedThemeScope) return true;

    if (!canRequestThemeReadScope) {
      shopify.toast.show(
        "The optional theme permission is not available yet. Deploy the updated app configuration first.",
        { isError: true },
      );
      return false;
    }

    setIsRequestingThemeScope(true);
    try {
      const scopeResult = await shopify.scopes.request([THEME_SETUP_SCOPE]);

      if (
        scopeResult.result !== "granted-all" ||
        !scopeResult.detail.granted.includes(THEME_SETUP_SCOPE)
      ) {
        shopify.toast.show(
          "Theme permission was not granted, so setup status cannot be checked.",
          { isError: true },
        );
        return false;
      }

      setHasGrantedThemeScope(true);
      shopify.toast.show("Theme permission granted. Checking block setup...");
      revalidator.revalidate();
      return true;
    } catch (error) {
      console.error("[block-setup:theme-scope-request]", error);
      shopify.toast.show("Theme permission could not be requested.", {
        isError: true,
      });
      return false;
    } finally {
      setIsRequestingThemeScope(false);
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

  const openCardProductPicker = async () => {
    const hasPermission = await requestProductPermission();
    if (!hasPermission) return;

    try {
      const selection = await shopify.resourcePicker({
        action: "select",
        filter: { variants: false },
        multiple: false,
        selectionIds: cardProduct ? [{ id: cardProduct.productGid }] : [],
        type: "product",
      });

      if (selection === undefined || selection === null) return;

      const selectedProductId =
        normalizePickerSelection(selection)[0]?.id ?? "";

      cardProductsFetcher.submit(
        {
          intent: "set-card-products",
          productId: selectedProductId,
        },
        { method: "post" },
      );
    } catch (error) {
      console.error("[block-setup:card-product-picker]", error);
      shopify.toast.show("The Shopify product picker could not be opened.", {
        isError: true,
      });
    }
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
      const previousResources = visibleResources[resourceType];
      const previousResourceIds = previousResources.map(
        (resource) => resource.id,
      );
      const selection = await shopify.resourcePicker({
        action: "select",
        filter: resourceType === "product" ? { variants: false } : undefined,
        multiple: true,
        selectionIds: previousResourceIds.map((id) => ({ id })),
        type: resourceType,
      });

      if (selection === undefined || selection === null) return;

      const selectedResources = normalizePickerSelection(selection);
      const selectedResourceIds = selectedResources.map(
        (resource) => resource.id,
      );
      const selectedResourceIdSet = new Set(selectedResourceIds);

      pendingVisibilitySelectionRef.current = {
        resourceType,
        selectedResources: selectedResources.map((resource) => ({
          id: resource.id,
          title: resource.title ?? resource.id,
        })),
        unselectedCount: previousResourceIds.filter(
          (resourceId) => !selectedResourceIdSet.has(resourceId),
        ).length,
      };
      visibilityApplyFetcher.submit(
        {
          intent: "set-visibility-metafields",
          previousResourceIds: JSON.stringify(previousResourceIds),
          resourceIds: JSON.stringify(selectedResourceIds),
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
        <s-box
          background="subdued"
          borderColor="base"
          borderRadius="base"
          borderWidth="small"
          padding="base"
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "grid",
                flex: "1 1 320px",
                gap: "0.125rem",
                minWidth: 0,
              }}
            >
              <s-text type="strong">Need a store-specific adjustment?</s-text>
              <s-text color="subdued">
                If your store needs a design, style, workflow, or feature change
                so Gift Pulse fits better, contact us and we can review the best
                way to help.
              </s-text>
            </div>
            <s-link href="/app/help">Open Help & Contact</s-link>
          </div>
        </s-box>
      </s-section>

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
                  description="Works on product pages, cart pages, and drawers"
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
                    Use the block or app embed in the storefront context you
                    want to edit.
                  </p>
                </div>
              </div>

              <div className={styles.editorChoices}>
                <EditorDestination
                  description="Collect the note before add to cart"
                  href={editorProductUrl}
                  icon={<ProductPageIcon />}
                  preview="product"
                  status={themeSetupStatus.targets.product}
                  title="Product page"
                />
                <EditorDestination
                  description="Let shoppers add or edit the note later"
                  href={editorCartUrl}
                  icon={<CartPageIcon />}
                  preview="cart"
                  status={themeSetupStatus.targets.cart}
                  title="Cart page"
                />
                <EditorDestination
                  description="Activate the app embed for compatible cart drawers"
                  href={editorDrawerUrl}
                  icon={<DrawerIcon />}
                  preview="drawer"
                  status={themeSetupStatus.targets.drawer}
                  title="Cart drawer"
                />
                <EditorDestination
                  disabled
                  description="Checkout needs a separate checkout extension setup"
                  icon={<CheckoutIcon />}
                  preview="checkout"
                  status={themeSetupStatus.targets.checkout}
                  title="Checkout"
                />
              </div>

              <div
                style={{
                  alignItems: "center",
                  borderTop: "1px solid rgba(130, 150, 185, 0.22)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.65rem",
                  justifyContent: "space-between",
                  marginTop: "0.9rem",
                  paddingTop: "0.85rem",
                }}
              >
                <s-text color="subdued">
                  {themeSetupStatus.checked
                    ? `Checked current theme: ${themeSetupStatus.themeName || "published theme"}.`
                    : themeSetupStatus.message}
                </s-text>
                {!hasGrantedThemeScope ? (
                  <button
                    className={styles.metafieldButton}
                    disabled={isRequestingThemeScope}
                    onClick={requestThemePermission}
                    type="button"
                  >
                    {isRequestingThemeScope
                      ? "Checking..."
                      : "Check theme setup"}
                  </button>
                ) : null}
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
                description="Choose messages and print beautiful message cards."
              />
              <FlowConnector />
              <FlowStep
                icon="gift"
                number="4"
                title="Message card goes with the order"
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
        <div className={styles.cardProductsPanel} id="message-card-product">
          <div className={styles.cardProductsHeader}>
            <div>
              <span className={styles.actionLabel}>
                Paid message card add-on
              </span>
              <h2 className={styles.cardProductsTitle}>Message card product</h2>
              <p className={styles.cardProductsText}>
                Choose one Shopify product to sell printed message cards. Its
                variants become the shopper-facing choices, including each
                variant image, title, and price.
              </p>
            </div>
            <div className={styles.cardProductsSummary}>
              <span>Configured variants</span>
              <strong>{cardProduct?.variants.length ?? 0}</strong>
              <small>
                {cardProduct
                  ? `${cardProduct.title} variants can be shown in the form`
                  : "Message-only mode stays active"}
              </small>
            </div>
          </div>

          <div className={styles.cardProductsManager}>
            <div className={styles.cardProductsManagerHeader}>
              <span className={styles.cardProductsIcon}>
                <GiftMiniIcon />
              </span>
              <div>
                <h3>Select the message card product</h3>
                <p>
                  Select one product that represents the printed paper/card
                  option. Gift Pulse stores the variants for that product and
                  adds the selected variant to the cart with the gift message
                  properties.
                </p>
              </div>
            </div>

            {cardProduct ? (
              <div className={styles.cardProductGrid}>
                {cardProduct.variants.map((variant) => (
                  <CardVariantPreview
                    key={variant.variantGid || variant.variantId}
                    product={cardProduct}
                    variant={variant}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.cardProductsEmpty}>
                No message card product selected. Storefront gift messages will
                continue to work as message-only line item properties.
              </div>
            )}

            <div className={styles.cardProductsActions}>
              <button
                className={styles.metafieldButton}
                type="button"
                onClick={openCardProductPicker}
                disabled={isSavingCardProducts}
              >
                {isSavingCardProducts
                  ? "Saving..."
                  : cardProduct
                    ? "Change product"
                    : "Select product"}
              </button>
              {cardProduct ? (
                <button
                  className={styles.cardProductsClearButton}
                  type="button"
                  onClick={() => {
                    cardProductsFetcher.submit(
                      {
                        intent: "set-card-products",
                        productId: "",
                      },
                      { method: "post" },
                    );
                  }}
                  disabled={isSavingCardProducts}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
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
                  Items already set to true open checked; remove a checkmark and
                  confirm to set that item back to false.
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
                selectedCount={visibleResources.product.length}
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
                selectedCount={visibleResources.collection.length}
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
                  Saved {lastAppliedSelection.selectedCount} visible{" "}
                  {
                    VISIBILITY_RESOURCE_LABELS[
                      lastAppliedSelection.resourceType
                    ].pluralLabel
                  }
                  {lastAppliedSelection.unselectedCount > 0
                    ? ` and turned off ${lastAppliedSelection.unselectedCount}`
                    : ""}
                  {lastAppliedSelection.titles.length > 0
                    ? `: ${lastAppliedSelection.titles.join(", ")}`
                    : ""}
                  {lastAppliedSelection.selectedCount >
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
              description="Use the selectors above to set the metafield to true on checked products or collections, and false when a previously checked item is removed."
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

type VisibilityResourceSelection = {
  id: string;
  title: string;
};

type VisibilityResourceSelections = Record<
  VisibilityResourceType,
  VisibilityResourceSelection[]
>;

type ThemeSetupTarget = "cart" | "checkout" | "drawer" | "product";
type ThemeSetupStatusState = "disabled" | "missing" | "ready" | "unavailable";

type ThemeSetupTargetStatus = {
  detail: string;
  label: string;
  state: ThemeSetupStatusState;
};

type ThemeSetupStatus = {
  checked: boolean;
  message: string;
  targets: Record<ThemeSetupTarget, ThemeSetupTargetStatus>;
  themeName: string;
};

type ThemeFileContent = {
  content: string;
  filename: string;
};

type ThemeBlockScanResult = {
  disabled: number;
  enabled: number;
  found: number;
};

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

function isTrueMetafieldValue(value: unknown) {
  return value === true || value === "true";
}

function getThemeSetupStatusColor(state: ThemeSetupStatusState) {
  if (state === "ready") return "#267a57";
  if (state === "disabled") return "#9a6700";
  if (state === "missing") return "#9f1239";
  return "#61708a";
}

function createUnavailableThemeSetupStatus(message: string): ThemeSetupStatus {
  return {
    checked: false,
    message,
    targets: {
      cart: {
        detail: message,
        label: "Check unavailable",
        state: "unavailable",
      },
      checkout: {
        detail: "Checkout requires a separate checkout extension setup.",
        label: "Separate setup",
        state: "unavailable",
      },
      drawer: {
        detail: message,
        label: "Check unavailable",
        state: "unavailable",
      },
      product: {
        detail: message,
        label: "Check unavailable",
        state: "unavailable",
      },
    },
    themeName: "",
  };
}

async function getThemeSetupStatus(
  admin: AdminClient,
): Promise<ThemeSetupStatus> {
  const response = await admin.graphql(
    `#graphql
      query GiftPulseThemeSetupStatus($filenames: [String!]!) {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
            name
            files(filenames: $filenames, first: 50) {
              nodes {
                filename
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
              userErrors {
                code
                filename
              }
            }
          }
        }
      }`,
    {
      variables: {
        filenames: [
          "config/settings_data.json",
          "templates/cart*.json",
          "templates/product*.json",
        ],
      },
    },
  );
  const json = await response.json();
  const errors = json.errors as { message?: string }[] | undefined;
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join("; "));
  }

  const theme = json.data?.themes?.nodes?.[0];
  if (!theme) {
    return createUnavailableThemeSetupStatus("No published theme was found.");
  }

  const files = normalizeThemeFiles(theme.files?.nodes);
  const productScan = scanThemeFilesForBlock(
    files.filter((file) => file.filename.startsWith("templates/product")),
    GIFT_MESSAGE_BLOCK_HANDLE,
  );
  const cartScan = scanThemeFilesForBlock(
    files.filter((file) => file.filename.startsWith("templates/cart")),
    GIFT_MESSAGE_BLOCK_HANDLE,
  );
  const drawerScan = scanThemeFilesForBlock(
    files.filter((file) => file.filename === "config/settings_data.json"),
    DRAWER_APP_EMBED_HANDLE,
  );

  return {
    checked: true,
    message: "Theme setup checked.",
    targets: {
      cart: createTemplateTargetStatus(
        cartScan,
        "Cart page block configured",
        "Cart page block disabled",
        "Cart page block not found",
      ),
      checkout: {
        detail: "Checkout requires a separate checkout extension setup.",
        label: "Separate setup",
        state: "unavailable",
      },
      drawer: createTemplateTargetStatus(
        drawerScan,
        "Drawer embed enabled",
        "Drawer embed disabled",
        "Drawer embed not enabled",
      ),
      product: createTemplateTargetStatus(
        productScan,
        "Product block configured",
        "Product block disabled",
        "Product block not found",
      ),
    },
    themeName: typeof theme.name === "string" ? theme.name : "",
  };
}

function normalizeThemeFiles(value: unknown): ThemeFileContent[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((node): ThemeFileContent[] => {
    if (
      typeof node !== "object" ||
      node === null ||
      typeof (node as { filename?: unknown }).filename !== "string"
    ) {
      return [];
    }

    const body = (node as { body?: { content?: unknown } }).body;
    const content = typeof body?.content === "string" ? body.content : "";
    if (!content) return [];

    return [
      {
        content,
        filename: (node as { filename: string }).filename,
      },
    ];
  });
}

function scanThemeFilesForBlock(
  files: ThemeFileContent[],
  blockHandle: string,
): ThemeBlockScanResult {
  return files.reduce<ThemeBlockScanResult>(
    (result, file) =>
      mergeThemeBlockScanResults(result, scanThemeFile(file, blockHandle)),
    { disabled: 0, enabled: 0, found: 0 },
  );
}

function scanThemeFile(
  file: ThemeFileContent,
  blockHandle: string,
): ThemeBlockScanResult {
  try {
    return scanThemeJsonForBlock(JSON.parse(file.content), blockHandle);
  } catch {
    return { disabled: 0, enabled: 0, found: 0 };
  }
}

function scanThemeJsonForBlock(
  value: unknown,
  blockHandle: string,
): ThemeBlockScanResult {
  const result: ThemeBlockScanResult = { disabled: 0, enabled: 0, found: 0 };

  visitThemeJson(value, (node) => {
    const blockType =
      typeof (node as { type?: unknown }).type === "string"
        ? (node as { type: string }).type
        : "";

    if (!isGiftPulseThemeBlockType(blockType, blockHandle)) return;

    result.found += 1;
    if ((node as { disabled?: unknown }).disabled === true) {
      result.disabled += 1;
    } else {
      result.enabled += 1;
    }
  });

  return result;
}

function visitThemeJson(
  value: unknown,
  visitor: (node: Record<string, unknown>) => void,
) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item) => visitThemeJson(item, visitor));
    return;
  }

  const node = value as Record<string, unknown>;
  visitor(node);
  Object.values(node).forEach((item) => visitThemeJson(item, visitor));
}

function isGiftPulseThemeBlockType(blockType: string, blockHandle: string) {
  return (
    blockType.includes(`/blocks/${blockHandle}/`) ||
    blockType.includes(`/blocks/${blockHandle}`) ||
    blockType.includes(`blocks/${blockHandle}/`)
  );
}

function mergeThemeBlockScanResults(
  current: ThemeBlockScanResult,
  next: ThemeBlockScanResult,
): ThemeBlockScanResult {
  return {
    disabled: current.disabled + next.disabled,
    enabled: current.enabled + next.enabled,
    found: current.found + next.found,
  };
}

function createTemplateTargetStatus(
  scan: ThemeBlockScanResult,
  readyLabel: string,
  disabledLabel: string,
  missingLabel: string,
): ThemeSetupTargetStatus {
  if (scan.enabled > 0) {
    return {
      detail: `${scan.enabled} active instance${scan.enabled === 1 ? "" : "s"} found.`,
      label: readyLabel,
      state: "ready",
    };
  }

  if (scan.disabled > 0) {
    return {
      detail: `${scan.disabled} disabled instance${scan.disabled === 1 ? "" : "s"} found.`,
      label: disabledLabel,
      state: "disabled",
    };
  }

  return {
    detail: "No active instance found in the published theme.",
    label: missingLabel,
    state: "missing",
  };
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

async function getVisibilityResourceSelections(
  admin: AdminClient,
): Promise<VisibilityResourceSelections> {
  const [product, collection] = await Promise.all([
    getVisibilityResourcesForType(admin, "product"),
    getVisibilityResourcesForType(admin, "collection"),
  ]);

  return { collection, product };
}

async function getVisibilityResourcesForType(
  admin: AdminClient,
  resourceType: VisibilityResourceType,
): Promise<VisibilityResourceSelection[]> {
  const resourceLabels = VISIBILITY_RESOURCE_LABELS[resourceType];
  const resources = new Map<string, VisibilityResourceSelection>();
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
      query VisibilityMetafieldSelections(
        $after: String
        $first: Int!
        $key: String!
        $namespace: String!
        $ownerType: MetafieldOwnerType!
      ) {
        metafieldDefinitions(
          first: 1
          ownerType: $ownerType
          namespace: $namespace
          key: $key
        ) {
          nodes {
            metafields(first: $first, after: $after) {
              nodes {
                value
                owner {
                  ... on Product {
                    id
                    title
                  }
                  ... on Collection {
                    id
                    title
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }`,
      {
        variables: {
          after,
          first: VISIBILITY_METAFIELDS_PAGE_SIZE,
          namespace: VISIBILITY_METAFIELD_NAMESPACE,
          key: VISIBILITY_METAFIELD_KEY,
          ownerType: resourceLabels.ownerType,
        },
      },
    );
    const json = await response.json();
    const errors = json.errors as { message?: string }[] | undefined;
    if (errors?.length) {
      throw new Error(errors.map((error) => error.message).join("; "));
    }

    const definition = json.data?.metafieldDefinitions?.nodes?.[0];
    const metafields = definition?.metafields;
    if (!metafields) break;

    const nodes = Array.isArray(metafields.nodes) ? metafields.nodes : [];
    for (const node of nodes) {
      if (!isTrueMetafieldValue((node as { value?: unknown }).value)) {
        continue;
      }

      const owner = (node as { owner?: unknown }).owner;
      const ownerId =
        typeof (owner as { id?: unknown } | null)?.id === "string"
          ? (owner as { id: string }).id
          : "";
      if (!ownerId.startsWith(resourceLabels.gidPrefix)) continue;

      const ownerTitleValue = (owner as { title?: unknown } | null)?.title;
      const ownerTitle =
        typeof ownerTitleValue === "string" && ownerTitleValue.trim() !== ""
          ? ownerTitleValue
          : ownerId;
      resources.set(ownerId, {
        id: ownerId,
        title: ownerTitle,
      });
    }

    const pageInfo = metafields.pageInfo;
    hasNextPage = Boolean(pageInfo?.hasNextPage);
    after = typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : null;
    if (hasNextPage && !after) break;
  }

  return Array.from(resources.values());
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
  value: "true" | "false",
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
            value,
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

async function getCardProductFromId(
  admin: AdminClient,
  productId: string,
): Promise<CardProductConfig> {
  let productConfig: CardProductConfig | null = null;
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
      query GiftCardProductDetails($id: ID!, $after: String) {
        product(id: $id) {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
          variants(first: ${CARD_PRODUCT_VARIANTS_PAGE_SIZE}, after: $after) {
            nodes {
              id
              title
              sku
              displayName
              price
              availableForSale
              image {
                url
                altText
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }`,
      {
        variables: {
          after,
          id: productId,
        },
      },
    );
    const json = await response.json();
    const errors = json.errors as { message?: string }[] | undefined;
    if (errors?.length) {
      throw new Error(errors.map((error) => error.message).join("; "));
    }

    const product = json.data?.product;
    const normalizedProduct = normalizeCardProductNode(product);
    if (!normalizedProduct) {
      throw new Error("The selected message card product could not be loaded.");
    }

    if (!productConfig) {
      productConfig = {
        ...normalizedProduct,
        variants: [],
      };
    }

    const variantNodes: unknown[] = Array.isArray(product?.variants?.nodes)
      ? product.variants.nodes
      : [];
    productConfig.variants.push(
      ...variantNodes
        .map((variant) =>
          normalizeCardVariantNode(
            variant,
            normalizedProduct.imageUrl,
            normalizedProduct.imageAlt,
          ),
        )
        .filter((variant): variant is CardProductVariantOption =>
          Boolean(variant),
        ),
    );

    const pageInfo = product?.variants?.pageInfo;
    hasNextPage = Boolean(pageInfo?.hasNextPage);
    after = typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : null;
    if (hasNextPage && !after) break;
  }

  if (!productConfig || productConfig.variants.length === 0) {
    throw new Error(
      "The selected message card product does not have variants to add to the cart.",
    );
  }

  return productConfig;
}

function normalizeCardProductNode(
  value: unknown,
): Omit<CardProductConfig, "variants"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const node = value as {
    featuredImage?: { altText?: unknown; url?: unknown } | null;
    handle?: unknown;
    id?: unknown;
    title?: unknown;
  };
  const productGid = cleanAdminString(node.id);
  const title = cleanAdminString(node.title);

  if (!productGid || !title) {
    return null;
  }

  const productImage = node.featuredImage;

  return {
    handle: cleanAdminString(node.handle),
    imageAlt: cleanAdminString(productImage?.altText),
    imageUrl: cleanAdminString(productImage?.url),
    productGid,
    title,
  };
}

function normalizeCardVariantNode(
  value: unknown,
  fallbackImageUrl: string,
  fallbackImageAlt: string,
): CardProductVariantOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const node = value as {
    availableForSale?: unknown;
    id?: unknown;
    image?: { altText?: unknown; url?: unknown } | null;
    price?: unknown;
    sku?: unknown;
    title?: unknown;
  };
  const variantGid = cleanAdminString(node.id);
  const variantId = getNumericGidId(variantGid);
  const title = cleanAdminString(node.title);

  if (!variantGid || !variantId || !title) {
    return null;
  }

  return {
    available:
      typeof node.availableForSale === "boolean" ? node.availableForSale : true,
    imageAlt: cleanAdminString(node.image?.altText) || fallbackImageAlt,
    imageUrl: cleanAdminString(node.image?.url) || fallbackImageUrl,
    price: cleanAdminString(node.price),
    sku: cleanAdminString(node.sku),
    title,
    variantGid,
    variantId,
  };
}

function getNumericGidId(value: string): string {
  const id = value.split("/").pop() ?? "";
  return /^\d+$/.test(id) ? id : "";
}

function cleanAdminString(value: unknown): string {
  return String(value ?? "").trim();
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

function CardVariantPreview({
  product,
  variant,
}: {
  product: CardProductConfig;
  variant: CardProductVariantOption;
}) {
  const variantLabel =
    variant.title && variant.title.toLowerCase() !== "default title"
      ? variant.title
      : product.title;

  return (
    <div className={styles.cardProductPreview}>
      <span className={styles.cardProductImage}>
        {variant.imageUrl || product.imageUrl ? (
          <img
            src={variant.imageUrl || product.imageUrl}
            alt={variant.imageAlt || product.imageAlt || ""}
          />
        ) : (
          <GiftMiniIcon />
        )}
      </span>
      <span className={styles.cardProductCopy}>
        <strong>{variantLabel}</strong>
        {variant.price ? <small>{variant.price}</small> : null}
        {variant.available === false ? <small>Out of stock</small> : null}
      </span>
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
  disabled = false,
  href,
  icon,
  preview,
  status,
  title,
}: {
  active?: boolean;
  description: string;
  disabled?: boolean;
  href?: string;
  icon: ReactNode;
  preview: "cart" | "checkout" | "drawer" | "product";
  status?: ThemeSetupTargetStatus;
  title: string;
}) {
  const isReady = status?.state === "ready";
  const className = `${styles.editorChoice} ${
    active || isReady ? styles.editorChoiceActive : ""
  }`;
  const content = (
    <>
      <span className={styles.editorChoiceStatus}>
        {isReady || active ? <CheckIcon /> : null}
      </span>
      <span className={styles.editorChoiceIcon}>{icon}</span>
      <span className={styles.editorChoiceCopy}>
        <strong>{title}</strong>
        <small>{description}</small>
        {status ? (
          <small
            style={{
              color: getThemeSetupStatusColor(status.state),
              fontWeight: 750,
            }}
          >
            {status.label}
          </small>
        ) : null}
      </span>
      <SetupPreview type={preview} />
    </>
  );

  if (disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className={className}
        style={{ cursor: "default", opacity: 0.72 }}
      >
        {content}
      </span>
    );
  }

  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  );
}

function SetupPreview({
  type,
}: {
  type: "cart" | "checkout" | "drawer" | "product";
}) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.setupPreview} ${
        type === "product" ? "" : styles.setupPreviewCart
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
  selectedCount,
}: {
  disabled: boolean;
  isBusy: boolean;
  onClick: () => void;
  resourceType: VisibilityResourceType;
  selectedCount: number;
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
        <span className={styles.visibilityTargetCount}>
          {selectedCount} currently visible
        </span>
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

function DrawerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 4h14v16H5z" />
      <path d="M14 4v16" />
      <path d="M8 9h3" />
      <path d="M8 13h3" />
      <path d="M16.5 12h.01" />
    </svg>
  );
}

function CheckoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 7h12l-1 12H7L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
      <path d="m9 13 2 2 4-5" />
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
