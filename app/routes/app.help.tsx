import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendContactEmail } from "../email.server";
import styles from "../styles/help.module.css";

const DEFAULT_CONTACT_EMAIL = "support@example.com";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {
    contactEmail: process.env.CONTACT_EMAIL ?? DEFAULT_CONTACT_EMAIL,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "privacy-data-request") {
    const [giftMessages, printTemplates, contacts, appInstallations] =
      await Promise.all([
        db.giftMessage.count({ where: { shop: session.shop } }),
        db.printTemplateSettings.count({ where: { shop: session.shop } }),
        db.contactRequest.count({ where: { shop: session.shop } }),
        db.appInstallation.count({ where: { shop: session.shop } }),
      ]);

    await sendContactEmail({
      type: "Privacy: Data summary",
      subject: "Privacy - Data summary requested",
      shop: session.shop,
      message: [
        `Shop: ${session.shop}`,
        "",
        "Data currently stored for this shop:",
        `- Gift messages: ${giftMessages}`,
        `- Print template settings: ${printTemplates}`,
        `- Contact requests: ${contacts}`,
        `- App installation records: ${appInstallations}`,
        "- Sessions: active offline access tokens",
        "",
        "No personal customer account data is stored by the app.",
      ].join("\n"),
    });

    return {
      ok: true,
      intent: "privacy-data-request" as const,
      counts: { giftMessages, printTemplates, contacts, appInstallations },
      message: "Data summary sent to our team. We will respond within 30 days.",
    };
  }

  if (intent === "privacy-data-delete") {
    await Promise.all([
      db.giftMessage.deleteMany({ where: { shop: session.shop } }),
      db.printTemplateSettings.deleteMany({ where: { shop: session.shop } }),
      db.contactRequest.deleteMany({ where: { shop: session.shop } }),
      db.appInstallation.deleteMany({ where: { shop: session.shop } }),
      db.session.deleteMany({ where: { shop: session.shop } }),
    ]);

    await sendContactEmail({
      type: "Privacy: Data deleted",
      subject: "Privacy - Merchant deleted all app data",
      shop: session.shop,
      message: [
        `Shop: ${session.shop}`,
        "",
        "The merchant requested deletion of all app data.",
        "Deleted: gift messages, print template settings, contact requests, app installation records, and sessions.",
      ].join("\n"),
    });

    return {
      ok: true,
      intent: "privacy-data-delete" as const,
      message: "All your app data has been permanently deleted.",
    };
  }

  const type = String(formData.get("type") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const replyEmail = String(formData.get("email") ?? "").trim() || undefined;

  if (!type || !message) {
    return {
      ok: false,
      intent: "contact" as const,
      message: "Message is required.",
    };
  }

  try {
    await db.contactRequest.create({
      data: {
        shop: session.shop,
        type,
        subject: subject || type,
        message,
        email: replyEmail ?? null,
      },
    });

    await sendContactEmail({
      type,
      subject: subject || type,
      message,
      replyEmail,
      shop: session.shop,
    });

    return {
      ok: true,
      intent: "contact" as const,
      message: "Message sent. We will get back to you soon.",
    };
  } catch (error) {
    console.error("[help.action]", error);
    return {
      ok: false,
      intent: "contact" as const,
      message: "Something went wrong. Please try again.",
    };
  }
};

type ModalType = "customization" | "suggestion" | "support" | null;
type IconType =
  | "chat"
  | "code"
  | "email"
  | "lightbulb"
  | "lock"
  | "magic"
  | "settings"
  | "store"
  | "wrench";

const customizationServices = [
  {
    icon: "settings" as const,
    title: "Store-specific setup guidance",
    text: "Configuration help for product types, fulfillment process, gift packaging, and team review flow.",
  },
  {
    icon: "store" as const,
    title: "Tailored app adjustments",
    text: "Guidance when your store needs different fields, wording, print layouts, storefront behavior, or theme fit.",
  },
  {
    icon: "code" as const,
    title: "Custom Shopify workflows",
    text: "For workflows beyond the default settings, we can help review a store-specific extension or companion app approach.",
  },
];

