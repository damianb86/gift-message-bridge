import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Shopify forwards /apps/gift-message → {app_url}/proxy/gift-message
// The HMAC on the request is verified by authenticate.public.appProxy.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
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
    property_name?: string;
    product_id?: string;
    product_title?: string;
    product_variant_title?: string;
    product_sku?: string;
    product_handle?: string;
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
  const propertyName = String(body?.property_name ?? "").trim() || null;
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
      propertyName,
      productId,
      productTitle,
      productVariantTitle,
      productSku,
      productHandle,
    },
    update: {
      cartToken: cartToken || sourceId,
      cartReference,
      message,
      sender,
      recipient,
      mode,
      propertyName,
      productId,
      productTitle,
      productVariantTitle,
      productSku,
      productHandle,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
