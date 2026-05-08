/**
 * Admin UI Extension - "Print Gift Message"
 * Target: admin.order-details.print-action.render
 *
 * The order is the source of truth. We read the current order line item
 * properties, extract the combined "Gift Message" value, and ask the app only
 * for the configured print template and a short-lived print URL.
 */

/* global __APP_URL__ */
/* eslint-disable react/prop-types */

import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { getPrintTemplateTheme } from "../../../app/lib/print-template-themes";

const APP_URL =
  typeof __APP_URL__ !== "undefined" && __APP_URL__ ? __APP_URL__ : "";

const GIFT_MESSAGE_PROPERTY = "Gift Message";
const GIFT_MESSAGE_PROPERTY_NAME = "_Gift Message Property";
const GIFT_MESSAGE_REF_PROPERTY = "Gift Message Ref";

const ORDER_QUERY = `#graphql
query GiftMessageOrder($id: ID!) {
  order(id: $id) {
    id
    name
    processedAt
    createdAt
    lineItems(first: 100) {
      nodes {
        title
        variantTitle
        sku
        customAttributes {
          key
          value
        }
      }
    }
  }
}`;

export default async function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [markPrinted, setMarkPrinted] = useState(true);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [printUrl, setPrintUrl] = useState(undefined);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [requestedTemplateId, setRequestedTemplateId] = useState("");
  const [templateOptions, setTemplateOptions] = useState([]);
  const [status, setStatus] = useState({
    type: "loading",
    count: 0,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      setStatus({ type: "loading", count: 0 });
      setPrintUrl(undefined);

      const orderId = shopify.data?.selected?.[0]?.id ?? "";
      if (!orderId) {
        setStatus({ type: "order_access_error", count: 0 });
        return;
      }

      try {
        const result = await shopify.query(ORDER_QUERY, {
          variables: { id: orderId },
        });

        if (!active) return;

        if (result.errors?.length || !result.data?.order) {
          setStatus({ type: "order_access_error", count: 0 });
          return;
        }

        const currentOrder = result.data.order;
        const currentMessages = collectGiftMessages(currentOrder);

        setOrder(currentOrder);
        setMessages(currentMessages);

        if (currentMessages.length === 0) {
          setStatus({ type: "not_found", count: 0 });
        }
      } catch (_) {
        if (active) {
          setStatus({ type: "order_access_error", count: 0 });
        }
      }
    }

    loadOrder();

    return () => {
      active = false;
    };
  }, []);

  const createPrintView = useCallback(async () => {
    if (!order || !messages.length) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus({ type: "loading", count: messages.length });

    try {
      const token = await shopify.auth.idToken();
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const endpoint = APP_URL
        ? `${APP_URL}/api/print-order-gift-message`
        : "/api/print-order-gift-message";

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId: order.id,
          orderName: order.name,
          markPrinted,
          messages,
          selectedTemplateId: requestedTemplateId,
        }),
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!res.ok) {
        setStatus({ type: "template_error", count: messages.length });
        return;
      }

      const json = await res.json();
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (json.error || !json.found || !json.printUrl) {
        setStatus({ type: "template_error", count: messages.length });
        return;
      }

      setPrintUrl(json.printUrl);
      if (Array.isArray(json.templates)) {
        setTemplateOptions(json.templates);
      }
      if (!requestedTemplateId && json.selectedTemplateId) {
        setSelectedTemplateId(json.selectedTemplateId);
      }
      setStatus({ type: "ready", count: json.count });
    } catch (_) {
      if (requestId === requestIdRef.current) {
        setStatus({ type: "template_error", count: messages.length });
      }
    }
  }, [markPrinted, messages, order, requestedTemplateId]);

  useEffect(() => {
    createPrintView();
  }, [createPrintView]);

  const handleTemplateChange = useCallback((templateId) => {
    setSelectedTemplateId(templateId);
    setRequestedTemplateId(templateId);
  }, []);

  const printActionContent = (
    <PrintActionContent
      markPrinted={markPrinted}
      onMarkPrintedChange={setMarkPrinted}
      onTemplateChange={handleTemplateChange}
      selectedTemplateId={selectedTemplateId}
      status={status}
      templateOptions={templateOptions}
    />
  );

  const actionProps = printUrl ? { src: printUrl } : {};

  return (
    <s-admin-print-action key={printUrl || "pending"} {...actionProps}>
      {printActionContent}
    </s-admin-print-action>
  );
}

function PrintActionContent({
  markPrinted,
  onMarkPrintedChange,
  onTemplateChange,
  selectedTemplateId,
  status,
  templateOptions,
}) {
  const templateSelector =
    templateOptions.length > 0 ? (
      <TemplatePresetButtons
        onTemplateChange={onTemplateChange}
        selectedTemplateId={selectedTemplateId}
        templateOptions={templateOptions}
      />
    ) : null;

  if (status.type === "loading") {
    return (
      <s-stack gap="small">
        {templateSelector}
        <s-text>Preparing gift messages...</s-text>
        <s-text>
          Reading this order and applying the saved print template.
        </s-text>
      </s-stack>
    );
  }

  if (status.type === "not_found") {
    return (
      <s-banner tone="info" heading="No gift messages in this order">
        This order does not have a Gift Message line item property.
      </s-banner>
    );
  }

  if (status.type === "order_access_error") {
    return (
      <s-banner tone="critical" heading="Could not read the order">
        The app needs permission to read orders so it can print the Gift Message
        line item properties.
      </s-banner>
    );
  }

  if (status.type === "template_error") {
    return (
      <s-stack gap="small">
        {templateSelector}
        <s-banner tone="critical" heading="Could not create the print view">
          The order was read, but the app could not load the print template.
        </s-banner>
      </s-stack>
    );
  }

  return (
    <s-stack gap="small">
      {templateSelector}
      <s-text>
        {status.count} gift message{status.count === 1 ? "" : "s"} ready to
        print.
      </s-text>
      <s-text>
        Use the print preview above to print this order&apos;s messages.
      </s-text>
      <s-checkbox
        checked={markPrinted}
        label="Mark messages as printed after printing"
        onChange={(event) =>
          onMarkPrintedChange(Boolean(event.currentTarget.checked))
        }
      />
    </s-stack>
  );
}

