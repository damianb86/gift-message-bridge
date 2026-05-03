/**
 * Admin UI Extension - "Print Gift Message"
 * Target: admin.order-details.print-action.render
 *
 * The order is the source of truth. We read the current order line item
 * properties, extract the combined "Gift Message" value, and ask the app only
 * for the configured print template and a short-lived print URL.
 */

/* global __APP_URL__ */

import {
  extension,
  AdminPrintAction,
  Banner,
  BlockStack,
  Checkbox,
  Text,
} from "@shopify/ui-extensions/admin";

const APP_URL =
  typeof __APP_URL__ !== "undefined" && __APP_URL__ ? __APP_URL__ : "";

const GIFT_MESSAGE_PROPERTY = "Gift Message";
const GIFT_MESSAGE_PROPERTY_NAME = "_Gift Message Property";
const GIFT_MESSAGE_REF_PROPERTY = "Gift Message Ref";
const GIFT_ORDER_REF_PROPERTY = "Gift Order Ref";
const GIFT_PRODUCT_REF_PROPERTY = "Gift Product Ref";

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

export default extension(
  "admin.order-details.print-action.render",
  (root, api) => {
    const contentArea = root.createComponent(BlockStack, { gap: "base" });
    const printAction = root.createComponent(AdminPrintAction, {}, contentArea);
    let markPrinted = true;
    let currentOrder = null;
    let currentMessages = [];

    root.appendChild(printAction);

    function showLoading() {
      printAction.updateProps({ src: undefined });
      contentArea.replaceChildren(
        root.createComponent(
          BlockStack,
          { gap: "small" },
          root.createComponent(
            Text,
            {},
            root.createText("Preparing gift messages..."),
          ),
          root.createComponent(
            Text,
            {},
            root.createText(
              "Reading this order and applying the saved print template.",
            ),
          ),
        ),
      );
    }

    function showReady(count, printUrl) {
      printAction.updateProps({ src: printUrl });
      contentArea.replaceChildren(
        root.createComponent(
          BlockStack,
          { gap: "small" },
          root.createComponent(
            Text,
            {},
            root.createText(
              `${count} gift message${count === 1 ? "" : "s"} ready to print.`,
            ),
          ),
          root.createComponent(
            Text,
            {},
            root.createText(
              "Use the print preview above to print this order's messages.",
            ),
          ),
          root.createComponent(Checkbox, {
            checked: markPrinted,
            label: "Mark messages as printed after printing",
            onChange: (checked) => {
              markPrinted = checked;
              createPrintView(currentOrder, currentMessages);
            },
          }),
        ),
      );
    }

    function showNotFound() {
      printAction.updateProps({ src: undefined });
      contentArea.replaceChildren(
        root.createComponent(
          Banner,
          { tone: "info", title: "No gift messages in this order" },
          root.createText(
            "This order does not have a Gift Message line item property.",
          ),
        ),
      );
    }

    function showOrderAccessError() {
      printAction.updateProps({ src: undefined });
      contentArea.replaceChildren(
        root.createComponent(
          Banner,
          { tone: "critical", title: "Could not read the order" },
          root.createText(
            "The app needs permission to read orders so it can print the Gift Message line item properties.",
          ),
        ),
      );
    }

    function showTemplateError() {
      printAction.updateProps({ src: undefined });
      contentArea.replaceChildren(
        root.createComponent(
          Banner,
          { tone: "critical", title: "Could not create the print view" },
          root.createText(
            "The order was read, but the app could not load the print template.",
          ),
        ),
      );
    }

    async function load() {
      showLoading();

      const orderId = api.data?.selected?.[0]?.id ?? "";
      if (!orderId) {
        showOrderAccessError();
        return;
      }

      try {
        const result = await api.query(ORDER_QUERY, {
          variables: { id: orderId },
        });

        if (result.errors?.length || !result.data?.order) {
          showOrderAccessError();
          return;
        }

        currentOrder = result.data.order;
      } catch (_) {
        showOrderAccessError();
        return;
      }

      currentMessages = collectGiftMessages(currentOrder);
      if (currentMessages.length === 0) {
        showNotFound();
        return;
      }

      createPrintView(currentOrder, currentMessages);
    }

    async function createPrintView(order, messages) {
      if (!order || !messages?.length) {
        showTemplateError();
        return;
      }

      try {
        const token = await api.auth.idToken();
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
          showTemplateError();
          return;
        }

        const json = await res.json();
        if (json.error || !json.found || !json.printUrl) {
          showTemplateError();
          return;
        }

        showReady(json.count, json.printUrl);
      } catch (_) {
        showTemplateError();
      }
    }

    load();
  },
);

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
        cartReference:
          findAttributeValue(attributes, GIFT_ORDER_REF_PROPERTY) ||
          orderReference,
        cartToken:
          findAttributeValue(attributes, GIFT_ORDER_REF_PROPERTY) ||
          orderReference,
        productReference: buildProductReference(line, attributes),
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

function buildProductReference(line, attributes) {
  const savedReference = findAttributeValue(
    attributes,
    GIFT_PRODUCT_REF_PROPERTY,
  );
  if (savedReference) {
    return savedReference;
  }

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
