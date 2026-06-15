import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { parseCardProductConfig } from "../lib/card-products";

// Shopify forwards /apps/gift-message → {app_url}/proxy/gift-message
// The HMAC on the request is verified by authenticate.public.appProxy.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const intent = url.searchParams.get("intent") ?? "";

  if (intent === "card-products") {
    const shop = session?.shop ?? url.searchParams.get("shop") ?? "";

    if (!shop) {
      return jsonResponse({ error: "shop missing" }, 400);
    }

    const settings = await db.cardProductSettings.findUnique({
      where: { shop },
    });

    return jsonResponse({
      product: parseCardProductConfig(settings?.productsJson),
    });
  }

  return new Response("OK", { status: 200 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  // `shop` is always present in the proxy query string even without a session.
  const url = new URL(request.url);
  const shop = session?.shop ?? url.searchParams.get("shop") ?? "";

  if (!shop) {
    return new Response(JSON.stringify({ error: "shop missing" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    message?: string;
    sender?: string;
    recipient?: string;
    cart_token?: string;
    cart_reference?: string;
    message_id?: string;
    mode?: string;
    product_id?: string;
    product_title?: string;
    product_variant_title?: string;
    product_sku?: string;
    product_handle?: string;
    message_card_product_title?: string;
    message_card_variant_title?: string;
    message_card_variant_id?: string;
    message_card_sku?: string;
    message_card_quantity?: number | string;
    message_card_reference?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = String(body?.message ?? "").slice(0, 1000);
  const sender = String(body?.sender ?? "").slice(0, 250);
  const recipient = String(body?.recipient ?? "").slice(0, 250);
  const cartToken = String(body?.cart_token ?? "").trim();
  const cartReference = String(body?.cart_reference ?? "").trim() || null;
  const messageId = String(body?.message_id ?? "").trim();
  const mode = String(body?.mode ?? "order");
  const productId = String(body?.product_id ?? "").trim() || null;
  const productTitle =
    String(body?.product_title ?? "")
      .trim()
      .slice(0, 500) || null;
  const productVariantTitle =
    String(body?.product_variant_title ?? "")
      .trim()
      .slice(0, 500) || null;
  const productSku =
    String(body?.product_sku ?? "")
      .trim()
      .slice(0, 250) || null;
  const productHandle =
    String(body?.product_handle ?? "")
      .trim()
      .slice(0, 250) || null;
  const messageCardProductTitle =
    String(body?.message_card_product_title ?? "")
      .trim()
      .slice(0, 500) || null;
  const messageCardVariantTitle =
    String(body?.message_card_variant_title ?? "")
      .trim()
      .slice(0, 500) || null;
  const messageCardVariantId =
    String(body?.message_card_variant_id ?? "")
      .trim()
      .slice(0, 250) || null;
  const messageCardSku =
    String(body?.message_card_sku ?? "")
      .trim()
      .slice(0, 250) || null;
  const messageCardQuantity = parsePositiveQuantity(
    body?.message_card_quantity,
  );
  const messageCardReference =
    String(body?.message_card_reference ?? "")
      .trim()
      .slice(0, 1000) || null;
  const sourceId =
    mode === "product"
      ? messageId || `product:${cartToken}`
      : `cart:${cartToken}`;

  if (!cartToken && !messageId) {
    return new Response(
      JSON.stringify({ error: "message reference missing" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  await db.giftMessage.upsert({
    where: { shop_sourceId: { shop, sourceId } },
    create: {
      shop,
      cartToken: cartToken || sourceId,
      cartReference,
      sourceId,
      message,
      sender,
      recipient,
      mode,
      productId,
      productTitle,
      productVariantTitle,
      productSku,
      productHandle,
      messageCardProductTitle,
      messageCardVariantTitle,
      messageCardVariantId,
      messageCardSku,
      messageCardQuantity,
      messageCardReference,
    },
    update: {
      cartToken: cartToken || sourceId,
      cartReference,
      message,
      sender,
      recipient,
      mode,
      productId,
      productTitle,
      productVariantTitle,
      productSku,
      productHandle,
      messageCardProductTitle,
      messageCardVariantTitle,
      messageCardVariantId,
      messageCardSku,
      messageCardQuantity,
      messageCardReference,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

function parsePositiveQuantity(value: unknown): number {
  const quantity = Number.parseInt(String(value ?? "1"), 10);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}
