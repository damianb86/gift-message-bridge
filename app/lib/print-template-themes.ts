export type PrintTemplateTheme = {
  background: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  font: string;
  textWidth: string;
};

const defaultPrintTemplateTheme: PrintTemplateTheme = {
  background: "#ffffff",
  border: "#d8dbdf",
  accent: "#008060",
  text: "#202223",
  muted: "#6d7175",
  font: "Arial, sans-serif",
  textWidth: "18ch",
};

const printTemplateThemes: Record<string, PrintTemplateTheme> = {
  "classic-note": {
    background: "#ffffff",
    border: "#d8dbe0",
    accent: "#008060",
    text: "#202223",
    muted: "#6d7175",
    font: "Arial, sans-serif",
    textWidth: "17ch",
  },
  "fine-border": {
    background: "#fbfaf7",
    border: "#202223",
    accent: "#202223",
    text: "#202223",
    muted: "#6d7175",
    font: "Georgia, serif",
    textWidth: "14ch",
  },
  "soft-floral": {
    background:
      "radial-gradient(circle at 12% 20%, #f2a9bd 0 10px, transparent 11px), radial-gradient(circle at 24% 26%, #c9dfc7 0 9px, transparent 10px), #fffafa",
    border: "#efd3dc",
    accent: "#f2a9bd",
    text: "#3d2f35",
    muted: "#7b646e",
    font: "Georgia, serif",
    textWidth: "16ch",
  },
  airmail: {
    background:
      "linear-gradient(135deg, transparent 0 74%, rgba(207, 61, 53, 0.16) 74%), #ffffff",
    border: "#2f6fbe",
    accent: "#cf3d35",
    text: "#1f2937",
    muted: "#5b6472",
    font: "Arial, sans-serif",
    textWidth: "15ch",
  },
  "modern-ribbon": {
    background: "linear-gradient(90deg, #ffffff 0 78%, #0f766e 78%)",
    border: "#d8dbe0",
    accent: "#0f766e",
    text: "#202223",
    muted: "#6d7175",
    font: "Arial, sans-serif",
    textWidth: "15ch",
  },
  terrazzo: {
    background:
      "radial-gradient(circle at 18% 22%, #f4a261 0 6px, transparent 7px), radial-gradient(circle at 78% 28%, #2a9d8f 0 6px, transparent 7px), radial-gradient(circle at 32% 76%, #e76f51 0 5px, transparent 6px), #fffdf8",
    border: "#eadfd2",
    accent: "#e76f51",
    text: "#24313f",
    muted: "#457b9d",
    font: "Arial, sans-serif",
    textWidth: "16ch",
  },
  celebration: {
    background:
      "linear-gradient(135deg, #ffe066 0 24px, transparent 25px), linear-gradient(315deg, #ff6b6b 0 24px, transparent 25px), #ffffff",
    border: "#202223",
    accent: "#ff6b6b",
    text: "#202223",
    muted: "#6d7175",
    font: "Arial, sans-serif",
    textWidth: "19ch",
  },
  "luxury-band": {
    background: "linear-gradient(90deg, #111827 0 78%, #c8a96a 78%)",
    border: "#111827",
    accent: "#c8a96a",
    text: "#f8fafc",
    muted: "#cbd5e1",
    font: "Georgia, serif",
    textWidth: "13ch",
  },
  "botanical-line": {
    background: "#fbfdf8",
    border: "#91a78f",
    accent: "#5f725c",
    text: "#253126",
    muted: "#5f725c",
    font: "Georgia, serif",
    textWidth: "16ch",
  },
  polaroid: {
    background: "linear-gradient(180deg, #ffffff 0 72%, #f9fafb 72%)",
    border: "#e5e7eb",
    accent: "#111827",
    text: "#111827",
    muted: "#6b7280",
    font: "Arial, sans-serif",
    textWidth: "18ch",
  },
  "gold-seal": {
    background: "#fffdf7",
    border: "#d6b56d",
    accent: "#d6b56d",
    text: "#2f2518",
    muted: "#7c642f",
    font: "Georgia, serif",
    textWidth: "15ch",
  },
  custom: {
    background:
      "linear-gradient(135deg, #ffffff 0 55%, #eef4ff 55%), linear-gradient(90deg, #f8fafc, #ffffff)",
    border: "#9ca3af",
    accent: "#4b5563",
    text: "#111827",
    muted: "#6b7280",
    font: "ui-monospace, SFMono-Regular, Menlo, monospace",
    textWidth: "13ch",
  },
};

export function getPrintTemplateTheme(templateId: string): PrintTemplateTheme {
  return printTemplateThemes[templateId] ?? defaultPrintTemplateTheme;
}

export function getPrintTemplateStyleVars(templateId: string) {
  const theme = getPrintTemplateTheme(templateId);

  return {
    "--template-bg": theme.background,
    "--template-border": theme.border,
    "--template-accent": theme.accent,
    "--template-text": theme.text,
    "--template-muted": theme.muted,
    "--template-font": theme.font,
    "--template-text-width": theme.textWidth,
  };
}
