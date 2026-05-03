import type { ActionFunctionArgs } from "react-router";
import { authenticateWebhook } from "../lib/webhook.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticateWebhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  return new Response();
};
