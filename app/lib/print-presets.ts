// ── Template HTML strings ────────────────────────────────────────────────────
// Variables: {{from}} {{to}} {{message}} {{date}} {{reference}} {{cart_token}}

/** From/To side-by-side BEFORE message (classic layout, unchanged) */
export const templateHtml = `<article class="gift-card">
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

/**
 * IMPROVED: From introduced before message, To right-aligned AFTER message.
 * Reads like a letter: author first, then the content, addressee last.
 */
export const noteHtml = `<article class="gift-card">
  <p class="kicker">A note for you</p>
  <p class="from">From {{from}}</p>
  <p class="message">"{{message}}"</p>
  <div class="card-foot">
    <span>{{date}}</span>
    <span class="to">To {{to}}</span>
  </div>
</article>`;

/**
 * IMPROVED: date + From in the kicker line, message as body,
 * To right-aligned in the footer — after reading the message.
 */
export const splitHtml = `<article class="gift-card">
  <aside class="side">Gift</aside>
  <main>
    <p class="kicker">From {{from}}</p>
    <p class="message">"{{message}}"</p>
    <div class="foot">
      <span class="meta">{{date}}</span>
      <span class="to">To {{to}}</span>
    </div>
  </main>
</article>`;

/**
 * IMPROVED: stamp decorative element + From in kicker, message as body,
 * To right-aligned after message.
 */
export const stampHtml = `<article class="gift-card">
  <div class="stamp">Gift</div>
  <p class="kicker">From {{from}}</p>
  <p class="message">"{{message}}"</p>
  <div class="foot">
    <span class="meta">{{date}}</span>
    <span class="to">To {{to}}</span>
  </div>
