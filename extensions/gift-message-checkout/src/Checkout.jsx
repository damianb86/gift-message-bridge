import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

const GIFT_MESSAGE_ATTRIBUTE = "gift_message";
const GIFT_MESSAGE_FROM_ATTRIBUTE = "gift_message_from";
const GIFT_MESSAGE_TO_ATTRIBUTE = "gift_message_to";
const GIFT_MESSAGE_PROPERTY = "Gift Message";
const GIFT_MESSAGE_FROM_PROPERTY = "Gift Message From";
const GIFT_MESSAGE_TO_PROPERTY = "Gift Message To";
const GIFT_MESSAGE_PROPERTY_NAME = "_Gift Message Property";
const EMPTY_ARRAY = [];

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [attributes, setAttributes] = useSignalState(
    shopify.attributes,
    EMPTY_ARRAY,
  );
  const [lines, setLines] = useSignalState(shopify.lines, EMPTY_ARRAY);
  const checkoutMessages = collectCheckoutMessages(attributes, lines);

  return (
    <s-stack gap="base">
      <s-heading>Gift messages</s-heading>
      {checkoutMessages.length > 0 ? (
        <s-stack gap="small">
          {checkoutMessages.map((giftMessage) => (
            <s-box
              key={giftMessage.id}
              padding="base"
              border="base"
              borderRadius="base"
            >
              <s-stack gap="small-200">
                <s-text type="strong">{giftMessage.label}</s-text>
                <s-text color="subdued">{formatNames(giftMessage)}</s-text>
                <s-text>{giftMessage.message}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      ) : (
        <s-box padding="base" border="base" borderRadius="base">
          <s-stack gap="small-200">
            <s-text>
              {shopify.editor
                ? "This block will show the gift messages collected from the product page or cart."
                : "No gift messages were added to this checkout."}
            </s-text>
          </s-stack>
        </s-box>
      )}
    </s-stack>
  );
}

function useSignalState(signal, fallback) {
  const [value, setValue] = useState(() => getSignalValue(signal, fallback));

  useEffect(() => {
    if (!signal || typeof signal.subscribe !== "function") return undefined;
    return signal.subscribe((nextValue) => {
      setValue(nextValue || fallback);
    });
  }, [signal, fallback]);

  return [value, setValue];
}

function getSignalValue(signal, fallback) {
  return signal?.value ?? signal?.current ?? fallback;
}

function collectCheckoutMessages(attributes, lines) {
  const messages = [];
  const cartMessage = findAttributeValue(attributes, GIFT_MESSAGE_ATTRIBUTE);

  if (cartMessage) {
    messages.push({
      id: "cart-message",
      label: "Order message",
      message: cartMessage,
      sender: findAttributeValue(attributes, GIFT_MESSAGE_FROM_ATTRIBUTE),
      recipient: findAttributeValue(attributes, GIFT_MESSAGE_TO_ATTRIBUTE),
    });
  }

  for (const line of lines || []) {
    const lineAttributes = line.attributes || [];
    const lineMessage = findGiftMessage(lineAttributes);

    if (!lineMessage) {
      continue;
    }

    const parsedMessage = parseGiftMessageProperty(lineMessage);

    messages.push({
      id: line.id,
      label: line.merchandise?.title
        ? `Product message - ${line.merchandise.title}`
        : "Product message",
      message: parsedMessage.message || lineMessage,
      sender:
        parsedMessage.sender ||
        findAttributeValue(lineAttributes, GIFT_MESSAGE_FROM_PROPERTY),
      recipient:
        parsedMessage.recipient ||
        findAttributeValue(lineAttributes, GIFT_MESSAGE_TO_PROPERTY),
    });
  }

  return messages;
}

function formatNames(giftMessage) {
  const sender = cleanMessage(giftMessage.sender) || "Someone";
  const recipient = cleanMessage(giftMessage.recipient) || "you";
  return `From ${sender} to ${recipient}`;
}

function findGiftMessage(attributes) {
  const propertyName = findAttributeValue(
    attributes,
    GIFT_MESSAGE_PROPERTY_NAME,
  );
  const configuredName = propertyName || GIFT_MESSAGE_PROPERTY;
  const configuredProperty = findAttributeValue(
    attributes,
    GIFT_MESSAGE_PROPERTY,
  );
  const namedProperty = findAttributeValue(attributes, configuredName);

  if (namedProperty || configuredProperty) {
    return namedProperty || configuredProperty;
  }

  const fallback = attributes.find((attribute) => {
    const key = normalizeKey(attribute.key);
    return key === "gift message" || key === "gift_message";
  });

  return cleanMessage(fallback?.value);
}

function findAttributeValue(attributes, key) {
  const attribute = (attributes || []).find((item) => item.key === key);
  return cleanMessage(attribute?.value);
}

function cleanMessage(value) {
  const message = String(value || "").trim();
  return message.length > 0 ? message : "";
}

function parseGiftMessageProperty(value) {
  const result = {
    sender: "",
    recipient: "",
    message: cleanMessage(value),
  };
  const messageLines = [];
  let foundStructuredLine = false;

  for (const line of String(value || "").split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;

    if (/^from:/i.test(text)) {
      result.sender = cleanMessage(text.replace(/^from:\s*/i, ""));
      foundStructuredLine = true;
      continue;
    }

    if (/^to:/i.test(text)) {
      result.recipient = cleanMessage(text.replace(/^to:\s*/i, ""));
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
    result.message = cleanMessage(messageLines.join("\n"));
  }

  return result;
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
