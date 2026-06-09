import { useEffect, useState } from "react";
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
  const visibilityMetafieldDefinition = hasProductWriteScope
    ? await getVisibilityMetafieldDefinition(admin)
    : null;

  return {
    canRequestProductWriteScope,
    customDataUrl: `https://${session.shop}/admin/settings/custom_data`,
    editorProductUrl: `${editorBase}?template=product`,
    editorCartUrl: `${editorBase}?template=cart`,
    hasProductWriteScope,
    productsUrl: `https://${session.shop}/admin/products`,
    visibilityMetafieldDefinition,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, scopes } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "create-product-visibility-metafield") {
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
        "Gift Pulse needs product write permission before it can create the product metafield.",
    };
  }

  try {
    const existingDefinition = await getVisibilityMetafieldDefinition(admin);
    if (existingDefinition) {
      return {
        ok: true,
        intent,
        alreadyExisted: true,
        definition: existingDefinition,
        message: "The product metafield already exists and is ready to use.",
      };
    }

    const createdDefinition = await createVisibilityMetafieldDefinition(admin);

    return {
      ok: true,
      intent,
      alreadyExisted: false,
      definition: createdDefinition,
      message: "Product metafield created successfully.",
    };
  } catch (error) {
    console.error("[block-setup:create-product-metafield]", error);
    return {
      ok: false,
      intent,
      message:
        error instanceof Error
          ? error.message
          : "Product metafield could not be created.",
    };
  }
};

