import {
  BlockStack,
  Heading,
  Text,
  TextBlock,
  View,
  extension,
} from "@shopify/ui-extensions/checkout";

const GIFT_MESSAGE_ATTRIBUTE = "gift_message";
const GIFT_MESSAGE_FROM_ATTRIBUTE = "gift_message_from";
const GIFT_MESSAGE_TO_ATTRIBUTE = "gift_message_to";
const GIFT_MESSAGE_PROPERTY = "Gift Message";
const GIFT_MESSAGE_FROM_PROPERTY = "Gift Message From";
const GIFT_MESSAGE_TO_PROPERTY = "Gift Message To";
const GIFT_MESSAGE_PROPERTY_NAME = "_Gift Message Property";

export default extension("purchase.checkout.block.render", (root, api) => {
  const renderMessages = () => {
    const checkoutMessages = collectCheckoutMessages(api);

    if (checkoutMessages.length === 0) {
      root.replaceChildren(createEmptyState(root, api));
      return;
    }

    root.replaceChildren(createMessageBlock(root, checkoutMessages));
  };

  renderMessages();

  const unsubscribeAttributes = api.attributes.subscribe(renderMessages);
  const unsubscribeLines = api.lines.subscribe(renderMessages);

  return () => {
    unsubscribeAttributes();
    unsubscribeLines();
  };
});

function createMessageBlock(root, checkoutMessages) {
  const cards = checkoutMessages.map((giftMessage) =>
    root.createComponent(
      View,
      {
        padding: "base",
        border: "base",
        cornerRadius: "base",
      },
      root.createComponent(
        BlockStack,
        { spacing: "extraTight" },
        root.createComponent(
          Text,
          { emphasis: "bold" },
          root.createText(giftMessage.label),
        ),
        root.createComponent(
          Text,
          { appearance: "subdued" },
          root.createText(formatNames(giftMessage)),
        ),
        root.createComponent(
          TextBlock,
          null,
          root.createText(giftMessage.message),
        ),
      ),
    ),
  );

  return root.createComponent(
    BlockStack,
    { spacing: "base" },
    root.createComponent(Heading, null, root.createText("Gift messages")),
    root.createComponent(BlockStack, { spacing: "tight" }, cards),
  );
}

function createEmptyState(root, api) {
  const text = api.editor
    ? "This block will show the gift messages collected from the product page or cart."
    : "No gift messages were added to this checkout.";

  return root.createComponent(
    View,
    {
      padding: "base",
      border: "base",
      cornerRadius: "base",
    },
    root.createComponent(
      BlockStack,
      { spacing: "extraTight" },
      root.createComponent(Heading, null, root.createText("Gift messages")),
      root.createComponent(TextBlock, null, root.createText(text)),
    ),
  );
}

function collectCheckoutMessages(api) {
  const messages = [];
  const attributes = getSubscribableValue(api.attributes) || [];
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

  for (const line of getSubscribableValue(api.lines) || []) {
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

function getSubscribableValue(subscribable) {
  return subscribable.value ?? subscribable.current;
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
  const attribute = attributes.find((item) => item.key === key);
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
