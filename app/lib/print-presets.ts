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

export const justForYouHtml = `<article class="gift-card">
  <div class="corner corner-top"></div>
  <div class="corner corner-bottom"></div>
  <p class="heart">&hearts;</p>
  <h1>Just for you</h1>
  <div class="rule"></div>
  <p class="message">{{message}}</p>
  <p class="from">&mdash; From {{from}}</p>
  <div class="card-foot">
    <span>To {{to}}</span>
    <span>{{date}}</span>
  </div>
</article>`;

export const softKeepsakeHtml = `<article class="gift-card">
  <div class="wash"></div>
  <p class="kicker">A little note</p>
  <h1>For {{to}}</h1>
  <p class="message">{{message}}</p>
  <div class="card-foot">
    <span>From {{from}}</span>
    <span>{{date}}</span>
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
  border: 1px solid rgba(79, 175, 143, .34);
  font-family: Arial, sans-serif;
  color: #334155;
  break-inside: avoid;
}
.card-top, .card-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #64748b;
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
  border: 3px double #334155;
  font-family: Georgia, serif;
  color: #334155;
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
  color: #64748b;
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
  color: #64748b;
}
.to {
  font-size: 11px;
  font-weight: 700;
  color: #334155;
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
  border: 1px solid rgba(249, 231, 231, .95);
  background:
    radial-gradient(circle at 8mm 8mm, #f9e7e7 0 2mm, transparent 2.3mm),
    radial-gradient(circle at 14mm 10mm, #86c5ae 0 2mm, transparent 2.3mm),
    radial-gradient(circle at calc(100% - 8mm) calc(100% - 8mm), #f9e7e7 0 2mm, transparent 2.3mm),
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
  border-image: repeating-linear-gradient(45deg, #4faf8f 0 7px, #fff 7px 14px, #3973d9 14px 21px, #fff 21px 28px) 12;
  font-family: Arial, sans-serif;
  color: #1f2937;
  break-inside: avoid;
}
.stamp {
  float: right;
  padding: 3mm 4mm;
  border: 1px dashed #3973d9;
  color: #3973d9;
  font-size: 11px;
  text-transform: uppercase;
}
.kicker {
  font-size: 9px;
  color: #64748b;
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
  color: #64748b;
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
  border: 1px solid rgba(79, 175, 143, .28);
  font-family: Arial, sans-serif;
  color: #334155;
  break-inside: avoid;
}
.side {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #4faf8f;
  color: white;
  text-transform: uppercase;
  letter-spacing: .16em;
  writing-mode: vertical-rl;
  print-color-adjust: exact;
}
main { padding: 10mm; }
.kicker {
  font-size: 9px;
  color: #64748b;
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
.meta { font-size: 9px; color: #64748b; }
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
    radial-gradient(circle at 12mm 9mm, #4faf8f 0 1.5mm, transparent 1.7mm),
    radial-gradient(circle at 74mm 18mm, #86c5ae 0 1.4mm, transparent 1.6mm),
    radial-gradient(circle at 20mm 45mm, #f9e7e7 0 1.2mm, transparent 1.4mm),
    radial-gradient(circle at 64mm 48mm, #dce8ff 0 1.6mm, transparent 1.8mm),
    #fffdf8;
  border: 1px solid rgba(134, 197, 174, .42);
  print-color-adjust: exact;
  font-family: Arial, sans-serif;
  color: #334155;
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
    linear-gradient(135deg, #f9e7e7 0 8mm, transparent 8mm),
    linear-gradient(315deg, #dce8ff 0 8mm, transparent 8mm),
    #ffffff;
  border: 2px solid #334155;
  print-color-adjust: exact;
  font-family: Arial, sans-serif;
  color: #334155;
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
  color: #64748b;
  margin: 0 0 6mm;
}
.message { margin: 0 0 8mm; font-size: 17px; line-height: 1.55; }
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 9px;
  color: #64748b;
}
.to { font-size: 11px; font-weight: 700; color: #334155; }`,
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
  background: #334155;
  color: #f8fafc;
  font-family: Georgia, serif;
  print-color-adjust: exact;
  break-inside: avoid;
}
.side {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #86c5ae;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: .18em;
  writing-mode: vertical-rl;
}
main { padding: 10mm; }
.kicker { color: #dce8ff; font-size: 9px; margin: 0 0 4mm; }
.message { font-size: 16px; line-height: 1.65; margin: 0 0 4mm; }
.foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.meta { color: #dce8ff; font-size: 9px; }
.to { font-size: 10px; font-weight: 700; color: #86c5ae; }`,
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
  border: 1px solid #86c5ae;
  font-family: Georgia, serif;
  color: #334155;
  position: relative;
  break-inside: avoid;
}
.gift-card:before {
  content: "";
  position: absolute;
  inset: 4mm;
  border: 1px solid #ddf5e8;
}
.card-top, .card-foot, .message { position: relative; }
.card-top, .card-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #4f7e6c;
}
.message { margin: 12mm 0; font-size: 16px; line-height: 1.7; text-align: center; }`,
  },

  {
    id: "polaroid",
    name: "Polaroid",
    html: noteHtml,
    css: `.gift-card { width: 86mm; min-height: 62mm; margin: 0 auto 10mm; padding: 9mm 9mm 14mm; border: 1px solid rgba(51,65,85,.16); box-shadow: 0 3mm 8mm rgba(51,65,85,.12); font-family: Arial, sans-serif; color: #1f2937; break-inside: avoid; }
.kicker { margin: 0 0 5mm; font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: .1em; }
.from { margin: 0 0 4mm; font-size: 10px; color: #64748b; }
.message { min-height: 25mm; margin: 0 0 6mm; padding: 8mm; background: #f3f4f6; font-size: 15px; line-height: 1.55; text-align: center; print-color-adjust: exact; }
.card-foot { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; }
.to { font-weight: 700; color: #1f2937; }`,
  },

  {
    id: "gold-seal",
    name: "Gold seal",
    html: stampHtml,
    css: `.gift-card { width: 86mm; min-height: 54mm; margin: 0 auto 10mm; padding: 10mm; border: 1px solid #86c5ae; font-family: Georgia, serif; color: #334155; break-inside: avoid; }
.stamp { float: right; width: 21mm; height: 21mm; border-radius: 50%; background: #4faf8f; color: #ffffff; display: flex; align-items: center; justify-content: center; text-transform: uppercase; letter-spacing: .1em; font-size: 10px; print-color-adjust: exact; }
.kicker, .meta { font-size: 9px; color: #4f7e6c; text-transform: uppercase; letter-spacing: .08em; }
.message { clear: both; margin: 8mm 0; font-size: 16px; line-height: 1.7; text-align: center; }
.foot { display: flex; justify-content: space-between; }
.to { font-weight: 700; }`,
  },

  {
    id: "just-for-you",
    name: "Just for you",
    html: justForYouHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 8mm 11mm 7mm;
  border: 1px solid rgba(134, 197, 174, .55);
  border-radius: 3mm;
  background:
    radial-gradient(circle at 50% 100%, rgba(238,248,244,.9) 0 28mm, transparent 29mm),
    linear-gradient(180deg, #fff 0%, #f9fffc 100%);
  box-shadow: 0 2mm 7mm rgba(51,65,85,.12);
  color: #183b2d;
  font-family: Georgia, serif;
  overflow: hidden;
  position: relative;
  print-color-adjust: exact;
  break-inside: avoid;
}
.corner {
  position: absolute;
  width: 31mm;
  height: 31mm;
  opacity: .78;
}
.corner:before,
.corner:after {
  content: "";
  position: absolute;
  border-radius: 999px 0 999px 0;
  background: rgba(134,197,174,.74);
  transform: rotate(-24deg);
}
.corner:before { width: 5mm; height: 18mm; left: 5mm; top: 2mm; }
.corner:after { width: 4mm; height: 15mm; left: 12mm; top: 9mm; background: rgba(79,175,143,.52); }
.corner-top { left: -2mm; top: -1mm; }
.corner-bottom { right: -2mm; bottom: -2mm; transform: rotate(180deg); }
.heart {
  color: #e36a78;
  font-size: 16px;
  line-height: 1;
  margin: 0;
  text-align: center;
}
h1 {
  color: #183b2d;
  font-family: "Snell Roundhand", "Brush Script MT", Georgia, serif;
  font-size: 30px;
  font-weight: 500;
  line-height: 1.05;
  margin: 0;
  text-align: center;
}
.rule {
  align-items: center;
  display: flex;
  gap: 3mm;
  justify-content: center;
  margin: 2mm auto 4mm;
  width: 48mm;
}
.rule:before,
.rule:after {
  background: rgba(51,65,85,.22);
  content: "";
  height: 1px;
  width: 20mm;
}
.rule { color: #86c5ae; }
.rule:after { box-shadow: -22mm 0 0 -10mm #86c5ae; }
.message {
  color: #1f2937;
  font-size: 13px;
  line-height: 1.55;
  margin: 0 auto 4mm;
  max-width: 58mm;
  text-align: center;
}
.from {
  color: #334155;
  font-size: 12px;
  margin: 0 0 4mm;
  text-align: center;
}
.card-foot {
  color: #64748b;
  display: flex;
  font-size: 8px;
  justify-content: space-between;
  letter-spacing: .06em;
  text-transform: uppercase;
}`,
  },

  {
    id: "sage-garden",
    name: "Sage garden",
    html: softKeepsakeHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 10mm 12mm;
  border: 1px solid rgba(134,197,174,.62);
  border-radius: 2mm;
  background:
    linear-gradient(135deg, rgba(238,248,244,.96), rgba(255,255,255,.98)),
    #fff;
  color: #334155;
  font-family: Georgia, serif;
  overflow: hidden;
  position: relative;
  print-color-adjust: exact;
  break-inside: avoid;
}
.gift-card:before,
.gift-card:after {
  content: "";
  position: absolute;
  border: 1px solid rgba(134,197,174,.45);
  border-radius: 50%;
  height: 35mm;
  width: 35mm;
}
.gift-card:before { left: -18mm; top: -13mm; }
.gift-card:after { bottom: -20mm; right: -16mm; }
.wash {
  background:
    radial-gradient(circle at 12% 16%, rgba(79,175,143,.2), transparent 17mm),
    radial-gradient(circle at 88% 88%, rgba(220,232,255,.42), transparent 21mm);
  inset: 0;
  position: absolute;
}
.kicker,
h1,
.message,
.card-foot { position: relative; }
.kicker {
  color: #4f7e6c;
  font-size: 9px;
  letter-spacing: .14em;
  margin: 0 0 3mm;
  text-align: center;
  text-transform: uppercase;
}
h1 {
  color: #183b2d;
  font-family: "Snell Roundhand", "Brush Script MT", Georgia, serif;
  font-size: 24px;
  font-weight: 500;
  margin: 0 0 5mm;
  text-align: center;
}
.message {
  background: rgba(255,255,255,.58);
  border: 1px solid rgba(134,197,174,.24);
  border-radius: 2mm;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 5mm;
  padding: 5mm;
  text-align: center;
}
.card-foot {
  color: #64748b;
  display: flex;
  font-size: 9px;
  justify-content: space-between;
}`,
  },

  {
    id: "blush-heart",
    name: "Blush heart",
    html: justForYouHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 9mm 11mm 8mm;
  border: 1px solid rgba(227,106,120,.25);
  border-radius: 3mm;
  background:
    radial-gradient(circle at 12mm 11mm, rgba(249,231,231,.95) 0 13mm, transparent 14mm),
    radial-gradient(circle at 74mm 46mm, rgba(238,248,244,.9) 0 16mm, transparent 17mm),
    #fff;
  box-shadow: 0 2mm 7mm rgba(51,65,85,.1);
  color: #3d2f35;
  font-family: Georgia, serif;
  overflow: hidden;
  position: relative;
  print-color-adjust: exact;
  break-inside: avoid;
}
.corner { display: none; }
.heart {
  border: 1px solid rgba(227,106,120,.34);
  border-radius: 50%;
  color: #e36a78;
  font-size: 14px;
  height: 8mm;
  line-height: 8mm;
  margin: 0 auto 2mm;
  text-align: center;
  width: 8mm;
}
h1 {
  color: #334155;
  font-family: "Snell Roundhand", "Brush Script MT", Georgia, serif;
  font-size: 27px;
  font-weight: 500;
  margin: 0;
  text-align: center;
}
.rule {
  background: linear-gradient(90deg, transparent, rgba(227,106,120,.35), transparent);
  height: 1px;
  margin: 3mm auto 5mm;
  width: 46mm;
}
.message {
  color: #334155;
  font-size: 14px;
  line-height: 1.58;
  margin: 0 auto 5mm;
  max-width: 59mm;
  text-align: center;
}
.from {
  color: #7f6670;
  font-size: 12px;
  margin: 0 0 4mm;
  text-align: center;
}
.card-foot {
  color: #7f6670;
  display: flex;
  font-size: 8px;
  justify-content: space-between;
  letter-spacing: .06em;
  text-transform: uppercase;
}`,
  },

  {
    id: "mint-keepsake",
    name: "Mint keepsake",
    html: softKeepsakeHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 9mm 10mm;
  border: 1px solid rgba(79,175,143,.34);
  border-radius: 2mm;
  background:
    linear-gradient(135deg, rgba(238,248,244,.96), rgba(220,232,255,.7)),
    #fff;
  color: #334155;
  font-family: Arial, sans-serif;
  overflow: hidden;
  position: relative;
  print-color-adjust: exact;
  break-inside: avoid;
}
.wash {
  background:
    linear-gradient(90deg, rgba(79,175,143,.15) 0 10mm, transparent 10mm),
    radial-gradient(circle at 80% 18%, rgba(255,255,255,.9), transparent 22mm);
  inset: 0;
  position: absolute;
}
.kicker,
h1,
.message,
.card-foot { position: relative; }
.kicker {
  color: #4faf8f;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .16em;
  margin: 0 0 4mm;
  text-transform: uppercase;
}
h1 {
  color: #334155;
  font-size: 20px;
  font-weight: 760;
  margin: 0 0 5mm;
}
.message {
  background: rgba(255,255,255,.68);
  border-radius: 2mm;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.58;
  margin: 0 0 5mm;
  padding: 5mm 6mm;
}
.card-foot {
  color: #64748b;
  display: flex;
  font-size: 9px;
  justify-content: space-between;
}`,
  },

  {
    id: "blue-bloom",
    name: "Blue bloom",
    html: justForYouHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 9mm 12mm 8mm;
  border: 1px solid rgba(57,115,217,.28);
  border-radius: 3mm;
  background:
    radial-gradient(circle at 76mm 10mm, rgba(220,232,255,.95) 0 15mm, transparent 16mm),
    radial-gradient(circle at 9mm 47mm, rgba(238,248,244,.92) 0 14mm, transparent 15mm),
    #fff;
  color: #334155;
  font-family: Georgia, serif;
  overflow: hidden;
  position: relative;
  print-color-adjust: exact;
  break-inside: avoid;
}
.corner {
  position: absolute;
  width: 24mm;
  height: 24mm;
}
.corner-top { right: 0; top: 0; }
.corner-bottom { left: 0; bottom: 0; transform: rotate(180deg); }
.corner:before,
.corner:after {
  background: rgba(57,115,217,.22);
  border-radius: 999px 0 999px 0;
  content: "";
  height: 13mm;
  position: absolute;
  transform: rotate(-36deg);
  width: 4mm;
}
.corner:before { right: 5mm; top: 4mm; }
.corner:after { right: 11mm; top: 10mm; background: rgba(134,197,174,.48); }
.heart {
  color: #3973d9;
  font-size: 13px;
  margin: 0 0 1mm;
  text-align: center;
}
h1 {
  color: #334155;
  font-family: "Snell Roundhand", "Brush Script MT", Georgia, serif;
  font-size: 27px;
  font-weight: 500;
  margin: 0;
  text-align: center;
}
.rule {
  background: linear-gradient(90deg, transparent, rgba(57,115,217,.34), transparent);
  height: 1px;
  margin: 3mm auto 5mm;
  width: 48mm;
}
.message {
  color: #1f2937;
  font-size: 14px;
  line-height: 1.58;
  margin: 0 auto 5mm;
  max-width: 58mm;
  text-align: center;
}
.from {
  color: #53617a;
  font-size: 12px;
  margin: 0 0 4mm;
  text-align: center;
}
.card-foot {
  color: #64748b;
  display: flex;
  font-size: 8px;
  justify-content: space-between;
  letter-spacing: .06em;
  text-transform: uppercase;
}`,
  },

  {
    id: "quiet-botanical",
    name: "Quiet botanical",
    html: justForYouHtml,
    css: `.gift-card {
  width: 86mm;
  min-height: 54mm;
  margin: 0 auto 10mm;
  padding: 9mm 12mm 8mm;
  border: 1px solid rgba(51,65,85,.14);
  border-radius: 3mm;
  background:
    linear-gradient(180deg, #ffffff, rgba(243,244,246,.72));
  color: #334155;
  font-family: Georgia, serif;
  overflow: hidden;
  position: relative;
  print-color-adjust: exact;
  break-inside: avoid;
}
.gift-card:before,
.gift-card:after {
  background:
    linear-gradient(55deg, transparent 0 45%, rgba(134,197,174,.65) 46% 54%, transparent 55%),
    linear-gradient(120deg, transparent 0 48%, rgba(79,175,143,.3) 49% 55%, transparent 56%);
  content: "";
  height: 32mm;
  opacity: .78;
  position: absolute;
  width: 22mm;
}
.gift-card:before { left: -2mm; top: 1mm; transform: rotate(-16deg); }
.gift-card:after { bottom: -1mm; right: -2mm; transform: rotate(164deg); }
.corner { display: none; }
.heart {
  color: #86c5ae;
  font-size: 14px;
  margin: 0 0 1mm;
  text-align: center;
}
h1 {
  color: #183b2d;
  font-family: "Snell Roundhand", "Brush Script MT", Georgia, serif;
  font-size: 28px;
  font-weight: 500;
  margin: 0;
  text-align: center;
}
.rule {
  background: linear-gradient(90deg, transparent, rgba(51,65,85,.22), transparent);
  height: 1px;
  margin: 3mm auto 5mm;
  width: 48mm;
}
.message {
  color: #1f2937;
  font-size: 13px;
  line-height: 1.6;
  margin: 0 auto 5mm;
  max-width: 56mm;
  text-align: center;
}
.from {
  color: #64748b;
  font-size: 12px;
  margin: 0 0 4mm;
  text-align: center;
}
.card-foot {
  color: #64748b;
  display: flex;
  font-size: 8px;
  justify-content: space-between;
  letter-spacing: .06em;
  text-transform: uppercase;
}`,
  },
];