export default function GiftMessageSetup() {
  const {
    canRequestProductWriteScope,
    customDataUrl,
    editorCartUrl,
    editorProductUrl,
    hasProductWriteScope,
    productsUrl,
    visibilityMetafieldDefinition,
  } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const metafieldFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [hasGrantedProductScope, setHasGrantedProductScope] = useState(
    hasProductWriteScope,
  );
  const [definitionReady, setDefinitionReady] = useState(
    Boolean(visibilityMetafieldDefinition),
  );
  const isCreatingMetafield = metafieldFetcher.state !== "idle";

  useEffect(() => {
    setHasGrantedProductScope(hasProductWriteScope);
    setDefinitionReady(Boolean(visibilityMetafieldDefinition));
  }, [hasProductWriteScope, visibilityMetafieldDefinition]);

  useEffect(() => {
    if (metafieldFetcher.state !== "idle" || !metafieldFetcher.data) return;

    const data = metafieldFetcher.data;
    if (data.ok) {
      setDefinitionReady(true);
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

  const createMetafieldWithApp = async () => {
    if (!hasGrantedProductScope) {
      if (!canRequestProductWriteScope) {
        shopify.toast.show(
          "The optional product permission is not available yet. Deploy the updated app configuration first.",
          { isError: true },
        );
        return;
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
            "Product permission was not granted, so the metafield was not created.",
            { isError: true },
          );
          return;
        }

        setHasGrantedProductScope(true);
      } catch (error) {
        console.error("[block-setup:scope-request]", error);
        shopify.toast.show("Product permission could not be requested.", {
          isError: true,
        });
        return;
      }
    }

    metafieldFetcher.submit(
      { intent: "create-product-visibility-metafield" },
      { method: "post" },
    );
  };

  return (
    <s-page heading="Block Setup" inlineSize="large">
      <s-section>
        <div className={styles.blockIntro}>
          <div className={styles.blockIntroCopy}>
            <div className={styles.blockBadgeRow}>
              <span className={styles.blockIcon}>
                <BlockIcon />
              </span>
              <span className={styles.blockBadge}>Theme app block</span>
            </div>
            <div>
              <h1 className={styles.blockTitle}>Gift Message block</h1>
              <p className={styles.blockText}>
                Add the same block to product pages, the cart page, or both. It
                collects the gift note and keeps it attached to the order data
                used by Messages & Print.
              </p>
            </div>
          </div>

          <div className={styles.blockActionPanel}>
            <div className={styles.blockActionPanelHeader}>
              <span className={styles.actionLabel}>
                Open Shopify theme editor
              </span>
              <p>
                Use the same block in either storefront context. Choose the
                place you want to edit.
              </p>
            </div>
            <div className={styles.blockActions}>
              <a
                className={`${styles.blockAction} ${styles.blockActionProduct}`}
                href={editorProductUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className={styles.blockActionIcon}>
                  <ProductPageIcon />
                </span>
                <span className={styles.blockActionText}>
                  <strong>Product page</strong>
                  <small>Collect the note before add to cart</small>
                </span>
              </a>
              <a
                className={`${styles.blockAction} ${styles.blockActionCart}`}
                href={editorCartUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className={styles.blockActionIcon}>
                  <CartPageIcon />
                </span>
                <span className={styles.blockActionText}>
                  <strong>Cart page</strong>
                  <small>Let shoppers add or edit the note later</small>
                </span>
              </a>
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
              <span className={styles.actionLabel}>Optional visibility rule</span>
              <h2 className={styles.metafieldGuideTitle}>
                Show the block only on selected products
              </h2>
              <p className={styles.blockText}>
                Use one product metafield to decide which product pages show
                the Gift Message block. Gift Pulse can create the definition for
                you, or you can create it manually in Shopify admin.
              </p>
            </div>
            <div className={styles.metafieldName}>
              <span>Recommended metafield</span>
              <code>{VISIBILITY_METAFIELD_REFERENCE}</code>
            </div>
          </div>

          <div className={styles.metafieldAutomation}>
            <div>
              <h3>Create it with Gift Pulse</h3>
              <p>
                This asks for optional product permission only when you use this
                setup tool. After approval, Gift Pulse creates the boolean
                product metafield definition for you.
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
                    definitionReady
                      ? styles.metafieldStatusReady
                      : styles.metafieldStatusPending
                  }
                >
                  {definitionReady
                    ? "Metafield definition ready"
                    : "Metafield definition not created"}
                </span>
              </div>
            </div>
            <button
              className={styles.metafieldButton}
              type="button"
              onClick={createMetafieldWithApp}
              disabled={isCreatingMetafield || definitionReady}
            >
              {definitionReady
                ? "Metafield ready"
                : isCreatingMetafield
                  ? "Creating..."
                  : "Create with app"}
            </button>
          </div>

          <div className={styles.metafieldSteps}>
            <GuideStep
              number="1"
              title="Create it manually"
              description="In Shopify admin, open Settings > Custom data > Products, then add a definition named Show gift message block."
            />
            <GuideStep
              number="2"
              title="Use a boolean value"
              description="Set Namespace and key to custom.show_gift_message and choose the True or false metafield type."
            />
            <GuideStep
              number="3"
              title="Set product values"
              description="Open each product and set Show gift message block to true when the Gift Message block should appear."
            />
            <GuideStep
              number="4"
              title="Connect the block"
              description="In the theme editor, enable the visibility setting and keep custom.show_gift_message, or enter another boolean product metafield."
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
          </div>
        </div>
      </s-section>

      <s-section>
        <div className={styles.howItWorks}>
          <s-heading>How it works</s-heading>
          <div className={styles.flowBand}>
            <FlowStep
              icon="write"
              title="1. Customer writes a message"
              description="They add who it's from, who it's for, and the message."
            />
            <FlowConnector />
            <FlowStep
              icon="data"
              title="2. App stores the data"
              description="We save the sender, recipient, message, and product with the order."
            />
            <FlowConnector />
            <FlowStep
              icon="print"
              title="3. Merchant prints selected messages"
              description="Choose messages and print beautiful gift cards."
            />
            <FlowConnector />
            <FlowStep
              icon="gift"
              title="4. Gift card goes with the order"
              description="The printed message is packed with the product."
            />
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

async function getVisibilityMetafieldDefinition(
  admin: AdminClient,
): Promise<VisibilityMetafieldDefinition | null> {
  const response = await admin.graphql(
    `#graphql
    query ProductVisibilityMetafieldDefinition(
      $namespace: String!
      $key: String!
    ) {
      metafieldDefinitions(
        first: 1
        ownerType: PRODUCT
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
): Promise<VisibilityMetafieldDefinition> {
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
          description:
            "Set to true on products where the Gift Message storefront block should be shown.",
          type: "boolean",
          ownerType: "PRODUCT",
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
  title,
}: {
  description: string;
  icon: "write" | "data" | "print" | "gift";
  title: string;
}) {
  return (
    <div className={styles.flowStep}>
      <span className={styles.flowIcon}>
        <FlowIcon type={icon} />
      </span>
      <div>
        <s-text type="strong">{title}</s-text>
        <s-text color="subdued">{description}</s-text>
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
