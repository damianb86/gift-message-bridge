/** @jsxImportSource preact */

/**
 * Admin UI Extension - "Print Gift Message"
 * Target: admin.order-details.print-action.render
 *
 * The order is the source of truth. We read order custom attributes and line
 * item properties, extract gift message values, and ask the app only for the
 * configured print template and a short-lived print URL.
 */

/* eslint-disable react/prop-types, react/jsx-key */

import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const LOG_PREFIX = "[GMB PrintAction]";
const PRINT_ORDER_ENDPOINT = "/api/print-order-gift-message";

const GIFT_MESSAGE_PROPERTY = "Gift Message";
const GIFT_MESSAGE_REF_PROPERTY = "Gift Message Ref";
const GIFT_MESSAGE_CARD_PROPERTY = "_Gift Message Card";
const GIFT_MESSAGE_FROM_ATTRIBUTE = "Gift Message From";
const GIFT_MESSAGE_TO_ATTRIBUTE = "Gift Message To";

const ORDER_QUERY = `#graphql
query GiftMessageOrder($id: ID!) {
  order(id: $id) {
    id
    name
    processedAt
    createdAt
    customAttributes {
      key
      value
    }
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
  logInfo("entry", {
    endpoint: PRINT_ORDER_ENDPOINT,
    jsxRuntime: "preact",
    selectedCount: shopify.data?.selected?.length ?? 0,
    target: shopify.extension?.target ?? "unknown",
  });

  render(<Extension />, document.body);
}

function Extension() {
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
      logInfo("loadOrder:start", {
        endpoint: PRINT_ORDER_ENDPOINT,
        hasOrderId: Boolean(orderId),
        selectedCount: shopify.data?.selected?.length ?? 0,
      });

      if (!orderId) {
        logWarn("loadOrder:missing-order-id", {
          selected: summarizeSelected(shopify.data?.selected),
        });
        setStatus({ type: "order_access_error", count: 0 });
        return;
      }

      try {
        const result = await shopify.query(ORDER_QUERY, {
          variables: { id: orderId },
        });

        if (!active) return;

        if (result.errors?.length || !result.data?.order) {
          logWarn("loadOrder:query-error", {
            errors: summarizeGraphQLErrors(result.errors),
            hasOrder: Boolean(result.data?.order),
          });
          setStatus({ type: "order_access_error", count: 0 });
          return;
        }

        const currentOrder = result.data.order;
        const currentMessages = collectGiftMessages(currentOrder);
        logInfo("loadOrder:success", {
          lineItems: currentOrder.lineItems?.nodes?.length ?? 0,
          messages: currentMessages.length,
          orderName: currentOrder.name,
        });

        setOrder(currentOrder);
        setMessages(currentMessages);

        if (currentMessages.length === 0) {
          logWarn("loadOrder:no-gift-messages", {
            orderName: currentOrder.name,
          });
          setStatus({ type: "not_found", count: 0 });
        }
      } catch (error) {
        logError("loadOrder:exception", error);
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
      logInfo("createPrintView:skip", {
        hasOrder: Boolean(order),
        messages: messages.length,
      });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPrintUrl(undefined);
    setStatus({ type: "loading", count: messages.length });
    logInfo("createPrintView:start", {
      endpoint: PRINT_ORDER_ENDPOINT,
      markPrinted: false,
      messages: messages.length,
      requestedTemplateId: requestedTemplateId || "(saved/default)",
    });

    try {
      const token = await shopify.auth.idToken();
      const headers = {
        "Content-Type": "application/json",
      };
      logInfo("createPrintView:id-token", {
        hasToken: Boolean(token),
      });

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(PRINT_ORDER_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId: order.id,
          orderName: order.name,
          markPrinted: false,
          messages,
          selectedTemplateId: requestedTemplateId,
        }),
      });

      if (requestId !== requestIdRef.current) {
        logInfo("createPrintView:stale-response", { requestId });
        return;
      }

      if (!res.ok) {
        logWarn("createPrintView:http-error", {
          body: await readResponseText(res),
          status: res.status,
          statusText: res.statusText,
          url: PRINT_ORDER_ENDPOINT,
        });
        setStatus({ type: "template_error", count: messages.length });
        return;
      }

      const json = await res.json();
      if (requestId !== requestIdRef.current) {
        logInfo("createPrintView:stale-json", { requestId });
        return;
      }

      if (json.error || !json.found || !json.printUrl) {
        logWarn("createPrintView:invalid-json", {
          error: json.error || "",
          found: Boolean(json.found),
          hasPrintUrl: Boolean(json.printUrl),
        });
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
      logInfo("createPrintView:success", {
        count: json.count,
        printUrl: json.printUrl,
        selectedTemplateId: json.selectedTemplateId,
        templates: Array.isArray(json.templates) ? json.templates.length : 0,
      });
    } catch (error) {
      logError("createPrintView:exception", error);
      if (requestId === requestIdRef.current) {
        setStatus({ type: "template_error", count: messages.length });
      }
    }
  }, [messages, order, requestedTemplateId]);

  useEffect(() => {
    createPrintView();
  }, [createPrintView]);

  const handleTemplateChange = useCallback((templateId) => {
    setSelectedTemplateId(templateId);
    setRequestedTemplateId(templateId);
  }, []);

  const printActionContent = (
    <PrintActionContent
      onTemplateChange={handleTemplateChange}
      selectedTemplateId={selectedTemplateId}
      status={status}
      templateOptions={templateOptions}
    />
  );

  const actionProps = printUrl ? { src: printUrl } : {};

  return (
    <s-admin-print-action {...actionProps}>
      {printActionContent}
    </s-admin-print-action>
  );
}

function PrintActionContent({
  onTemplateChange,
  selectedTemplateId,
  status,
  templateOptions,
}) {
  const templateSelector =
    templateOptions.length > 0 ? (
      <TemplatePresetSelect
        onTemplateChange={onTemplateChange}
        selectedTemplateId={selectedTemplateId}
        templateOptions={templateOptions}
      />
    ) : null;

  if (status.type === "loading") {
    return (
      <s-stack gap="base">
        {templateSelector}
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-spinner
            accessibilityLabel="Loading gift message print preview"
            size="base"
          />
          <s-text>Building print preview</s-text>
        </s-stack>
      </s-stack>
    );
  }

  if (status.type === "not_found") {
    return (
      <s-banner tone="info" heading="No gift messages in this order">
        This order does not have a Gift Message order attribute or line item
        property.
      </s-banner>
    );
  }

  if (status.type === "order_access_error") {
    return (
      <s-banner tone="critical" heading="Could not read the order">
        The app needs permission to read orders so it can print the Gift Message
        order attributes and line item properties.
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
    <s-stack gap="base">
      {templateSelector}
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-badge tone="success" size="large">
          Ready
        </s-badge>
        <s-text>{formatReadyMessage(status.count)}</s-text>
      </s-stack>
    </s-stack>
  );
}

function TemplatePresetSelect({
  onTemplateChange,
  selectedTemplateId,
  templateOptions,
}) {
  const selectedValue = selectedTemplateId || templateOptions[0]?.id || "";

  return (
    <s-stack gap="small">
      <s-select
        label="Gift note preset"
        details="Choose the design for this print preview."
        value={selectedValue}
        onChange={(event) => onTemplateChange(getValueFromEvent(event))}
      >
        {templateOptions.map((template) => (
          <s-option value={template.id}>{template.name}</s-option>
        ))}
      </s-select>
    </s-stack>
  );
}

function getValueFromEvent(event) {
  return clean(event?.currentTarget?.value ?? event?.target?.value);
}

function formatReadyMessage(count) {
  return `${count} gift message${count === 1 ? "" : "s"} ready to print`;
}

function collectGiftMessages(order) {
  const lines = order?.lineItems?.nodes || [];
  const orderReference = clean(order?.name) || clean(order?.id);
  const orderDate = formatDate(order?.processedAt || order?.createdAt);
  const orderMessages = collectOrderGiftMessages(
    order?.customAttributes || [],
    orderReference,
    orderDate,
  );
  const lineMessages = lines.flatMap((line, index) =>
    collectLineGiftMessages(line, index, orderReference, orderDate),
  );

  return dedupeGiftMessages([...orderMessages, ...lineMessages]);
}

function collectOrderGiftMessages(attributes, orderReference, orderDate) {
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
        findLooseAttributeValue(attributes, "gift_order_reference") ||
        orderReference,
      cartReference: orderReference,
      cartToken: orderReference,
      productReference: "Cart gift message",
      sender:
        findAttributeValue(attributes, GIFT_MESSAGE_FROM_ATTRIBUTE) ||
        findLooseAttributeValue(attributes, "gift_message_from") ||
        parsed.sender,
      recipient:
        findAttributeValue(attributes, GIFT_MESSAGE_TO_ATTRIBUTE) ||
        findLooseAttributeValue(attributes, "gift_message_to") ||
        parsed.recipient,
      message,
      date: orderDate,
    },
  ];
}

function collectLineGiftMessages(line, index, orderReference, orderDate) {
  const attributes = line.customAttributes || [];
  const giftMessageValue = findGiftMessage(attributes);
  const giftMessageCardSource = findAttributeValue(
    attributes,
    GIFT_MESSAGE_CARD_PROPERTY,
  );

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
      isMessageCardAddon: Boolean(giftMessageCardSource),
      productReference: giftMessageCardSource || buildProductReference(line),
      sender: parsed.sender,
      recipient: parsed.recipient,
      message,
      date: orderDate,
    },
  ];
}

function findGiftMessage(attributes) {
  return (
    findAttributeValue(attributes, GIFT_MESSAGE_PROPERTY) ||
    findLooseAttributeValue(attributes, "gift message") ||
    findLooseAttributeValue(attributes, "gift_message")
  );
}

function dedupeGiftMessages(messages) {
  const byKey = new Map();
  const orderedKeys = [];
  const passthrough = [];

  for (const message of messages) {
    const reference = clean(message.reference);
    const key =
      reference ||
      `${clean(message.sender)}:${clean(message.recipient)}:${clean(message.message)}`;

    if (!key) {
      passthrough.push(message);
      continue;
    }

    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, message);
      orderedKeys.push(key);
      continue;
    }

    if (current.isMessageCardAddon && !message.isMessageCardAddon) {
      byKey.set(key, message);
    }
  }

  return [
    ...passthrough,
    ...orderedKeys.map((key) => byKey.get(key)).filter(Boolean),
  ].map((message) => {
    const printableMessage = { ...message };
    delete printableMessage.isMessageCardAddon;
    return printableMessage;
  });
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

function summarizeSelected(selected) {
  return Array.isArray(selected)
    ? selected.map((item) => ({ id: item?.id || "" })).slice(0, 5)
    : [];
}

function summarizeGraphQLErrors(errors) {
  return Array.isArray(errors)
    ? errors.map((error) => ({
        message: error?.message || String(error || ""),
      }))
    : [];
}

async function readResponseText(response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch (error) {
    return `Could not read response body: ${describeError(error).message}`;
  }
}

function describeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error || "Unknown error"),
    name: "Unknown",
  };
}

function logInfo(step, details = {}) {
  console.info(LOG_PREFIX, step, details);
}

function logWarn(step, details = {}) {
  console.warn(LOG_PREFIX, step, details);
}

function logError(step, error) {
  console.error(LOG_PREFIX, step, describeError(error));
}
