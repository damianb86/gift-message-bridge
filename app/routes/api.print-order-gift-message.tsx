/**
 * POST /api/print-order-gift-message
 *
 * Called by the Admin print action extension. The extension sends gift message
 * data extracted from the current Shopify order line item properties. This
 * endpoint only resolves the merchant's selected template and returns a
 * short-lived print URL.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  buildPrintDocument,
  renderPrintMessage,
  resolveTemplate,
  type TemplateMessage,
} from "../lib/print-template.server";
import { CUSTOM_TEMPLATE_ID, presetPrintTemplates } from "../lib/print-presets";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  return new Response(null, { status: 405, headers: CORS_HEADERS });
};

type PrintOrderRequest = {
  markPrinted?: unknown;
  orderId?: unknown;
  orderName?: unknown;
  messages?: unknown;
  selectedTemplateId?: unknown;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  let session: { shop: string };

  try {
    const result = await authenticate.admin(request);
    session = result.session;
  } catch {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  let body: PrintOrderRequest = {};
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const orderName = clean(body.orderName) || clean(body.orderId);
  const markPrinted = body.markPrinted !== false;
  const messages = sanitizeMessages(body.messages, orderName);
  const selectedTemplateId = clean(body.selectedTemplateId);

  if (messages.length === 0) {
    return Response.json({ found: false }, { headers: CORS_HEADERS });
  }

  const messageReferences = collectMessageReferences(messages);
  const template = await resolveShopTemplate(session.shop, selectedTemplateId);
  const rendered = messages
    .map((message) => renderPrintMessage(template.html, message))
    .join("\n");

  db.printJob
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  const job = await db.printJob.create({
    data: {
      shop: session.shop,
      html: "",
      messageReferences: JSON.stringify(messageReferences),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const appUrl = resolveAppUrl(request);
  const printUrl = `${appUrl}/print/${job.token}`;
  const html = buildPrintDocument(rendered, template.css, {
    autoPrint: false,
    markPrintedUrl: markPrinted ? `${appUrl}/print/${job.token}` : undefined,
  });

  await db.printJob.update({
    where: { token: job.token },
    data: { html },
  });

  return Response.json(
    {
      found: true,
      count: messages.length,
      printUrl,
      selectedTemplateId: template.id,
      templates: template.options,
    },
    { headers: CORS_HEADERS },
  );
};

function resolveAppUrl(request: Request): string {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const requestOrigin = new URL(request.url).origin;
  const configuredUrl =
    appEnv === "production"
      ? process.env.PROD_SHOPIFY_APP_URL ||
        process.env.SHOPIFY_APP_URL ||
        process.env.APP_URL ||
        requestOrigin
      : process.env.HOST || process.env.DEV_SHOPIFY_APP_URL || requestOrigin;

  return normalizeAppUrl(configuredUrl || requestOrigin);
}

function normalizeAppUrl(value: string): string {
  const rawUrl = value.trim();

  if (!rawUrl) {
    return "";
  }

  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    return `https://${rawUrl}`.replace(/\/+$/, "");
  }

  const url = new URL(rawUrl);
  if (url.protocol === "http:" && !isLocalHost(url.hostname)) {
    url.protocol = "https:";
  }

  return url.toString().replace(/\/+$/, "");
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

async function resolveShopTemplate(shop: string, requestedTemplateId = "") {
  const settings = await db.printTemplateSettings.findUnique({
    where: { shop },
  });
  const hasCustom = Boolean(settings?.customHtml && settings.customCss);
  const requestedPreset = presetPrintTemplates.find(
    (template) => template.id === requestedTemplateId,
  );

  if (requestedPreset) {
    return {
      id: requestedPreset.id,
      options: getTemplateOptions(hasCustom),
      ...resolveTemplate({
        presetHtml: requestedPreset.html,
        presetCss: requestedPreset.css,
      }),
    };
  }

  const useCustom =
    hasCustom &&
    (requestedTemplateId === CUSTOM_TEMPLATE_ID ||
      (!requestedTemplateId &&
        settings?.selectedTemplateId === CUSTOM_TEMPLATE_ID));
  const selectedPreset =
    presetPrintTemplates.find(
      (template) => template.id === settings?.selectedTemplateId,
    ) ?? presetPrintTemplates[0];

  return {
    id: useCustom ? CUSTOM_TEMPLATE_ID : selectedPreset.id,
    options: getTemplateOptions(hasCustom),
    ...resolveTemplate({
      customHtml: useCustom ? settings?.customHtml : null,
      customCss: useCustom ? settings?.customCss : null,
      presetHtml: selectedPreset.html,
      presetCss: selectedPreset.css,
    }),
  };
}

function getTemplateOptions(includeCustom: boolean) {
  const options = presetPrintTemplates.map((preset) => ({
    id: preset.id,
    name: preset.name,
  }));

  if (includeCustom) {
    options.push({ id: CUSTOM_TEMPLATE_ID, name: "Custom" });
  }

  return options;
}

function collectMessageReferences(messages: TemplateMessage[]): string[] {
  return Array.from(
    new Set(
      messages
        .map((message) => message.reference)
        .map((reference) => clean(reference))
        .filter(Boolean),
    ),
  );
}

function sanitizeMessages(
  input: unknown,
  orderName: string,
): TemplateMessage[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item, index): TemplateMessage | null => {
      const record = isRecord(item) ? item : {};
      const message = clean(record.message);
      const messageCardReference = clean(record.messageCardReference);
      const sender = clean(record.sender);
      const recipient = clean(record.recipient);

      if (!message && !messageCardReference && !sender && !recipient) {
        return null;
      }

      const reference =
        clean(record.reference) || `${orderName || "Order"}-${index + 1}`;
      const cartReference = clean(record.cartReference) || orderName;

      return {
        reference,
        cartReference,
        cartToken: clean(record.cartToken) || cartReference,
        productReference: clean(record.productReference),
        messageCardReference,
        printCopyLabel: clean(record.printCopyLabel),
        sender,
        recipient,
        message,
        date: clean(record.date) || formatDate(new Date()),
      };
    })
    .filter((message): message is TemplateMessage => Boolean(message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function clean(value: unknown): string {
  const text = String(value || "").trim();
  return text.length > 0 ? text : "";
}