</article>`;

export const CUSTOM_TEMPLATE_ID = "custom";

export type PrintTemplate = {
  id: string;
  name: string;
  html: string;
  css: string;
};

export const presetPrintTemplates: PrintTemplate[] = [
  // 1 ── Classic note (templateHtml — From/To side-by-side, unchanged)
  {
    id: "classic-note",
    name: "Classic note",
    html: templateHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 12mm;
  border: 1px solid #d8dbe0;
  font-family: Arial, sans-serif;
  color: #202223;
  break-inside: avoid;
}
.card-top, .card-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #6d7175;
}
.message {
  margin: 12mm 0;
  font-size: 15px;
  line-height: 1.6;
  text-align: center;
}`,
  },

  // 2 ── Fine border (noteHtml — IMPROVED: From before, To right-aligned after)
  {
    id: "fine-border",
    name: "Fine border",
    html: noteHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 10mm;
  border: 3px double #202223;
  font-family: Georgia, serif;
  color: #202223;
  break-inside: avoid;
}
.kicker {
  margin: 0 0 5mm;
  font-size: 10px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: .16em;
}
.from {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #6d7175;
  margin: 0 0 6mm;
}
.message {
  font-size: 16px;
  line-height: 1.7;
  text-align: center;
  margin: 0 0 6mm;
}
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 9px;
  color: #6d7175;
}
.to {
  font-size: 11px;
  font-weight: 700;
  color: #202223;
}`,
  },

  // 3 ── Soft floral (templateHtml — From/To side-by-side, unchanged)
  {
    id: "soft-floral",
    name: "Soft floral",
    html: templateHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 11mm;
  border: 1px solid #efd3dc;
  background:
    radial-gradient(circle at 8mm 8mm, #f2a9bd 0 2mm, transparent 2.3mm),
    radial-gradient(circle at 14mm 10mm, #c9dfc7 0 2mm, transparent 2.3mm),
    radial-gradient(circle at calc(100% - 8mm) calc(100% - 8mm), #f2a9bd 0 2mm, transparent 2.3mm),
    #fffafa;
  print-color-adjust: exact;
  font-family: Georgia, serif;
  color: #3d2f35;
  break-inside: avoid;
}
.card-top, .card-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #7b646e;
}
.message {
  margin: 12mm 0;
  font-size: 16px;
  line-height: 1.65;
  text-align: center;
}`,
  },

  // 4 ── Airmail stripe (stampHtml — IMPROVED: From in kicker, To right-aligned after)
  {
    id: "airmail",
    name: "Airmail stripe",
    html: stampHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 10mm;
  border: 5px solid transparent;
  border-image: repeating-linear-gradient(45deg, #cf3d35 0 7px, #fff 7px 14px, #2f6fbe 14px 21px, #fff 21px 28px) 12;
  font-family: Arial, sans-serif;
  color: #1f2937;
  break-inside: avoid;
}
.stamp {
  float: right;
  padding: 3mm 4mm;
  border: 1px dashed #2f6fbe;
  color: #2f6fbe;
  font-size: 11px;
  text-transform: uppercase;
}
.kicker {
  font-size: 9px;
  color: #5b6472;
  text-transform: uppercase;
  letter-spacing: .08em;
  clear: both;
  margin: 0 0 5mm;
}
.message {
  font-size: 15px;
  line-height: 1.6;
  margin: 0 0 5mm;
}
.foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.meta {
  font-size: 9px;
  color: #5b6472;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.to {
  font-size: 11px;
  font-weight: 700;
}`,
  },

  // 5 ── Modern ribbon (splitHtml — IMPROVED: From in kicker, To right-aligned after)
  {
    id: "modern-ribbon",
    name: "Modern ribbon",
    html: splitHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  display: grid;
  grid-template-columns: 17mm 1fr;
  border: 1px solid #d8dbe0;
  font-family: Arial, sans-serif;
  color: #202223;
  break-inside: avoid;
}
.side {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f766e;
  color: white;
  text-transform: uppercase;
  letter-spacing: .16em;
  writing-mode: vertical-rl;
  print-color-adjust: exact;
}
main { padding: 10mm; }
.kicker {
  font-size: 9px;
  color: #6d7175;
  margin: 0 0 4mm;
}
.message {
  font-size: 16px;
  line-height: 1.6;
  margin: 0 0 4mm;
}
.foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.meta { font-size: 9px; color: #6d7175; }
.to { font-size: 10px; font-weight: 700; }`,
  },

  // 6 ── Terrazzo (templateHtml — From/To side-by-side, unchanged)
  {
    id: "terrazzo",
    name: "Terrazzo",
    html: templateHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 11mm;
  background:
    radial-gradient(circle at 12mm 9mm, #f4a261 0 1.5mm, transparent 1.7mm),
    radial-gradient(circle at 74mm 18mm, #2a9d8f 0 1.4mm, transparent 1.6mm),
    radial-gradient(circle at 20mm 45mm, #e76f51 0 1.2mm, transparent 1.4mm),
    radial-gradient(circle at 64mm 48mm, #457b9d 0 1.6mm, transparent 1.8mm),
    #fffdf8;
  border: 1px solid #eadfd2;
  print-color-adjust: exact;
  font-family: Arial, sans-serif;
  color: #24313f;
  break-inside: avoid;
}
.card-top, .card-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  font-weight: 700;
}
.message { margin: 13mm 0; font-size: 15px; line-height: 1.6; }`,
  },

  // 7 ── Celebration (noteHtml — IMPROVED: From before, To right-aligned after)
  {
    id: "celebration",
    name: "Celebration",
    html: noteHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 10mm;
  background:
    linear-gradient(135deg, #ffe066 0 8mm, transparent 8mm),
    linear-gradient(315deg, #ff6b6b 0 8mm, transparent 8mm),
    #ffffff;
  border: 2px solid #202223;
  print-color-adjust: exact;
  font-family: Arial, sans-serif;
  color: #202223;
  break-inside: avoid;
}
.kicker {
  margin: 0 0 4mm;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .14em;
  font-size: 10px;
}
.from {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #6d7175;
  margin: 0 0 6mm;
}
.message { margin: 0 0 8mm; font-size: 17px; line-height: 1.55; }
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 9px;
  color: #6d7175;
}
.to { font-size: 11px; font-weight: 700; color: #202223; }`,
  },

  // 8 ── Luxury band (splitHtml — IMPROVED: From in kicker, To right-aligned after)
  {
    id: "luxury-band",
    name: "Luxury band",
    html: splitHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  display: grid;
  grid-template-columns: 22mm 1fr;
  background: #111827;
  color: #f8fafc;
  font-family: Georgia, serif;
  print-color-adjust: exact;
  break-inside: avoid;
}
.side {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #c8a96a;
  color: #111827;
  text-transform: uppercase;
  letter-spacing: .18em;
  writing-mode: vertical-rl;
}
main { padding: 10mm; }
.kicker { color: #cbd5e1; font-size: 9px; margin: 0 0 4mm; }
.message { font-size: 16px; line-height: 1.65; margin: 0 0 4mm; }
.foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.meta { color: #cbd5e1; font-size: 9px; }
.to { font-size: 10px; font-weight: 700; color: #c8a96a; }`,
  },

  // 9 ── Botanical line (templateHtml — From/To side-by-side, unchanged)
  {
    id: "botanical-line",
    name: "Botanical line",
    html: templateHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 12mm;
  border: 1px solid #91a78f;
  font-family: Georgia, serif;
  color: #253126;
  position: relative;
  break-inside: avoid;
}
.gift-card:before {
  content: "";
  position: absolute;
  inset: 4mm;
  border: 1px solid #d8e2d3;
}
.card-top, .card-foot, .message { position: relative; }
.card-top, .card-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #5f725c;
}
.message { margin: 12mm 0; font-size: 16px; line-height: 1.7; text-align: center; }`,
  },

  // 10 ── Round label (stampHtml — IMPROVED: From in kicker, To right-aligned after)
  {
    id: "round-label",
    name: "Round label",
    html: stampHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 10mm;
  border: 1px solid #d8dbe0;
  font-family: Arial, sans-serif;
  color: #202223;
  break-inside: avoid;
}
.stamp {
  width: 22mm;
  height: 22mm;
  border-radius: 50%;
  background: #805ad5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  letter-spacing: .1em;
  font-size: 10px;
  float: right;
  print-color-adjust: exact;
}
.kicker {
  font-size: 9px;
  color: #6d7175;
  text-transform: uppercase;
  letter-spacing: .08em;
  margin: 0 0 4mm;
}
.message { margin: 6mm 0; font-size: 16px; line-height: 1.6; clear: both; }
.foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.meta { font-size: 9px; color: #6d7175; }
.to { font-size: 11px; font-weight: 700; }`,
  },

  {
    id: "minimal-serif",
    name: "Minimal serif",
    html: noteHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 13mm; border: 1px solid #ece7df; font-family: Georgia, serif; color: #292524; break-inside: avoid; }
.kicker { margin: 0 0 6mm; font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: #78716c; text-align: center; }
.from { margin: 0 0 5mm; font-size: 10px; color: #78716c; }
.message { margin: 0 0 6mm; font-size: 17px; line-height: 1.75; text-align: center; }
.card-foot { display: flex; justify-content: space-between; font-size: 9px; color: #78716c; }
.to { font-weight: 700; color: #292524; }`,
  },

  {
    id: "pastel-corners",
    name: "Pastel corners",
    html: templateHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 11mm; background: linear-gradient(135deg, #dbeafe 0 10mm, transparent 10mm), linear-gradient(315deg, #fde68a 0 10mm, transparent 10mm), #fff; border: 1px solid #d8dbe0; font-family: Arial, sans-serif; color: #1f2937; print-color-adjust: exact; break-inside: avoid; }
.card-top, .card-foot { display: flex; justify-content: space-between; font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .08em; }
.message { margin: 12mm 0; font-size: 15px; line-height: 1.65; text-align: center; }`,
  },

  {
    id: "emerald-frame",
    name: "Emerald frame",
    html: splitHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; display: grid; grid-template-columns: 18mm 1fr; border: 2px solid #047857; font-family: Arial, sans-serif; color: #064e3b; break-inside: avoid; }
.side { display: flex; align-items: center; justify-content: center; background: #d1fae5; color: #047857; text-transform: uppercase; letter-spacing: .14em; writing-mode: vertical-rl; print-color-adjust: exact; }
main { padding: 10mm; }
.kicker, .meta { font-size: 9px; color: #047857; text-transform: uppercase; letter-spacing: .08em; }
.message { margin: 5mm 0; font-size: 16px; line-height: 1.6; }
.foot { display: flex; justify-content: space-between; }
.to { font-size: 11px; font-weight: 700; }`,
  },

  {
    id: "polaroid",
    name: "Polaroid",
    html: noteHtml,
    css: `.gift-card { width: 86mm; min-height: 62mm; margin: 0 auto 10mm; padding: 9mm 9mm 14mm; border: 1px solid #e5e7eb; box-shadow: 0 3mm 8mm rgba(0,0,0,.12); font-family: Arial, sans-serif; color: #111827; break-inside: avoid; }
.kicker { margin: 0 0 5mm; font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .1em; }
.from { margin: 0 0 4mm; font-size: 10px; color: #6b7280; }
.message { min-height: 25mm; margin: 0 0 6mm; padding: 8mm; background: #f9fafb; font-size: 15px; line-height: 1.55; text-align: center; print-color-adjust: exact; }
.card-foot { display: flex; justify-content: space-between; font-size: 9px; color: #6b7280; }
.to { font-weight: 700; color: #111827; }`,
  },

  {
    id: "midnight",
    name: "Midnight",
    html: stampHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 10mm; background: #0f172a; color: #f8fafc; font-family: Arial, sans-serif; print-color-adjust: exact; break-inside: avoid; }
.stamp { float: right; border: 1px solid #38bdf8; color: #38bdf8; padding: 3mm 4mm; text-transform: uppercase; letter-spacing: .12em; font-size: 10px; }
.kicker, .meta { font-size: 9px; color: #bae6fd; text-transform: uppercase; letter-spacing: .08em; }
.message { clear: both; margin: 8mm 0; font-size: 16px; line-height: 1.65; }
.foot { display: flex; justify-content: space-between; }
.to { color: #38bdf8; font-weight: 700; }`,
  },

  {
    id: "blush-note",
    name: "Blush note",
    html: noteHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 11mm; background: #fff1f2; border: 1px solid #fecdd3; font-family: Georgia, serif; color: #4c1d24; print-color-adjust: exact; break-inside: avoid; }
.kicker { margin: 0 0 5mm; font-size: 10px; text-align: center; text-transform: uppercase; letter-spacing: .16em; color: #be123c; }
.from { margin: 0 0 5mm; font-size: 10px; color: #9f1239; }
.message { margin: 0 0 6mm; font-size: 17px; line-height: 1.7; text-align: center; }
.card-foot { display: flex; justify-content: space-between; font-size: 9px; color: #9f1239; }
.to { font-weight: 700; color: #4c1d24; }`,
  },

  {
    id: "ledger",
    name: "Ledger",
    html: templateHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 10mm; background: repeating-linear-gradient(0deg, #fff 0 7mm, #f8fafc 7mm 7.3mm); border: 1px solid #cbd5e1; font-family: Arial, sans-serif; color: #1e293b; print-color-adjust: exact; break-inside: avoid; }
.card-top, .card-foot { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: .08em; }
.message { margin: 12mm 0; font-size: 15px; line-height: 1.65; }`,
  },

  {
    id: "gold-seal",
    name: "Gold seal",
    html: stampHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 10mm; border: 1px solid #d6b56d; font-family: Georgia, serif; color: #2f2518; break-inside: avoid; }
.stamp { float: right; width: 21mm; height: 21mm; border-radius: 50%; background: #d6b56d; color: #2f2518; display: flex; align-items: center; justify-content: center; text-transform: uppercase; letter-spacing: .1em; font-size: 10px; print-color-adjust: exact; }
.kicker, .meta { font-size: 9px; color: #7c642f; text-transform: uppercase; letter-spacing: .08em; }
.message { clear: both; margin: 8mm 0; font-size: 16px; line-height: 1.7; text-align: center; }
.foot { display: flex; justify-content: space-between; }
.to { font-weight: 700; }`,
  },

  {
    id: "gallery",
    name: "Gallery",
    html: splitHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; display: grid; grid-template-columns: 24mm 1fr; border: 1px solid #111827; font-family: Arial, sans-serif; color: #111827; break-inside: avoid; }
.side { display: flex; align-items: center; justify-content: center; background: #111827; color: #fff; text-transform: uppercase; letter-spacing: .2em; writing-mode: vertical-rl; print-color-adjust: exact; }
main { padding: 10mm; }
.kicker, .meta { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .08em; }
.message { margin: 5mm 0; font-size: 17px; line-height: 1.5; }
.foot { display: flex; justify-content: space-between; }
.to { font-weight: 700; }`,
  },

  {
    id: "playful-dots",
    name: "Playful dots",
    html: templateHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 11mm; background: radial-gradient(circle at 8mm 12mm, #60a5fa 0 1.2mm, transparent 1.4mm), radial-gradient(circle at 74mm 42mm, #f472b6 0 1.4mm, transparent 1.6mm), radial-gradient(circle at 64mm 12mm, #34d399 0 1.1mm, transparent 1.3mm), #ffffff; border: 1px solid #e5e7eb; font-family: Arial, sans-serif; color: #111827; print-color-adjust: exact; break-inside: avoid; }
.card-top, .card-foot { display: flex; justify-content: space-between; font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .08em; }
.message { margin: 12mm 0; font-size: 16px; line-height: 1.6; text-align: center; }`,
  },
];
