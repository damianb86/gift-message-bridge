import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import styles from "../styles/block-setup.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const editorBase = `https://${session.shop}/admin/themes/current/editor`;
  const shopHandle = session.shop.replace(".myshopify.com", "");

  const response = await admin.graphql(`
    #graphql
    query ShopPlan {
      shop {
        plan {
          displayName
          partnerDevelopment
        }
      }
    }
  `);
  const planData = (await response.json()) as {
    data?: {
      shop?: {
        plan?: {
          displayName?: string;
          partnerDevelopment?: boolean;
        };
      };
    };
  };
  const plan = planData.data?.shop?.plan;
  const planName = plan?.displayName || "Unknown plan";
  const checkoutSupported = planName.toLowerCase().includes("plus");

  return {
    editorProductUrl: `${editorBase}?template=product`,
    editorCartUrl: `${editorBase}?template=cart`,
    checkoutEditorUrl: `https://admin.shopify.com/store/${shopHandle}/settings/checkout/editor`,
    checkoutSettingsUrl: `https://admin.shopify.com/store/${shopHandle}/settings/checkout`,
    checkoutSupported,
    planName,
    planUrl: `https://admin.shopify.com/store/${shopHandle}/settings/plan`,
  };
};

export default function GiftMessageSetup() {
  const {
    checkoutEditorUrl,
    checkoutSettingsUrl,
    checkoutSupported,
    editorCartUrl,
    editorProductUrl,
    planName,
    planUrl,
  } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Block Setup" inlineSize="large">
      <s-section>
        <div className={styles.statusStrip}>
          <SetupStatus
            label="Product Page"
            status="Theme block"
            tone="success"
          />
          <SetupStatus label="Cart Page" status="Theme block" tone="success" />
          <SetupStatus
            label="Checkout Page"
            status="Checkout extension"
            tone="info"
          />
        </div>
      </s-section>

      {!checkoutSupported && (
        <s-section>
          <div className={styles.planNotice}>
            <div>
              <s-heading>Checkout block unavailable on this store</s-heading>
              <s-paragraph>
                Shopify only exposes checkout UI extension blocks for checkout
                steps on Shopify Plus stores. This store is currently on{" "}
                {planName}, so the checkout editor can show an empty Apps list.
                If the store is already Plus, review checkout settings and
                upgrade to the latest checkout version there.
              </s-paragraph>
            </div>
            <s-button href={planUrl} target="_blank">
              Review store plan
            </s-button>
          </div>
        </s-section>
      )}

      <s-section>
        <div className={styles.setupGrid}>
          <SetupPanel
            title="Product Page"
            eyebrow="Line item message"
            description="Adds the gift message inside the product form so it travels with the selected product."
            preview="product"
            steps={[
              "Open the product template",
              "Add Gift Message inside Product information",
              "Save the theme",
            ]}
            action="Open product template"
            href={editorProductUrl}
          />
          <SetupPanel
            title="Cart Page"
            eyebrow="Order message"
            description="Lets customers add a general message from the cart and saves it as a cart attribute."
            preview="cart"
            steps={[
              "Open the cart template",
              "Add Gift Message in the cart section",
              "Save the theme",
            ]}
            action="Open cart template"
            href={editorCartUrl}
          />
          <SetupPanel
            title="Checkout Page"
            eyebrow="Checkout display"
            description="Shows the collected gift messages during checkout so merchants and customers can verify them."
            preview="checkout"
            steps={[
              "Open the checkout editor",
              "Place the Gift messages block",
              "Preview checkout",
            ]}
            action="Open checkout editor"
            href={checkoutEditorUrl}
          />
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
          <div className={styles.checkoutHelp}>
            <s-text color="subdued">
              Checkout blocks are managed from checkout settings.
            </s-text>
            <s-button href={checkoutSettingsUrl} target="_blank">
              Open checkout settings
            </s-button>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

function SetupStatus({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: "success" | "info";
}) {
  return (
    <div className={styles.statusItem}>
      <span className={`${styles.statusDot} ${styles[`statusDot${tone}`]}`} />
      <div>
        <s-text type="strong">{label}</s-text>
        <s-text color="subdued">{status}</s-text>
      </div>
    </div>
  );
}

function SetupPanel({
  title,
  eyebrow,
  description,
  preview,
  steps,
  action,
  href,
}: {
  title: string;
  eyebrow: string;
  description: string;
  preview: "product" | "cart" | "checkout";
  steps: string[];
  action: string;
  href: string;
}) {
  return (
    <article className={styles.setupPanel}>
      <div className={styles.panelHeader}>
        <div>
          <s-text color="subdued">{eyebrow}</s-text>
          <s-heading>{title}</s-heading>
        </div>
        <s-badge tone={preview === "checkout" ? "info" : "success"}>
          {preview === "checkout" ? "Extension" : "Theme"}
        </s-badge>
      </div>

      <PreviewFrame type={preview} />

      <s-paragraph>{description}</s-paragraph>

      <ol className={styles.stepList}>
        {steps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <s-button href={href} target="_blank" variant="primary">
        {action}
      </s-button>
    </article>
  );
}

function PreviewFrame({ type }: { type: "product" | "cart" | "checkout" }) {
  return (
    <div className={`${styles.preview} ${styles[`preview${type}`]}`}>
      <div className={styles.previewChrome}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.previewBody}>
        {type === "product" && (
          <>
            <div className={styles.previewMedia} />
            <div className={styles.previewContent}>
              <div className={styles.previewLineWide} />
              <div className={styles.previewLine} />
              <div className={styles.giftBlock}>
                <div />
                <span />
                <span />
              </div>
              <div className={styles.previewButton} />
            </div>
          </>
        )}
        {type === "cart" && (
          <>
            <div className={styles.cartRows}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.giftBlock}>
              <div />
              <span />
              <span />
            </div>
          </>
        )}
        {type === "checkout" && (
          <>
            <div className={styles.checkoutMain}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.checkoutSide}>
              <div className={styles.giftBlock}>
                <div />
                <span />
                <span />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
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
