import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import styles from "../styles/block-setup.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const editorBase = `https://${session.shop}/admin/themes/current/editor`;

  return {
    editorProductUrl: `${editorBase}?template=product`,
    editorCartUrl: `${editorBase}?template=cart`,
  };
};

export default function GiftMessageSetup() {
  const { editorCartUrl, editorProductUrl } = useLoaderData<typeof loader>();

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
            <span className={styles.actionLabel}>
              Open Shopify theme editor
            </span>
            <div className={styles.blockActions}>
              <a
                className={styles.blockAction}
                href={editorProductUrl}
                target="_blank"
                rel="noreferrer"
              >
                Product page
              </a>
              <a
                className={`${styles.blockAction} ${styles.blockActionSecondary}`}
                href={editorCartUrl}
                target="_blank"
                rel="noreferrer"
              >
                Cart page
              </a>
            </div>
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