function TemplatePresetButtons({
  onTemplateChange,
  selectedTemplateId,
  templateOptions,
}) {
  return (
    <s-stack gap="small">
      <s-text type="strong">Print preset</s-text>
      <div
        role="radiogroup"
        aria-label="Print preset"
        style={{
          display: "grid",
          gap: "6px",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          maxHeight: "210px",
          overflowY: "auto",
          padding: "2px",
        }}
      >
        {templateOptions.map((template) => {
          const selected = template.id === selectedTemplateId;
          const theme = getPrintTemplateTheme(template.id);

          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onTemplateChange(template.id)}
              style={{
                alignItems: "center",
                background: theme.background,
                border: `${selected ? 2 : 1.25}px solid ${
                  selected ? theme.accent : theme.border
                }`,
                borderRadius: "999px",
                boxShadow: selected
                  ? `0 0 0 2px ${theme.accent}33, 0 6px 14px rgba(51, 65, 85, 0.12)`
                  : "none",
                color: theme.text,
                cursor: "pointer",
                display: "inline-flex",
                fontFamily: theme.font,
                fontSize: "12px",
                fontWeight: "750",
                justifyContent: "center",
                lineHeight: "1.15",
                minHeight: "34px",
                minWidth: "0",
                overflow: "hidden",
                padding: "7px 10px 7px 15px",
                position: "relative",
                textAlign: "center",
                width: "100%",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  background: theme.accent,
                  bottom: 0,
                  left: 0,
                  position: "absolute",
                  top: 0,
                  width: "6px",
                }}
              />
              <span
                style={{
                  display: "block",
                  minWidth: 0,
                  overflow: "hidden",
                  position: "relative",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  zIndex: 1,
                }}
              >
                {template.name}
              </span>
            </button>
          );
        })}
      </div>
    </s-stack>
  );
}

function collectGiftMessages(order) {
  const lines = order?.lineItems?.nodes || [];
  const orderReference = clean(order?.name) || clean(order?.id);
  const orderDate = formatDate(order?.processedAt || order?.createdAt);

  return lines.flatMap((line, index) => {
    const attributes = line.customAttributes || [];
    const giftMessageValue = findGiftMessage(attributes);

    if (!giftMessageValue) {
      return [];
    }

    const parsed = parseGiftMessageProperty(giftMessageValue);
    const message = clean(parsed.message || giftMessageValue);

    if (!message) {
      return [];
    }

    return [
      {
        reference:
          findAttributeValue(attributes, GIFT_MESSAGE_REF_PROPERTY) ||
          `${orderReference || "Order"}-${index + 1}`,
        cartReference: orderReference,
        cartToken: orderReference,
        productReference: buildProductReference(line),
        sender: parsed.sender,
        recipient: parsed.recipient,
        message,
        date: orderDate,
      },
    ];
  });
}

function findGiftMessage(attributes) {
  const configuredName =
    findAttributeValue(attributes, GIFT_MESSAGE_PROPERTY_NAME) ||
    GIFT_MESSAGE_PROPERTY;

  return (
    findAttributeValue(attributes, configuredName) ||
    findAttributeValue(attributes, GIFT_MESSAGE_PROPERTY) ||
    findLooseAttributeValue(attributes, "gift message") ||
    findLooseAttributeValue(attributes, "gift_message")
  );
}

function buildProductReference(line) {
  const title = clean(line.title);
  const variantTitle = clean(line.variantTitle);
  const sku = clean(line.sku);
  const productTitle =
    title && variantTitle && !title.includes(variantTitle)
      ? `${title} - ${variantTitle}`
      : title;

  return [productTitle, sku ? `SKU: ${sku}` : ""].filter(Boolean).join(" | ");
}

function findAttributeValue(attributes, key) {
  return clean(attributes.find((item) => item.key === key)?.value);
}

function findLooseAttributeValue(attributes, key) {
  const normalizedKey = normalizeKey(key);
  return clean(
    attributes.find((item) => normalizeKey(item.key) === normalizedKey)?.value,
  );
}

function parseGiftMessageProperty(value) {
  const result = {
    sender: "",
    recipient: "",
    message: clean(value),
  };
  const messageLines = [];
  let foundStructuredLine = false;

  for (const line of String(value || "").split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;

    if (/^from:/i.test(text)) {
      result.sender = clean(text.replace(/^from:\s*/i, ""));
      foundStructuredLine = true;
      continue;
    }

    if (/^to:/i.test(text)) {
      result.recipient = clean(text.replace(/^to:\s*/i, ""));
      foundStructuredLine = true;
      continue;
    }

    if (/^message:/i.test(text)) {
      messageLines.push(text.replace(/^message:\s*/i, ""));
      foundStructuredLine = true;
      continue;
    }

    messageLines.push(text);
  }

  if (foundStructuredLine) {
    result.message = clean(messageLines.join("\n"));
  }

  return result;
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function clean(value) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : "";
}
