/**
 * Shared template rendering utilities used by:
 *  - app/routes/app.print-setup.tsx  (dashboard print UI)
 *  - app/routes/api.print-order-gift-message.tsx  (Admin extension API)
 */

// ── Base print CSS ────────────────────────────────────────────────────────────

export const basePrintCss = `* { box-sizing: border-box; }
body { margin: 0; padding: 10mm; background: #fff; }
.print-message {
  align-items: stretch;
  break-inside: avoid;
  display: grid;
  gap: 5mm;
  grid-template-columns: 34mm auto;
  justify-content: center;
  margin: 0 auto 10mm;
  page-break-inside: avoid;
}
.print-message .gift-card { margin: 0; }
.print-meta {
  border: 1px solid #d8dbe0;
  color: #202223;
  display: grid;
  font-family: Arial, sans-serif;
  font-size: 8px;
  gap: 2mm;
  line-height: 1.35;
  padding: 4mm;
}
.print-meta-title { color: #6d7175; font-size: 7px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.print-meta-value { font-weight: 700; overflow-wrap: anywhere; }
.print-meta-muted  { color: #6d7175; overflow-wrap: anywhere; }
.names { display: flex; justify-content: space-between; margin: 4mm 0; font-size: 10px; line-height: 1.4; color: #6d7175; text-transform: uppercase; letter-spacing: .06em; }
@page { margin: 10mm; }
@media print {
  body { padding: 0; }
  .print-message, .gift-card { page-break-inside: avoid; break-inside: avoid; }
}`;

// ── Fallback template (used when no template is configured) ───────────────────

const FALLBACK_TEMPLATE_HTML = `<article class="gift-card">
  <div class="card-top">
    <span>Gift Message</span>
    <span>{{date}}</span>
  </div>
  <div class="names">
    <span>From {{from}}</span>
    <span>To {{to}}</span>
  </div>
  <p class="message">"{{message}}"</p>
</article>`;

const FALLBACK_TEMPLATE_CSS = `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 12mm;
  border: 1px solid #d8dbe0;
  font-family: Arial, sans-serif;
  color: #202223;
  break-inside: avoid;
}
.card-top {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #6d7175;
}
.message { margin: 12mm 0; font-size: 15px; line-height: 1.6; text-align: center; }`;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type TemplateMessage = {
  reference: string;
  cartReference: string;
  cartToken: string;
  productReference: string;
  sender: string;
  recipient: string;
  message: string;
  date: string;
};

/** Render a single message into the template HTML using variable substitution. */
export function renderTemplate(tpl: string, msg: TemplateMessage): string {
  return tpl
    .replace(/\{\{reference\}\}/g, escapeHtml(msg.reference))
    .replace(/\{\{cart_token\}\}/g, escapeHtml(msg.cartReference))
    .replace(/\{\{product_reference\}\}/g, escapeHtml(msg.productReference))
    .replace(/\{\{from\}\}/g, escapeHtml(msg.sender || ""))
    .replace(/\{\{to\}\}/g, escapeHtml(msg.recipient || ""))
    .replace(/\{\{message\}\}/g, escapeHtml(msg.message))
    .replace(/\{\{date\}\}/g, escapeHtml(msg.date));
}

/** Render a message with the packing-slip metadata aside column. */
export function renderPrintMessage(tpl: string, msg: TemplateMessage): string {
  return `<section class="print-message">
  <aside class="print-meta">
    <div>
      <div class="print-meta-title">Order/cart ref</div>
      <div class="print-meta-value">${escapeHtml(msg.cartReference)}</div>
    </div>
    <div>
      <div class="print-meta-title">Message ref</div>
      <div class="print-meta-value">${escapeHtml(msg.reference)}</div>
    </div>
    ${
      msg.productReference
        ? `<div>
      <div class="print-meta-title">Product</div>
      <div class="print-meta-muted">${escapeHtml(msg.productReference)}</div>
    </div>`
        : ""
    }
  </aside>
  ${renderTemplate(tpl, msg)}
</section>`;
}

/** Build a complete, self-contained print HTML document. */
export function buildPrintDocument(
  renderedMessages: string,
  templateCss: string,
  options: { autoPrint?: boolean; markPrintedUrl?: string } = {},
): string {
  const shouldAutoPrint = options.autoPrint ?? true;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Gift Messages</title>
  <style>
${basePrintCss}
${templateCss}
  </style>
</head>
<body>
${renderedMessages}
${options.markPrintedUrl ? markPrintedScript(options.markPrintedUrl) : ""}
${shouldAutoPrint ? autoPrintScript() : ""}
</body>
</html>`;
}

function markPrintedScript(url: string): string {
  const endpoint = JSON.stringify(url);

  return `<script>
  (function () {
    var marked = false;
    function markPrinted() {
      if (marked) return;
      marked = true;
      try {
        fetch(${endpoint}, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        }).catch(function () {});
      } catch (_) {}
    }
    window.addEventListener('beforeprint', markPrinted);
    if (window.matchMedia) {
      var media = window.matchMedia('print');
      if (media && media.addEventListener) {
        media.addEventListener('change', function (event) {
          if (event.matches) markPrinted();
        });
      }
    }
  })();
</script>`;
}

function autoPrintScript(): string {
  return `<script>
  window.addEventListener('load', function () {
    window.print();
    window.addEventListener('afterprint', function () { window.close(); });
  });
</script>`;
}

// ── Template resolution ───────────────────────────────────────────────────────

export type ResolvedTemplate = { html: string; css: string };

/**
 * Resolve the template to use for rendering.
 * Priority:
 *   1. Shop has saved custom HTML/CSS → use as-is
 *   2. Shop has a preset ID → the caller looks it up from the presets array
 *      and passes it in; falls back to the built-in default
 *   3. No settings → built-in fallback template
 */
export function resolveTemplate(settings: {
  customHtml?: string | null;
  customCss?: string | null;
  presetHtml?: string | null;
  presetCss?: string | null;
}): ResolvedTemplate {
  if (settings.customHtml && settings.customCss) {
    return { html: settings.customHtml, css: settings.customCss };
  }
  if (settings.presetHtml && settings.presetCss) {
    return { html: settings.presetHtml, css: settings.presetCss };
  }
  return { html: FALLBACK_TEMPLATE_HTML, css: FALLBACK_TEMPLATE_CSS };
}
