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

  if (messages.length === 0) {
    return Response.json({ found: false }, { headers: CORS_HEADERS });
  }

  const messageReferences = collectMessageReferences(messages);
  const template = await resolveShopTemplate(session.shop);
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

  const appUrl = process.env.SHOPIFY_APP_URL ?? process.env.APP_URL ?? "";
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
    { found: true, count: messages.length, printUrl },
    { headers: CORS_HEADERS },
  );
};

async function resolveShopTemplate(shop: string) {
  const settings = await db.printTemplateSettings.findUnique({
    where: { shop },
  });
  const useCustom =
    settings?.selectedTemplateId === CUSTOM_TEMPLATE_ID &&
    settings.customHtml &&
    settings.customCss;
  const selectedPreset =
    presetPrintTemplates.find(
      (template) => template.id === settings?.selectedTemplateId,
    ) ?? presetPrintTemplates[0];

  return resolveTemplate({
    customHtml: useCustom ? settings.customHtml : null,
    customCss: useCustom ? settings.customCss : null,
    presetHtml: selectedPreset.html,
    presetCss: selectedPreset.css,
  });
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
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      const message = clean(record.message);

      if (!message) {
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
        sender: clean(record.sender),
        recipient: clean(record.recipient),
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
