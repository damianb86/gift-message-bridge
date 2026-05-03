import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { MOCK_GIFT_MESSAGES } from "../mock-messages";
import styles from "../styles/print-setup.module.css";
import {
  CUSTOM_TEMPLATE_ID,
  presetPrintTemplates,
  type PrintTemplate,
} from "../lib/print-presets";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const dateRange = url.searchParams.get("dateRange") || "today";
  const product = url.searchParams.get("product") || "all";
  const query = url.searchParams.get("query")?.trim() || "";
  const showPrinted = url.searchParams.get("showPrinted") === "true";

  // Base where: every filter EXCEPT product (so the product list reflects what's
  // visible after the other filters are applied).
  const baseWhere: Prisma.GiftMessageWhereInput = {
    shop: session.shop,
    message: { not: "" },
  };

  if (!showPrinted) {
    baseWhere.printed = false;
  }

  const updatedAt = getUpdatedAtFilter(dateRange);
  if (updatedAt) {
    baseWhere.updatedAt = updatedAt;
  }

  if (query) {
    baseWhere.OR = [
      { id: { contains: query } },
      { sourceId: { contains: query } },
      { cartToken: { contains: query } },
      { cartReference: { contains: query } },
      { message: { contains: query } },
      { sender: { contains: query } },
      { recipient: { contains: query } },
      { productTitle: { contains: query } },
      { productVariantTitle: { contains: query } },
      { productSku: { contains: query } },
      { productHandle: { contains: query } },
    ];
  }

  const [baseMessages, totalMessageCount, templateSettings] = await Promise.all(
    [
      db.giftMessage.findMany({
        where: baseWhere,
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      db.giftMessage.count({
        where: { shop: session.shop, message: { not: "" } },
      }),
      db.printTemplateSettings.findUnique({
        where: { shop: session.shop },
      }),
    ],
  );

  // Product options come from the messages matching every filter except product.
  const dbProductOptions = buildProductOptions(baseMessages);

  // Apply product filter on top of baseMessages.
  const filteredDbMessages =
    product === "__no_product"
      ? baseMessages.filter(
          (m) => !m.productId && !m.productTitle && !m.productSku,
        )
      : product !== "all"
        ? baseMessages.filter(
            (m) =>
              m.productId === product ||
              m.productSku === product ||
              formatProductReference(
                m.productTitle,
                m.productVariantTitle,
                m.productSku,
              ) === product,
          )
        : baseMessages;

  const limitedDbMessages = filteredDbMessages.slice(0, 50);

  const mapMessage = (m: {
    id: string;
    sourceId: string;
    cartToken: string;
    cartReference?: string | null;
    mode: string;
    sender: string;
    recipient: string;
    message: string;
    productId?: string | null;
    productTitle?: string | null;
    productVariantTitle?: string | null;
    productSku?: string | null;
    productHandle?: string | null;
    printed?: boolean;
    date: string;
  }) => ({
    id: m.id,
    reference: formatMessageReference(m.sourceId),
    cartReference: formatCartReference(m.cartReference, m.cartToken),
    cartToken: formatCartReference(m.cartReference, m.cartToken),
    source: getSourceLabel(m.mode),
    sender: m.sender,
    recipient: m.recipient,
    message: m.message,
    productId: m.productId || "",
    productTitle: m.productTitle || "",
    productVariantTitle: m.productVariantTitle || "",
    productSku: m.productSku || "",
    productReference: formatProductReference(
      m.productTitle,
      m.productVariantTitle,
      m.productSku,
    ),
    productHandle: m.productHandle || "",
    printed: Boolean(m.printed),
    date: m.date,
  });

  // Mock fallback (DB empty)
  const useMock = totalMessageCount === 0;
  const mockBase = useMock
    ? filterMockBase(MOCK_GIFT_MESSAGES, { dateRange, query, showPrinted })
    : [];
  const mockFiltered = useMock
    ? mockBase.filter((m) => matchesMockProduct(m, product))
    : [];

  const printMessages = useMock
    ? mockFiltered.map((m) => mapMessage(m))
    : limitedDbMessages.map((m) =>
        mapMessage({
          ...m,
          date: m.updatedAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        }),
      );

  const productOptions = useMock
    ? buildProductOptions(mockBase)
    : dbProductOptions;

  return {
    printMessages,
    productOptions,
    filters: {
      dateRange,
      product,
      query,
      showPrinted,
    },
    templateSettings: {
      selectedTemplateId:
        templateSettings?.selectedTemplateId || presetPrintTemplates[0].id,
      customHtml: templateSettings?.customHtml || "",
      customCss: templateSettings?.customCss || "",
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "save-template-preference") {
    const selectedTemplateId = String(form.get("selectedTemplateId") || "");

    await db.printTemplateSettings.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop, selectedTemplateId },
      update: { selectedTemplateId },
    });

    return { ok: true, intent, selectedTemplateId };
  }

  if (intent === "save-custom-template") {
    const customHtml = String(form.get("customHtml") || "");
    const customCss = String(form.get("customCss") || "");

    await db.printTemplateSettings.upsert({
      where: { shop: session.shop },
      create: {
        shop: session.shop,
        selectedTemplateId: CUSTOM_TEMPLATE_ID,
        customHtml,
        customCss,
      },
      update: {
        selectedTemplateId: CUSTOM_TEMPLATE_ID,
        customHtml,
        customCss,
      },
    });

    return {
      ok: true,
      intent,
      selectedTemplateId: CUSTOM_TEMPLATE_ID,
      customHtml,
      customCss,
    };
  }

  if (intent === "mark-printed" || intent === "mark-unprinted") {
    const ids = String(form.get("ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    // Mock IDs (demo-*) aren't in the DB — acknowledge without mutating.
    const realIds = ids.filter((id) => !id.startsWith("demo-"));
    const printed = intent === "mark-printed";

    if (realIds.length > 0) {
      await db.giftMessage.updateMany({
        where: { shop: session.shop, id: { in: realIds } },
        data: { printed },
      });
    }

    return { ok: true, intent, count: ids.length };
  }

  return { ok: false, intent };
};

function getUpdatedAtFilter(dateRange: string): Prisma.DateTimeFilter | null {
  if (dateRange === "all") {
    return null;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const daysMatch = dateRange.match(/^(\d+)days$/);

  if (daysMatch) {
    const days = Number(daysMatch[1]);
    start.setDate(start.getDate() - Math.max(days - 1, 0));
  }

  return { gte: start };
}

function getSourceLabel(mode: string): string {
  if (mode === "product") {
    return "Product page";
  }

  if (mode === "order") {
    return "Cart page";
  }

  return "Cart page";
}

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const REFERENCE_LENGTH = 5;

function formatMessageReference(sourceId: string): string {
  const cleanReference = sourceId.trim();

  if (/^GM-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(cleanReference)) {
    return cleanReference;
  }

  return formatStableReference("GM", cleanReference);
}

function formatCartReference(
  cartReference: string | null | undefined,
  cartToken: string,
): string {
  const cleanReference = String(cartReference || "").trim();

  if (/^GO-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(cleanReference)) {
    return cleanReference;
  }

  return formatStableReference("GO", cartToken || cleanReference);
}

function formatStableReference(prefix: string, value: string): string {
  let hash = 0;
  const cleanValue = String(value || prefix);

  for (let index = 0; index < cleanValue.length; index += 1) {
    hash = (hash * 31 + cleanValue.charCodeAt(index)) >>> 0;
  }

  let code = "";
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    code = REFERENCE_ALPHABET[hash % REFERENCE_ALPHABET.length] + code;
    hash = Math.floor(hash / REFERENCE_ALPHABET.length);
  }

  return `${prefix}-${code}`;
}

function buildProductOptions(
  messages: Array<{
    productId?: string | null;
    productTitle?: string | null;
    productVariantTitle?: string | null;
    productSku?: string | null;
  }>,
) {
  const seen = new Set<string>();

  return messages.reduce<Array<{ label: string; value: string }>>(
    (options, message) => {
      const label = formatProductReference(
        message.productTitle,
        message.productVariantTitle,
        message.productSku,
      );

      if (!label) {
        return options;
      }

      const value = String(
        message.productId || message.productSku || label,
      ).trim();
      const key = `${value}:${label}`;

      if (seen.has(key)) {
        return options;
      }

      seen.add(key);
      options.push({ label, value });
      return options;
    },
    [],
  );
}

function formatProductReference(
  productTitle?: string | null,
  productVariantTitle?: string | null,
  productSku?: string | null,
): string {
  const title = String(productTitle || "").trim();
  const variant = String(productVariantTitle || "").trim();
  const sku = String(productSku || "").trim();
  const parts: string[] = [];

  if (title) {
    parts.push(`${title}${variant ? ` - ${variant}` : ""}`);
  }

  if (sku) {
    parts.push(`SKU: ${sku}`);
  }

  return parts.join(" | ");
}

/** Filter mock messages by every filter EXCEPT product (used for the pool that
 *  also feeds the product dropdown). Mocks are never marked as printed. */
function filterMockBase(
  messages: typeof MOCK_GIFT_MESSAGES,
  filters: { dateRange: string; query: string; showPrinted: boolean },
) {
  const updatedAt = getUpdatedAtFilter(filters.dateRange);
  const query = filters.query.toLowerCase();

  return messages.filter((message) => {
    // Mirror the same logic as the DB: hide printed when showPrinted is off
    if (!filters.showPrinted && message.printed) return false;

    if (updatedAt?.gte) {
      const messageDate = new Date(`${message.date} 00:00:00`);
      if (messageDate < updatedAt.gte) return false;
    }

    if (!query) return true;

    return [
      message.id,
      message.sourceId,
      message.cartToken,
      message.cartReference,
      message.sender,
      message.recipient,
      message.message,
      message.productTitle,
      message.productVariantTitle,
      message.productSku,
      message.productHandle,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function matchesMockProduct(
  message: (typeof MOCK_GIFT_MESSAGES)[number],
  product: string,
): boolean {
  if (product === "all") return true;
  if (product === "__no_product") return !message.productTitle;
  return (
    product ===
    (message.productId ||
      message.productSku ||
      formatProductReference(
        message.productTitle,
        message.productVariantTitle,
        message.productSku,
      ))
  );
}

type PrintMessage = Awaited<ReturnType<typeof loader>>["printMessages"][number];
type PreviewMessage = Pick<
  PrintMessage,
  | "reference"
  | "cartReference"
  | "cartToken"
  | "productReference"
  | "sender"
  | "recipient"
  | "message"
  | "date"
>;

const basePrintCss = `* { box-sizing: border-box; }
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
.print-message .gift-card {
  margin: 0;
}
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
.print-meta-title {
  color: #6d7175;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.print-meta-value {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.print-meta-muted {
  color: #6d7175;
  overflow-wrap: anywhere;
}
/* Shared helper used by templateHtml layouts */
.names {
  display: flex;
  justify-content: space-between;
  margin: 4mm 0;
  font-size: 10px;
  line-height: 1.4;
  color: #6d7175;
  text-transform: uppercase;
  letter-spacing: .06em;
}
@page { margin: 10mm; }
@media print {
  body { padding: 0; }
  .print-message,
  .gift-card { page-break-inside: avoid; break-inside: avoid; }
}`;

const defaultPreviewMessage: PreviewMessage = {
  reference: "GM-7K4P9",
  cartReference: "GO-2D6H8",
  cartToken: "GO-2D6H8",
  productReference: "Signature Candle - Amber / Large | SKU: CND-AMB-L",
  sender: "Alex",
  recipient: "Taylor",
  message: "Happy birthday! Hope this gift brings a little extra joy today.",
  date: "Apr 28, 2026",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTemplate(tpl: string, msg: PreviewMessage): string {
  return tpl
    .replace(/\{\{reference\}\}/g, escapeHtml(msg.reference))
    .replace(/\{\{cart_token\}\}/g, escapeHtml(msg.cartReference))
    .replace(/\{\{product_reference\}\}/g, escapeHtml(msg.productReference))
    .replace(/\{\{from\}\}/g, escapeHtml(msg.sender || ""))
    .replace(/\{\{to\}\}/g, escapeHtml(msg.recipient || ""))
    .replace(/\{\{message\}\}/g, escapeHtml(msg.message))
    .replace(/\{\{date\}\}/g, escapeHtml(msg.date));
}

function renderPrintMessage(tpl: string, msg: PrintMessage): string {
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
      <div class="print-meta-value">${escapeHtml(msg.productReference)}</div>
    </div>`
        : ""
    }
  </aside>
  ${renderTemplate(tpl, msg)}
</section>`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 3, 0)).trimEnd()}...`;
}

export default function PrintSetup() {
  const { printMessages, productOptions, filters, templateSettings } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const templateFetcher = useFetcher<typeof action>();
  const messagesFetcher = useFetcher<typeof action>();
  const customTemplateFromSettings =
    templateSettings.customHtml || templateSettings.customCss
      ? {
          id: CUSTOM_TEMPLATE_ID,
          name: "Custom",
          html: templateSettings.customHtml,
          css: templateSettings.customCss,
        }
      : null;
  const [customTemplate, setCustomTemplate] = useState<PrintTemplate | null>(
    customTemplateFromSettings,
  );
  const printTemplates = customTemplate
    ? [...presetPrintTemplates, customTemplate]
    : presetPrintTemplates;
  const initialTemplate =
    printTemplates.find(
      (template) => template.id === templateSettings.selectedTemplateId,
    ) ?? printTemplates[0];
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplate.id,
  );
  const [dateRange, setDateRange] = useState(filters.dateRange);
  const [product, setProduct] = useState(filters.product);
  const [query, setQuery] = useState(filters.query);
  const [showPrinted, setShowPrinted] = useState(filters.showPrinted);
  const selectedTemplate =
    printTemplates.find((template) => template.id === selectedTemplateId) ??
    printTemplates[0];
  const [templateHtmlValue, setTemplateHtmlValue] = useState<string>(
    initialTemplate.html,
  );
  const [templateCssValue, setTemplateCssValue] = useState<string>(
    initialTemplate.css,
  );
  const [previewMessage, setPreviewMessage] = useState<PreviewMessage>(
    defaultPreviewMessage,
  );
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    () => new Set(printMessages.map((message) => message.id)),
  );
  const [markPrintedAfterPrint, setMarkPrintedAfterPrint] = useState(true);
  const [printPreviewHtml, setPrintPreviewHtml] = useState("");
  const printPreviewFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setSelectedMessageIds(new Set(printMessages.map((message) => message.id)));
  }, [printMessages]);

  useEffect(() => {
    if (!printPreviewHtml) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePrintPreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [printPreviewHtml]);

  const selectedMessages = useMemo(
    () => printMessages.filter((message) => selectedMessageIds.has(message.id)),
    [printMessages, selectedMessageIds],
  );
  const selectedCount = selectedMessages.length;
  const allMessagesSelected =
    printMessages.length > 0 && selectedCount === printMessages.length;
  const partiallySelected =
    selectedCount > 0 && selectedCount < printMessages.length;

  const handleTemplateChange = (templateId: string) => {
    const nextTemplate =
      printTemplates.find((template) => template.id === templateId) ??
      printTemplates[0];

    setSelectedTemplateId(nextTemplate.id);
    setTemplateHtmlValue(nextTemplate.html);
    setTemplateCssValue(nextTemplate.css);
    templateFetcher.submit(
      {
        intent: "save-template-preference",
        selectedTemplateId: nextTemplate.id,
      },
      { method: "POST" },
    );
  };

  const buildSelectedPrintDocument = (autoPrint = false) => {
    const renderedMessages = selectedMessages
      .map((msg) => renderPrintMessage(templateHtmlValue, msg))
      .join("\n");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Gift Messages</title>
  <style>
${basePrintCss}
${templateCssValue}
  </style>
</head>
<body>
${renderedMessages}
${
  autoPrint
    ? `<script>
  window.addEventListener('load', function () {
    window.print();
    window.addEventListener('afterprint', function () { window.close(); });
  });
</script>`
    : ""
}
</body>
</html>`;
  };

  const handlePrint = () => {
    if (selectedMessages.length === 0) return;

    setPrintPreviewHtml(buildSelectedPrintDocument(false));
  };

  const closePrintPreview = () => {
    setPrintPreviewHtml("");
  };

  const continuePrint = () => {
    if (markPrintedAfterPrint && selectedCount > 0) {
      messagesFetcher.submit(
        { intent: "mark-printed", ids: [...selectedMessageIds].join(",") },
        { method: "POST" },
      );
    }

    const frameWindow = printPreviewFrameRef.current?.contentWindow;

    if (frameWindow) {
      frameWindow.addEventListener("afterprint", closePrintPreview, {
        once: true,
      });
      frameWindow.focus();
      frameWindow.print();
      return;
    }

    const html = buildSelectedPrintDocument(true);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const toggleMessage = (messageId: string, checked: boolean) => {
    setSelectedMessageIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(messageId);
      } else {
        next.delete(messageId);
      }

      return next;
    });
  };

  const toggleAllMessages = (checked: boolean) => {
    setSelectedMessageIds(
      checked ? new Set(printMessages.map((message) => message.id)) : new Set(),
    );
  };

  const updatePreviewField = (field: keyof PreviewMessage, value: string) => {
    setPreviewMessage((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const isTemplateDirty =
    templateHtmlValue !== selectedTemplate.html ||
    templateCssValue !== selectedTemplate.css;

  const handleSaveCustomTemplate = () => {
    const nextCustomTemplate = {
      id: CUSTOM_TEMPLATE_ID,
      name: "Custom",
      html: templateHtmlValue,
      css: templateCssValue,
    };

    setCustomTemplate(nextCustomTemplate);
    setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
    templateFetcher.submit(
      {
        intent: "save-custom-template",
        customHtml: templateHtmlValue,
        customCss: templateCssValue,
      },
      { method: "POST" },
    );
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("dateRange", dateRange);
    params.set("product", product);

    if (query.trim()) {
      params.set("query", query.trim());
    }

    if (showPrinted) {
      params.set("showPrinted", "true");
    }

    if (
      dateRange === filters.dateRange &&
      product === filters.product &&
      query.trim() === filters.query &&
      showPrinted === filters.showPrinted
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      navigate(`/app/print-setup?${params.toString()}`, { replace: true });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    dateRange,
    filters.dateRange,
    filters.product,
    filters.query,
    filters.showPrinted,
    navigate,
    product,
    query,
    showPrinted,
  ]);

  const clearFilters = () => {
    setDateRange("today");
    setProduct("all");
    setQuery("");
    setShowPrinted(false);
    navigate("/app/print-setup");
  };

  // Toast feedback for mark-printed / mark-unprinted
  useEffect(() => {
    if (messagesFetcher.state !== "idle" || !messagesFetcher.data) return;
    const data = messagesFetcher.data;
    if (!data.ok) return;
    if (data.intent === "mark-printed" && "count" in data) {
      shopify.toast.show(`${data.count} message(s) marked as printed`);
    } else if (data.intent === "mark-unprinted" && "count" in data) {
      shopify.toast.show(`${data.count} message(s) marked as unprinted`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesFetcher.state, messagesFetcher.data]);

  // Selection helpers for printed/unprinted state
  const selectedHasUnprinted = selectedMessages.some((m) => !m.printed);
  const selectedHasPrinted = selectedMessages.some((m) => m.printed);

  const markSelected = (intent: "mark-printed" | "mark-unprinted") => {
    if (selectedCount === 0) return;
    messagesFetcher.submit(
      { intent, ids: [...selectedMessageIds].join(",") },
      { method: "POST" },
    );
  };

  const dateRangeLabel =
    dateRange === "all"
      ? "All time"
      : dateRange === "today"
        ? "Today"
        : `Last ${dateRange.replace("days", "")} days`;
  const productLabel =
    productOptions.find((option) => option.value === product)?.label ||
    (product === "__no_product" ? "No product" : "All products");
  const printedLabel = showPrinted ? "Printed included" : "Hiding printed";
  const previewDocument = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${basePrintCss}
${templateCssValue}</style></head><body>${renderTemplate(
    templateHtmlValue,
    previewMessage,
  )}</body></html>`;

  return (
    <s-page heading="Gift Message Console" inlineSize="large">
      <s-button
        slot="primary-action"
        onClick={handlePrint}
        disabled={selectedCount === 0}
      >
        {selectedCount === 0
          ? "Print"
          : `Print ${selectedCount} message${selectedCount === 1 ? "" : "s"}`}
      </s-button>
      <s-button
        slot="secondary-actions"
        onClick={() => markSelected("mark-printed")}
        disabled={
          selectedCount === 0 ||
          !selectedHasUnprinted ||
          messagesFetcher.state !== "idle"
        }
      >
        Mark as printed
      </s-button>

      <s-section>
        <div className={styles.toolbar}>
          <div className={styles.toolbarStatus}>
            <s-badge tone={selectedCount > 0 ? "success" : "info"}>
              {selectedCount > 0 ? "Ready to print" : "No messages selected"}
            </s-badge>
            <s-text color="subdued">
              {dateRangeLabel} · {productLabel} · {printedLabel}
            </s-text>
          </div>
        </div>

        <s-stack direction="block" gap="base">
          <s-box
            background="subdued"
            borderColor="base"
            borderRadius="base"
            borderStyle="solid"
            borderWidth="small"
            padding="base"
          >
            <s-grid
              gap="base"
              gridTemplateColumns="minmax(260px, 1.4fr) repeat(2, minmax(180px, 1fr)) auto"
            >
              <s-search-field
                label="Search"
                placeholder="Reference, cart token, name, or message"
                value={query}
                onInput={(event) =>
                  setQuery(
                    String(
                      (event.currentTarget as unknown as HTMLInputElement)
                        .value,
                    ),
                  )
                }
              />
              <s-select
                label="Date range"
                value={dateRange}
                onChange={(event) =>
                  setDateRange(
                    String(
                      (event.currentTarget as unknown as HTMLSelectElement)
                        .value,
                    ),
                  )
                }
              >
                <s-option value="today">Today</s-option>
                <s-option value="3days">Last 3 days</s-option>
                <s-option value="5days">Last 5 days</s-option>
                <s-option value="7days">Last 7 days</s-option>
                <s-option value="10days">Last 10 days</s-option>
                <s-option value="30days">Last 30 days</s-option>
                <s-option value="all">All time</s-option>
              </s-select>
              <s-select
                label="Product"
                value={product}
                onChange={(event) =>
                  setProduct(
                    String(
                      (event.currentTarget as unknown as HTMLSelectElement)
                        .value,
                    ),
                  )
                }
              >
                <s-option value="all">All products</s-option>
                <s-option value="__no_product">No product</s-option>
                {productOptions.map((option) => (
                  <s-option key={option.value} value={option.value}>
                    {option.label}
                  </s-option>
                ))}
              </s-select>
              <div className={styles.filterActions}>
                {/* key resets the uncontrolled checkbox whenever clearFilters
                    navigates back to the default URL (filters.showPrinted → false) */}
                <s-checkbox
                  key={`sp-${String(filters.showPrinted)}`}
                  label="Show printed"
                  defaultChecked={filters.showPrinted}
                  onChange={(event) =>
                    setShowPrinted(
                      Boolean(
                        (event.currentTarget as unknown as HTMLInputElement)
                          .checked,
                      ),
                    )
                  }
                />
                <s-button variant="tertiary" onClick={clearFilters}>
                  Clear
                </s-button>
              </div>
            </s-grid>
          </s-box>
        </s-stack>
      </s-section>

      <s-section>
        <div className={styles.workspace}>
          <div className={styles.messagesPane}>
            <div className={styles.paneHeader}>
              <div>
                <s-heading>Messages to print</s-heading>
                <s-text color="subdued">
                  {selectedCount} of {printMessages.length} selected
                </s-text>
              </div>
            </div>

            <s-table variant="auto">
              <s-table-header-row>
                <s-table-header>
                  <s-checkbox
                    accessibilityLabel="Select all messages"
                    checked={allMessagesSelected}
                    indeterminate={partiallySelected}
                    onChange={(event) =>
                      toggleAllMessages(
                        Boolean(
                          (event.currentTarget as unknown as HTMLInputElement)
                            .checked,
                        ),
                      )
                    }
                  />
                </s-table-header>
                <s-table-header listSlot="primary">
                  Order/cart ref
                </s-table-header>
                <s-table-header listSlot="secondary">Product</s-table-header>
                <s-table-header>From</s-table-header>
                <s-table-header>To</s-table-header>
                <s-table-header>Message preview</s-table-header>
                <s-table-header>Date</s-table-header>
                <s-table-header>Printed</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {printMessages.map((msg) => (
                  <s-table-row key={msg.id}>
                    <s-table-cell>
                      <s-checkbox
                        accessibilityLabel={`Select message from ${
                          msg.sender || "unknown sender"
                        }`}
                        checked={selectedMessageIds.has(msg.id)}
                        onChange={(event) =>
                          toggleMessage(
                            msg.id,
                            Boolean(
                              (
                                event.currentTarget as unknown as HTMLInputElement
                              ).checked,
                            ),
                          )
                        }
                      />
                    </s-table-cell>
                    <s-table-cell>{msg.cartReference}</s-table-cell>
                    <s-table-cell>{msg.productReference || "-"}</s-table-cell>
                    <s-table-cell>{msg.sender || "-"}</s-table-cell>
                    <s-table-cell>{msg.recipient || "-"}</s-table-cell>
                    <s-table-cell>{truncateText(msg.message, 50)}</s-table-cell>
                    <s-table-cell>{msg.date}</s-table-cell>
                    <s-table-cell>
                      {msg.printed ? (
                        <s-icon type="check-circle-filled" tone="success" />
                      ) : (
                        <s-icon type="x-circle" color="subdued" />
                      )}
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </div>

          <aside className={styles.templatePane}>
            <div className={styles.paneHeader}>
              <div>
                <s-heading>Template</s-heading>
                <s-text color="subdued">{selectedTemplate.name}</s-text>
              </div>
              <s-badge>
                {CUSTOM_TEMPLATE_ID === selectedTemplateId
                  ? "Custom"
                  : "Preset"}
              </s-badge>
            </div>

            <div
              className={styles.templateGrid}
              role="radiogroup"
              aria-label="Print template"
            >
              {printTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`${styles.templateCard} ${
                    template.id === selectedTemplateId
                      ? styles.templateCardSelected
                      : ""
                  }`}
                  onClick={() => handleTemplateChange(template.id)}
                  role="radio"
                  aria-checked={template.id === selectedTemplateId}
                >
                  <span className={styles.templateRadio} aria-hidden="true">
                    <span />
                  </span>
                  <span className={styles.templateChoiceText}>
                    <span className={styles.templateName}>{template.name}</span>
                  </span>
                </button>
              ))}
            </div>

            <s-box
              background="subdued"
              borderColor="base"
              borderRadius="base"
              borderStyle="solid"
              borderWidth="small"
              padding="base"
            >
              <iframe
                title="Template preview"
                srcDoc={previewDocument}
                className={styles.previewFrame}
              />
            </s-box>

            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="small-200">
                <s-text color="subdued">Variables</s-text>
                <s-stack direction="inline" gap="small-200">
                  <s-badge>{"{{from}}"}</s-badge>
                  <s-badge>{"{{to}}"}</s-badge>
                  <s-badge>{"{{message}}"}</s-badge>
                  <s-badge>{"{{date}}"}</s-badge>
                  <s-badge>{"{{reference}}"}</s-badge>
                  <s-badge>{"{{cart_token}}"}</s-badge>
                </s-stack>
              </s-stack>
              <s-grid
                gap="base"
                gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
              >
                <s-text-field
                  label="From"
                  value={previewMessage.sender}
                  onInput={(event) =>
                    updatePreviewField(
                      "sender",
                      String(
                        (event.currentTarget as unknown as HTMLInputElement)
                          .value,
                      ),
                    )
                  }
                />
                <s-text-field
                  label="To"
                  value={previewMessage.recipient}
                  onInput={(event) =>
                    updatePreviewField(
                      "recipient",
                      String(
                        (event.currentTarget as unknown as HTMLInputElement)
                          .value,
                      ),
                    )
                  }
                />
              </s-grid>
              <s-text-area
                label="Preview message"
                rows={3}
                value={previewMessage.message}
                onInput={(event) =>
                  updatePreviewField(
                    "message",
                    String(
                      (event.currentTarget as unknown as HTMLTextAreaElement)
                        .value,
                    ),
                  )
                }
              />
              <s-text-area
                label="HTML template"
                rows={8}
                value={templateHtmlValue}
                onInput={(event) =>
                  setTemplateHtmlValue(
                    String(
                      (event.currentTarget as unknown as HTMLTextAreaElement)
                        .value,
                    ),
                  )
                }
              />
              <s-text-area
                label="CSS"
                rows={8}
                value={templateCssValue}
                onInput={(event) =>
                  setTemplateCssValue(
                    String(
                      (event.currentTarget as unknown as HTMLTextAreaElement)
                        .value,
                    ),
                  )
                }
              />
            </s-stack>

            <div className={styles.templateActions}>
              <s-button
                variant={isTemplateDirty ? "primary" : "secondary"}
                onClick={handleSaveCustomTemplate}
                disabled={!isTemplateDirty || templateFetcher.state !== "idle"}
              >
                Save custom
              </s-button>
            </div>
          </aside>
        </div>

        <div className={styles.printBar}>
          <div>
            <s-text type="strong">{selectedCount} selected</s-text>
            <s-text color="subdued">
              {selectedTemplate.name} · {dateRangeLabel} · {printedLabel}
            </s-text>
          </div>
          <div className={styles.printBarActions}>
            {selectedHasUnprinted && (
              <s-button
                onClick={() => markSelected("mark-printed")}
                disabled={messagesFetcher.state !== "idle"}
              >
                Mark as printed
              </s-button>
            )}
            {selectedHasPrinted && (
              <s-button
                variant="tertiary"
                onClick={() => markSelected("mark-unprinted")}
                disabled={messagesFetcher.state !== "idle"}
              >
                Mark as unprinted
              </s-button>
            )}
            <s-button
              variant="primary"
              onClick={handlePrint}
              disabled={selectedCount === 0}
            >
              Print now
            </s-button>
          </div>
        </div>

        {printPreviewHtml && (
          <div
            className={styles.printPreviewOverlay}
            role="dialog"
            aria-modal="true"
            aria-label="Print preview"
          >
            <div className={styles.printPreviewModal}>
              <div className={styles.printPreviewHeader}>
                <div className={styles.printPreviewTitle}>
                  <span className={styles.printPreviewIcon}>P</span>
                  <span>Print preview</span>
                </div>
                <button
                  type="button"
                  className={styles.printPreviewClose}
                  onClick={closePrintPreview}
                  aria-label="Close print preview"
                >
                  x
                </button>
              </div>

              <div className={styles.printPreviewBody}>
                <iframe
                  ref={printPreviewFrameRef}
                  title="Selected gift messages print preview"
                  srcDoc={printPreviewHtml}
                  className={styles.printPreviewDocument}
                />
                <div className={styles.printPreviewSummary}>
                  <s-text type="strong">
                    {selectedCount} gift message
                    {selectedCount === 1 ? "" : "s"} ready to print.
                  </s-text>
                  <s-text color="subdued">
                    Use the preview to check the selected messages before
                    printing.
                  </s-text>
                  <s-checkbox
                    key={`mark-after-print-${String(markPrintedAfterPrint)}`}
                    defaultChecked={markPrintedAfterPrint}
                    label="Mark messages as printed after printing"
                    onChange={(event) =>
                      setMarkPrintedAfterPrint(
                        Boolean(
                          (event.currentTarget as unknown as HTMLInputElement)
                            .checked,
                        ),
                      )
                    }
                  />
                </div>
              </div>

              <div className={styles.printPreviewFooter}>
                <s-button onClick={closePrintPreview}>Cancel</s-button>
                <s-button variant="primary" onClick={continuePrint}>
                  Continue to print
                </s-button>
              </div>
            </div>
          </div>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
