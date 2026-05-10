import type { LoaderFunctionArgs } from "react-router";

const PRINT_DIAGNOSTIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "text/html; charset=utf-8",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: PRINT_DIAGNOSTIC_HEADERS,
    });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "loading";

  return new Response(renderDiagnosticPrintPage(status), {
    headers: PRINT_DIAGNOSTIC_HEADERS,
  });
};

function renderDiagnosticPrintPage(status: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gift message print diagnostic</title>
  <style>
    body {
      align-items: center;
      color: #334155;
      display: flex;
      font-family: Arial, sans-serif;
      justify-content: center;
      margin: 0;
      min-height: 100vh;
      padding: 24px;
    }
    .box {
      border: 1px solid rgba(79, 175, 143, 0.28);
      border-radius: 14px;
      max-width: 420px;
      padding: 24px;
      text-align: center;
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { color: #64748b; font-size: 13px; line-height: 1.5; margin: 0; }
    code { color: #334155; font-weight: 700; }
  </style>
</head>
<body>
  <main class="box">
    <h1>Preparing gift message print preview</h1>
    <p>Status: <code>${escapeHtml(status)}</code>. If this does not update, open the browser console and copy the <code>[GMB PrintAction]</code> logs.</p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
