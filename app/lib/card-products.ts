export type CardProductVariantOption = {
  available: boolean;
  imageAlt: string;
  imageUrl: string;
  price: string;
  sku: string;
  title: string;
  variantGid: string;
  variantId: string;
};

export type CardProductConfig = {
  handle: string;
  imageAlt: string;
  imageUrl: string;
  productGid: string;
  title: string;
  variants: CardProductVariantOption[];
};

export function parseCardProductConfig(
  value?: null | string,
): CardProductConfig | null {
  if (!value) return null;

  try {
    return normalizeCardProductConfig(JSON.parse(value));
  } catch {
    return null;
  }
}

export function serializeCardProductConfig(
  product: CardProductConfig | null,
): string {
  const normalizedProduct = normalizeCardProductConfig(product);
  return JSON.stringify(normalizedProduct);
}

function normalizeCardProductConfig(value: unknown): CardProductConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const productGid = cleanString(item.productGid);
  const title = cleanString(item.title);
  const variants = Array.isArray(item.variants)
    ? item.variants
        .map((variant) => normalizeCardProductVariantOption(variant))
        .filter((variant): variant is CardProductVariantOption =>
          Boolean(variant),
        )
    : [];

  if (!productGid || !title || variants.length === 0) {
    return null;
  }

  return {
    handle: cleanString(item.handle),
    imageAlt: cleanString(item.imageAlt),
    imageUrl: cleanString(item.imageUrl),
    productGid,
    title,
    variants,
  };
}

function normalizeCardProductVariantOption(
  value: unknown,
): CardProductVariantOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const title = cleanString(item.title);
  const variantId = cleanString(item.variantId);

  if (!title || !variantId) {
    return null;
  }

  return {
    available: typeof item.available === "boolean" ? item.available : true,
    imageAlt: cleanString(item.imageAlt),
    imageUrl: cleanString(item.imageUrl),
    price: cleanString(item.price),
    sku: cleanString(item.sku),
    title,
    variantGid: cleanString(item.variantGid),
    variantId,
  };
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}
