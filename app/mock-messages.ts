/**
 * Shared mock gift messages used by Dashboard and Print Setup
 * when the database has no real data yet.
 */
export type MockGiftMessage = {
  id: string;
  sourceId: string;
  cartToken: string;
  cartReference?: string;
  mode: "order" | "product";
  sender: string;
  recipient: string;
  message: string;
  productId?: string;
  productTitle?: string;
  productVariantTitle?: string;
  productSku?: string;
  productHandle?: string;
  printed?: boolean;
  date: string; // "Mon DD, YYYY"
};

export const MOCK_GIFT_MESSAGES: MockGiftMessage[] = [
  {
    id: "demo-01",
    sourceId: "cart:f3a8c091ab2d",
    cartToken: "f3a8c091ab2d",
    mode: "order",
    sender: "Emma Wilson",
    recipient: "Noah Lee",
    message:
      "Congrats on your new home! Wishing you so much joy in this new chapter.",
    date: "Apr 28, 2026",
  },
  {
    id: "demo-02",
    sourceId: "product:b72e4d15cc81",
    cartToken: "b72e4d15cc81",
    mode: "product",
    sender: "Sarah Chen",
    recipient: "Michael Torres",
    productId: "gid://shopify/Product/1001",
    productTitle: "Signature Candle",
    productVariantTitle: "Amber / Large",
    productSku: "CND-AMB-L",
    productHandle: "signature-candle",
    message:
      "Thank you for always being there when I needed you most. This is for you.",
    date: "Apr 27, 2026",
  },
  {
    id: "demo-03",
    sourceId: "cart:9c01fa83de44",
    cartToken: "9c01fa83de44",
    mode: "order",
    sender: "James Park",
    recipient: "Lily Park",
    message:
      "Happy anniversary, love. Twenty years and you still make every day feel new.",
    date: "Apr 27, 2026",
  },
  {
    id: "demo-04",
    sourceId: "product:2d6b0e47ff09",
    cartToken: "2d6b0e47ff09",
    mode: "product",
    sender: "Olivia Kim",
    recipient: "Carter Williams",
    productId: "gid://shopify/Product/1002",
    productTitle: "Ceramic Mug",
    productVariantTitle: "White",
    productSku: "MUG-WHT",
    productHandle: "ceramic-mug",
    message:
      "Happy birthday! Hope this makes your day as bright as you make everyone else's.",
    printed: true,
    date: "Apr 24, 2026",
  },
  {
    id: "demo-05",
    sourceId: "cart:e4a7c312ba56",
    cartToken: "e4a7c312ba56",
    mode: "order",
    sender: "Liam Garcia",
    recipient: "Sophia Martin",
    message:
      "Get well soon — thinking of you every day and sending all my love your way.",
    date: "Apr 23, 2026",
  },
  {
    id: "demo-06",
    sourceId: "product:71fd2e98cd30",
    cartToken: "71fd2e98cd30",
    mode: "product",
    sender: "Maya Johnson",
    recipient: "Daniel Lee",
    productId: "gid://shopify/Product/1003",
    productTitle: "Linen Throw",
    productVariantTitle: "Sage",
    productSku: "THR-SAGE",
    productHandle: "linen-throw",
    message:
      "Congratulations on your graduation! So proud of everything you've achieved.",
    date: "Apr 22, 2026",
  },
  {
    id: "demo-07",
    sourceId: "cart:a08b35c1e72f",
    cartToken: "a08b35c1e72f",
    mode: "order",
    sender: "Ryan Scott",
    recipient: "Ava Thompson",
    message:
      "Thank you for the most wonderful weekend. You made it absolutely unforgettable.",
    date: "Apr 21, 2026",
  },
  {
    id: "demo-08",
    sourceId: "product:3f59d0b7a41c",
    cartToken: "3f59d0b7a41c",
    mode: "product",
    sender: "Isabella Brown",
    recipient: "Ethan Davis",
    productId: "gid://shopify/Product/1001",
    productTitle: "Signature Candle",
    productVariantTitle: "Cedar / Small",
    productSku: "CND-CDR-S",
    productHandle: "signature-candle",
    message:
      "Merry Christmas! Hope this little gift brings extra warmth and joy to your holiday.",
    printed: true,
    date: "Apr 20, 2026",
  },
  {
    id: "demo-09",
    sourceId: "cart:c6281af4d053",
    cartToken: "c6281af4d053",
    mode: "order",
    sender: "Lucas Wilson",
    recipient: "Charlotte Moore",
    message:
      "Happy Mother's Day — we love you more than words can say. Thank you for everything.",
    date: "Apr 19, 2026",
  },
  {
    id: "demo-10",
    sourceId: "product:8e04b67290da",
    cartToken: "8e04b67290da",
    mode: "product",
    sender: "Amelia Taylor",
    recipient: "Henry Jackson",
    productId: "gid://shopify/Product/1004",
    productTitle: "Gift Box",
    productVariantTitle: "Classic",
    productSku: "BOX-CLS",
    productHandle: "gift-box",
    message:
      "Just a little something to remind you how much you are loved and appreciated.",
    printed: true,
    date: "Apr 18, 2026",
  },
];
