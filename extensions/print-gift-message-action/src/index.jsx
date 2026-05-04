/**
 * Admin UI Extension - "Print Gift Message"
 * Target: admin.order-details.print-action.render
 *
 * The order is the source of truth. We read the current order line item
 * properties, extract the combined "Gift Message" value, and ask the app only
 * for the configured print template and a short-lived print URL.
 */

/* global __APP_URL__ */

import { render } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

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
  const [status, setStatus] = useState({
    type: "loading",
    count: 0,
  });

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

    setStatus({ type: "loading", count: messages.length });
    setPrintUrl(undefined);

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
        }),
      });

      if (!res.ok) {
        setStatus({ type: "template_error", count: messages.length });
        return;
      }

      const json = await res.json();
      if (json.error || !json.found || !json.printUrl) {
        setStatus({ type: "template_error", count: messages.length });
        return;
      }

      setPrintUrl(json.printUrl);
      setStatus({ type: "ready", count: json.count });
    } catch (_) {
      setStatus({ type: "template_error", count: messages.length });
    }
  }, [markPrinted, messages, order]);

  useEffect(() => {
    createPrintView();
  }, [createPrintView]);

  return (
    <s-admin-print-action src={printUrl}>
      <PrintActionContent
        markPrinted={markPrinted}
        onMarkPrintedChange={setMarkPrinted}
        status={status}
      />
    </s-admin-print-action>
  );
}

function PrintActionContent({ markPrinted, onMarkPrintedChange, status }) {
  if (status.type === "loading") {
    return (
      <s-stack gap="small">
        <s-text>Preparing gift messages...</s-text>
        <s-text>Reading this order and applying the saved print template.</s-text>
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
      <s-banner tone="critical" heading="Could not create the print view">
        The order was read, but the app could not load the print template.
      </s-banner>
    );
  }

  return (
    <s-stack gap="small">
      <s-text>
        {status.count} gift message{status.count === 1 ? "" : "s"} ready to
        print.
      </s-text>
      <s-text>Use the print preview above to print this order's messages.</s-text>
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
