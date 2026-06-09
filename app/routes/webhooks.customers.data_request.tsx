import type { ActionFunctionArgs } from "react-router";
import { sendContactEmail } from "../email.server";
import { authenticateWebhook } from "../lib/webhook.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticateWebhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await sendContactEmail({
      type: "Privacy webhook: customers/data_request",
      subject: "Customer data request received",
      shop,
      message: [
        `Shop: ${shop}`,
        "",
        "Shopify sent a customers/data_request privacy webhook.",
        "Gift Pulse does not store Shopify customer account records or customer IDs.",
        "Review any free-text gift message content for the requested orders if required.",
        "",
        JSON.stringify(payload, null, 2),
      ].join("\n"),
    });
  } catch (error) {
    console.error("[webhooks.customers.data_request]", error);
  }

  return new Response();
};
