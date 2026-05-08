export const giftMessagePalette = {
  primary: "#4FAF8F",
  primaryHover: "#3F9D7F",
  sage: "#86C5AE",
  mint: "#EEF8F4",
  selected: "#DCE8FF",
  selectedStrong: "#3973D9",
  blush: "#F9E7E7",
  charcoal: "#334155",
  success: "#DDF5E8",
  neutral: "#F3F4F6",
  white: "#FFFFFF",
  ink: "#1F2937",
  muted: "#64748B",
};

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
  background: giftMessagePalette.white,
  border: "rgba(51, 65, 85, 0.16)",
  accent: giftMessagePalette.primary,
  text: giftMessagePalette.ink,
  muted: giftMessagePalette.muted,
  font: "Arial, sans-serif",
  textWidth: "18ch",
};

const printTemplateThemes: Record<string, PrintTemplateTheme> = {
  "classic-note": {
    background: giftMessagePalette.white,
    border: "rgba(79, 175, 143, 0.34)",
    accent: giftMessagePalette.primary,
    text: giftMessagePalette.ink,
    muted: giftMessagePalette.muted,
    font: "Arial, sans-serif",
    textWidth: "17ch",
  },
  "fine-border": {
    background: giftMessagePalette.mint,
    border: giftMessagePalette.charcoal,
    accent: giftMessagePalette.charcoal,
    text: giftMessagePalette.charcoal,
    muted: giftMessagePalette.muted,
    font: "Georgia, serif",
    textWidth: "14ch",
  },
  "soft-floral": {
    background:
      "radial-gradient(circle at 12% 20%, rgba(249, 231, 231, 0.95) 0 12px, transparent 13px), radial-gradient(circle at 24% 26%, rgba(134, 197, 174, 0.48) 0 10px, transparent 11px), #fffafa",
    border: "rgba(249, 231, 231, 0.95)",
    accent: "#DE6C7B",
    text: "#3D2F35",
    muted: "#7D6872",
    font: "Georgia, serif",
    textWidth: "16ch",
  },
  airmail: {
    background:
      "linear-gradient(135deg, transparent 0 74%, rgba(220, 232, 255, 0.75) 74%), #ffffff",
    border: giftMessagePalette.selectedStrong,
    accent: giftMessagePalette.primary,
    text: giftMessagePalette.charcoal,
    muted: giftMessagePalette.muted,
    font: "Arial, sans-serif",
    textWidth: "15ch",
  },
  "modern-ribbon": {
    background:
      "linear-gradient(90deg, #ffffff 0 78%, rgba(79, 175, 143, 0.2) 78%)",
    border: "rgba(79, 175, 143, 0.28)",
    accent: giftMessagePalette.primary,
    text: giftMessagePalette.ink,
    muted: giftMessagePalette.muted,
    font: "Arial, sans-serif",
    textWidth: "15ch",
  },
  terrazzo: {
    background:
      "radial-gradient(circle at 18% 22%, rgba(79, 175, 143, 0.7) 0 6px, transparent 7px), radial-gradient(circle at 78% 28%, rgba(249, 231, 231, 0.95) 0 8px, transparent 9px), radial-gradient(circle at 32% 76%, rgba(220, 232, 255, 0.95) 0 7px, transparent 8px), #ffffff",
    border: "rgba(134, 197, 174, 0.42)",
    accent: giftMessagePalette.primary,
    text: giftMessagePalette.charcoal,
    muted: giftMessagePalette.muted,
    font: "Arial, sans-serif",
    textWidth: "16ch",
  },
  celebration: {
    background:
      "linear-gradient(135deg, rgba(249, 231, 231, 0.95) 0 24px, transparent 25px), linear-gradient(315deg, rgba(220, 232, 255, 0.95) 0 24px, transparent 25px), #ffffff",
    border: giftMessagePalette.charcoal,
    accent: "#E36A78",
    text: giftMessagePalette.ink,
    muted: giftMessagePalette.muted,
    font: "Arial, sans-serif",
    textWidth: "19ch",
  },
  "luxury-band": {
    background: `linear-gradient(90deg, ${giftMessagePalette.charcoal} 0 78%, ${giftMessagePalette.sage} 78%)`,
    border: giftMessagePalette.charcoal,
    accent: giftMessagePalette.sage,
    text: "#F8FAFC",
    muted: "#DCE8FF",
    font: "Georgia, serif",
    textWidth: "13ch",
  },
  "botanical-line": {
    background: giftMessagePalette.mint,
    border: giftMessagePalette.sage,
    accent: giftMessagePalette.primary,
    text: giftMessagePalette.charcoal,
    muted: "#4F7E6C",
    font: "Georgia, serif",
    textWidth: "16ch",
  },
  polaroid: {
    background: `linear-gradient(180deg, #ffffff 0 72%, ${giftMessagePalette.neutral} 72%)`,
    border: "rgba(51, 65, 85, 0.16)",
    accent: giftMessagePalette.charcoal,
    text: giftMessagePalette.ink,
    muted: giftMessagePalette.muted,
    font: "Arial, sans-serif",
    textWidth: "18ch",
  },
  "gold-seal": {
    background: "#FFFDF9",
    border: giftMessagePalette.sage,
    accent: giftMessagePalette.primary,
    text: "#26342F",
    muted: "#5E786D",
    font: "Georgia, serif",
    textWidth: "15ch",
  },
  "just-for-you": {
    background:
      "linear-gradient(180deg, #ffffff 0%, rgba(238, 248, 244, 0.72) 100%)",
    border: "rgba(134, 197, 174, 0.48)",
    accent: giftMessagePalette.primary,
    text: "#183B2D",
    muted: "#5A766A",
    font: "Georgia, serif",
    textWidth: "14ch",
  },
  "sage-garden": {
    background:
      "radial-gradient(circle at 16% 18%, rgba(134, 197, 174, 0.42) 0 18px, transparent 19px), #ffffff",
    border: "rgba(134, 197, 174, 0.55)",
    accent: giftMessagePalette.sage,
    text: giftMessagePalette.charcoal,
    muted: "#557568",
    font: "Georgia, serif",
    textWidth: "15ch",
  },
  "blush-heart": {
    background:
      "linear-gradient(135deg, rgba(249, 231, 231, 0.98), #ffffff 62%)",
    border: "rgba(227, 106, 120, 0.28)",
    accent: "#E36A78",
    text: "#3D2F35",
    muted: "#7F6670",
    font: "Georgia, serif",
    textWidth: "14ch",
  },
  "mint-keepsake": {
    background:
      "linear-gradient(135deg, rgba(238, 248, 244, 0.95), rgba(220, 232, 255, 0.7))",
    border: "rgba(79, 175, 143, 0.34)",
    accent: giftMessagePalette.primary,
    text: giftMessagePalette.charcoal,
    muted: giftMessagePalette.muted,
    font: "Arial, sans-serif",
    textWidth: "16ch",
  },
  "blue-bloom": {
    background:
      "radial-gradient(circle at 84% 16%, rgba(220, 232, 255, 0.95) 0 18px, transparent 19px), #ffffff",
    border: "rgba(57, 115, 217, 0.26)",
    accent: giftMessagePalette.selectedStrong,
    text: giftMessagePalette.charcoal,
    muted: "#53617A",
    font: "Georgia, serif",
    textWidth: "14ch",
  },
  "quiet-botanical": {
    background: "linear-gradient(180deg, #ffffff, rgba(243, 244, 246, 0.72))",
    border: "rgba(51, 65, 85, 0.16)",
    accent: giftMessagePalette.sage,
    text: giftMessagePalette.charcoal,
    muted: giftMessagePalette.muted,
    font: "Georgia, serif",
    textWidth: "15ch",
  },
  custom: {
    background:
      "linear-gradient(135deg, #ffffff 0 55%, #eef8f4 55%), linear-gradient(90deg, #f3f4f6, #ffffff)",
    border: "rgba(51, 65, 85, 0.22)",
    accent: giftMessagePalette.charcoal,
    text: giftMessagePalette.ink,
    muted: giftMessagePalette.muted,
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