const requestCards = [
  {
    icon: "wrench" as const,
    title: "Request setup help",
    text: "Ask our app support team for guidance on fitting Gift Pulse to your gifting workflow or store-specific needs.",
    action: "Request help",
    modal: "customization" as const,
    tone: "primary",
  },
  {
    icon: "lightbulb" as const,
    title: "Suggest an improvement",
    text: "Tell us what would make message collection, filtering, templates, or printing more useful.",
    action: "Send suggestion",
    modal: "suggestion" as const,
  },
  {
    icon: "chat" as const,
    title: "Contact support",
    text: "Ask about setup, theme blocks, printing, templates, or data handling.",
    action: "Contact us",
    modal: "support" as const,
  },
];

export default function Help() {
  const { contactEmail } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();
  const privacyFetcher = useFetcher<typeof action>();
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [privacyDeleteOpen, setPrivacyDeleteOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const isSubmitting = fetcher.state !== "idle";
  const isPrivacySubmitting = privacyFetcher.state !== "idle";

  const modalContent = {
    customization: {
      title: "Request a store-specific customization",
      type: "customization",
      subjectPlaceholder: "Store-specific Gift Pulse adjustment",
      messageLabel: "What should work differently for this store?",
      messagePlaceholder:
        "Example: Adjust the storefront form style, add a specific field, change the print layout, or adapt the packing-team workflow.",
      intro:
        "Share what happens today, what should be different, and how the app could fit your store more closely.",
      primary: "Send customization request",
    },
    suggestion: {
      title: "Suggest an improvement",
      type: "suggestion",
      subjectPlaceholder: "New filter, template, or workflow idea",
      messageLabel: "What should we add or improve?",
      messagePlaceholder:
        "Example: Add a filter for unprinted messages and a way to mark cards as packed.",
      intro:
        "Product ideas, rough workflows, missing filters, confusing copy, and UX improvements are all useful.",
      primary: "Send suggestion",
    },
    support: {
      title: "Contact support",
      type: "support",
      subjectPlaceholder: "Question about gift messages",
      messageLabel: "How can we help?",
      messagePlaceholder:
        "Example: The product page block appears, but messages are not showing on the order line item.",
      intro:
        "Send us the question with enough detail to reproduce or understand the situation.",
      primary: "Send message",
    },
  } as const;

  const activeModal = openModal ? modalContent[openModal] : null;

  const closeModal = () => {
    setOpenModal(null);
    setSubject("");
    setMessage("");
    setEmail("");
  };

  // Contact / suggestion / customization form results → toast
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;
    if (data.intent !== "contact") return;
    if (data.ok) {
      shopify.toast.show(data.message);
      setOpenModal(null);
      setSubject("");
      setMessage("");
      setEmail("");
    } else {
      shopify.toast.show(data.message, { isError: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  // Privacy actions → toast
  useEffect(() => {
    if (privacyFetcher.state !== "idle" || !privacyFetcher.data) return;
    const data = privacyFetcher.data;
    if (data.ok) {
      const counts = "counts" in data ? data.counts : null;
      const extra = counts
        ? ` ${counts.giftMessages} gift message(s), ${counts.printTemplates} template setting(s), ${counts.contacts} contact request(s), ${counts.appInstallations} app installation record(s).`
        : "";
      shopify.toast.show(`${data.message}${extra}`, { duration: 7000 });
    } else {
      shopify.toast.show(data.message, { isError: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privacyFetcher.state, privacyFetcher.data]);

  const submitForm = () => {
    if (!activeModal || !message.trim()) return;

    const formData = new FormData();
    formData.set("type", activeModal.type);
    formData.set("subject", subject || activeModal.title);
    formData.set("message", message);
    formData.set("email", email);
    fetcher.submit(formData, { method: "post" });
  };

  const requestPrivacySummary = () => {
    const formData = new FormData();
    formData.set("intent", "privacy-data-request");
    privacyFetcher.submit(formData, { method: "post" });
  };

  const deletePrivacyData = () => {
    const formData = new FormData();
    formData.set("intent", "privacy-data-delete");
    privacyFetcher.submit(formData, { method: "post" });
    setPrivacyDeleteOpen(false);
  };

  return (
    <s-page heading="Help & contact" inlineSize="large">
      <s-section>
        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.badges}>
                <s-badge tone="success">App support</s-badge>
                <span className={styles.softBadge}>Private workflows</span>
                <span className={styles.softBadge}>Setup guidance</span>
              </div>
              <div>
                <h1 className={styles.heroTitle}>
                  Make Gift Pulse fit your store.
                </h1>
                <p className={styles.heroText}>
                  Get guidance for using the app with your catalog, team
                  process, and Shopify setup: message flows, filters,
                  fulfillment workflows, store-specific operations, and tailored
                  adjustments when the default settings do not fully match your
                  needs.
                </p>
              </div>
              <div className={styles.actions}>
                <s-button
                  variant="primary"
                  onClick={() => setOpenModal("customization")}
                >
                  Request setup help
                </s-button>
                <s-button onClick={() => setOpenModal("support")}>
                  Contact us
                </s-button>
              </div>
            </div>

            <div className={styles.popularCard}>
              <div className={styles.cardTitle}>
                <span className={styles.iconBox}>
                  <HelpIcon type="magic" />
                </span>
                <div>
                  <h2 className={styles.darkPanelTitle}>
                    Common support topics
                  </h2>
                  <p className={styles.darkPanelText}>
                    Practical setup questions with clear workflow value.
                  </p>
                </div>
              </div>
              <div className={styles.divider} />
              <ul className={styles.checkList}>
                {[
                  "Gift workflows based on products, tags, order attributes, and fulfillment locations",
                  "Bulk print flows for packing teams, seasonal campaigns, or wholesale orders",
                  "Store-specific adjustments for message forms, print layouts, and internal workflows",
                ].map((item) => (
                  <li key={item}>
                    <span>✓</span>
                    <p>{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </s-section>

      <s-section>
        <div className={styles.customRequestBanner}>
          <div className={styles.customRequestCopy}>
            <span className={styles.customRequestEyebrow}>
              Store-specific fit
            </span>
            <h2>Need Gift Pulse to work a little differently?</h2>
            <p>
              Send a request if your store needs a design, style, workflow, or
              feature adjustment so the app matches how your team sells,
              prepares, or fulfills gift orders.
            </p>
          </div>
          <s-button
            variant="primary"
            onClick={() => setOpenModal("customization")}
          >
            Request customization
          </s-button>
        </div>
      </s-section>

      <s-section>
        <div className={styles.requestGrid}>
          {requestCards.map((card) => (
            <div className={styles.requestCard} key={card.title}>
              <div className={styles.cardTitle}>
                <span
                  className={
                    card.tone === "primary"
                      ? styles.iconBox
                      : styles.iconBoxBlue
                  }
                >
                  <HelpIcon type={card.icon} />
                </span>
                <s-heading>{card.title}</s-heading>
              </div>
              <s-paragraph>{card.text}</s-paragraph>
              <s-button
                variant={card.tone === "primary" ? "primary" : undefined}
                onClick={() => setOpenModal(card.modal)}
              >
                {card.action}
              </s-button>
            </div>
          ))}
        </div>
      </s-section>

      <s-section>
        <div className={styles.serviceContactGrid}>
          <div className={styles.privacyCard}>
            <div>
              <s-heading>How our app support can help</s-heading>
              <s-paragraph>
                Keep the app simple for everyday use, and get help configuring
                the behavior your store needs. If your workflow needs a more
                tailored fit, send the context and we can review the best way to
                support it.
              </s-paragraph>
            </div>
            <div className={styles.serviceGrid}>
              {customizationServices.map((service) => (
                <div className={styles.serviceCard} key={service.title}>
                  <span className={styles.smallIcon}>
                    <HelpIcon type={service.icon} />
                  </span>
                  <s-heading>{service.title}</s-heading>
                  <s-text color="subdued">{service.text}</s-text>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.contactCard}>
            <div className={styles.cardTitle}>
              <span className={styles.smallIcon}>
                <HelpIcon type="email" />
              </span>
              <h2 className={styles.darkPanelTitle}>Direct contact</h2>
            </div>
            <p className={styles.darkPanelText}>
              Prefer email? Send us context about the store, the gifting
              problem, what should work differently, and the result you want.
            </p>
            <div className={styles.emailBox}>{contactEmail}</div>
            <s-button onClick={() => setOpenModal("support")}>
              Send from app
            </s-button>
          </div>
        </div>
      </s-section>

      <s-section>
        <div className={styles.privacyCard}>
          <div className={styles.cardTitle}>
            <span className={styles.smallIcon}>
              <HelpIcon type="lock" />
            </span>
            <div>
              <s-heading>Data & privacy</s-heading>
              <s-text color="subdued">
                What Gift Pulse stores about your shop.
              </s-text>
            </div>
          </div>
          <ul className={styles.checkList}>
            {[
              "Gift messages and related product/cart references",
              "Print template preferences and custom template code",
              "Contact requests sent through this page",
              "Basic app installation and uninstall status for your shop",
              "Session tokens for Shopify admin authentication",
              "No personal customer account data is stored by the app",
            ].map((item, index) => (
              <li key={item}>
                <span>{index === 5 ? "✓" : "·"}</span>
                <s-text>{item}</s-text>
              </li>
            ))}
          </ul>
          <div className={styles.divider} />
          <div className={styles.privacyActions}>
            <s-button
              loading={
                isPrivacySubmitting &&
                privacyFetcher.formData?.get("intent") ===
                  "privacy-data-request"
              }
              disabled={isPrivacySubmitting}
              onClick={requestPrivacySummary}
            >
              Request data summary
            </s-button>
            <s-button
              tone="critical"
              variant="tertiary"
              disabled={isPrivacySubmitting}
              onClick={() => setPrivacyDeleteOpen(true)}
            >
              Delete all my data
            </s-button>
          </div>
        </div>
      </s-section>

      {privacyDeleteOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-delete-title"
          >
            <div className={styles.modalHeader}>
              <s-heading id="privacy-delete-title">
                Delete all app data?
              </s-heading>
              <s-button
                variant="tertiary"
                onClick={() => setPrivacyDeleteOpen(false)}
              >
                Close
              </s-button>
            </div>
            <s-paragraph>
              This will permanently delete all gift messages, print template
              settings, and contact requests stored for your shop. Session
              tokens will also be cleared.
            </s-paragraph>
            <s-text color="subdued">
              This action cannot be undone. You may be asked to log in again
              after deletion.
            </s-text>
            <div className={styles.modalActions}>
              <s-button
                variant="tertiary"
                onClick={() => setPrivacyDeleteOpen(false)}
              >
                Cancel
              </s-button>
              <s-button
                tone="critical"
                loading={isPrivacySubmitting}
                onClick={deletePrivacyData}
              >
                Delete permanently
              </s-button>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className={styles.modalBackdrop} role="presentation">
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <div className={styles.modalHeader}>
              <s-heading id="contact-modal-title">
                {activeModal.title}
              </s-heading>
              <s-button variant="tertiary" onClick={closeModal}>
                Close
              </s-button>
            </div>
            <s-paragraph>{activeModal.intro}</s-paragraph>
            <div className={styles.formGrid}>
              <label>
                <s-text type="strong">{activeModal.messageLabel}</s-text>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.currentTarget.value)}
                  placeholder={activeModal.messagePlaceholder}
                  rows={5}
                />
              </label>
              <label>
                <s-text type="strong">Subject</s-text>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.currentTarget.value)}
                  placeholder={activeModal.subjectPlaceholder}
                />
              </label>
              <label>
                <s-text type="strong">Reply email</s-text>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="you@store.com"
                />
              </label>
            </div>
            <div className={styles.modalActions}>
              <s-button variant="tertiary" onClick={closeModal}>
                Cancel
              </s-button>
              <s-button
                variant="primary"
                disabled={!message.trim() || isSubmitting}
                loading={isSubmitting}
                onClick={submitForm}
              >
                {isSubmitting ? "Sending..." : activeModal.primary}
              </s-button>
            </div>
          </div>
        </div>
      )}
    </s-page>
  );
}

function HelpIcon({ type }: { type: IconType }) {
  if (type === "code") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m8 9-4 3 4 3" />
        <path d="m16 9 4 3-4 3" />
        <path d="m14 4-4 16" />
      </svg>
    );
  }

  if (type === "email") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 6h16v12H4z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  if (type === "lightbulb") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z" />
      </svg>
    );
  }

  if (type === "lock") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M6 10h12v10H6z" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }

  if (type === "magic") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m5 19 14-14" />
        <path d="m14 5 5 5" />
        <path d="M5 5v3" />
        <path d="M3.5 6.5h3" />
        <path d="M18 16v3" />
        <path d="M16.5 17.5h3" />
      </svg>
    );
  }

  if (type === "settings") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9.2 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
      </svg>
    );
  }

  if (type === "store") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 10h16" />
        <path d="m5 10 1-6h12l1 6" />
        <path d="M6 10v10h12V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  if (type === "wrench") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M14.7 6.3a4 4 0 0 0 5 5L11 20l-5-5 8.7-8.7Z" />
        <path d="m6 15 3 3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 5h16v11H7l-3 3V5Z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
