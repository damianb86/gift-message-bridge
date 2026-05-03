/**
 * GET /print/:token
 *
 * Public route (no Shopify auth) that serves a short-lived printable HTML page.
 * The token is the auth mechanism and expires in 10 minutes. The URL must stay
 * reusable during that window because Shopify Admin print actions can load the
 * same source once for preview and again for the actual print operation.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import db from "../db.server";

const PRINT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PRINT_HEADERS = {
  ...PRINT_CORS_HEADERS,
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "text/html; charset=utf-8",
};

const PRINT_JSON_HEADERS = {
  ...PRINT_CORS_HEADERS,
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: PRINT_HEADERS,
    });
  }

  const token = String(params.token ?? "").trim();

  if (!token) {
    return expiredResponse();
  }

  const job = await db.printJob.findUnique({ where: { token } });

  if (!job) {
    return expiredResponse();
  }

  if (job.expiresAt < new Date()) {
    await db.printJob.delete({ where: { token } }).catch(() => {});
    return expiredResponse();
  }

  // Serve the rendered print HTML
  return new Response(job.html, {
    headers: PRINT_HEADERS,
  });
};

export const action = async ({ params }: ActionFunctionArgs) => {
  const token = String(params.token ?? "").trim();

  if (!token) {
    return Response.json(
      { ok: false, error: "missing token" },
      { status: 400, headers: PRINT_JSON_HEADERS },
    );
  }

  const job = await db.printJob.findUnique({ where: { token } });

  if (!job || job.expiresAt < new Date()) {
    return Response.json(
      { ok: false, error: "expired" },
      { status: 410, headers: PRINT_JSON_HEADERS },
    );
  }

  if (job.printedMarkedAt) {
    return Response.json(
      { ok: true, count: 0, alreadyMarked: true },
      { headers: PRINT_JSON_HEADERS },
    );
  }

  const references = parseReferences(job.messageReferences);
  let count = 0;

  if (references.length > 0) {
    const result = await db.giftMessage.updateMany({
      where: {
        shop: job.shop,
        sourceId: { in: references },
      },
      data: { printed: true },
    });
    count = result.count;
  }

  await db.printJob.update({
    where: { token },
    data: { printedMarkedAt: new Date() },
  });

  return Response.json({ ok: true, count }, { headers: PRINT_JSON_HEADERS });
};

function expiredResponse(): Response {
  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Print link expired</title>
<style>
  body { font-family: Arial, sans-serif; display: flex; align-items: center;
         justify-content: center; min-height: 100vh; margin: 0; color: #202223; }
  .box { text-align: center; max-width: 360px; padding: 2rem; }
  h1 { font-size: 1.25rem; }
  p  { color: #6d7175; font-size: .9rem; }
</style>
</head>
<body>
  <div class="box">
    <h1>Print link expired</h1>
    <p>This link is valid for 10 minutes.
       Please go back to the order in the Shopify admin and click
       "Print gift message" again.</p>
  </div>
</body>
</html>`,
    {
      status: 410,
      headers: PRINT_HEADERS,
    },
  );
}

function parseReferences(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}
