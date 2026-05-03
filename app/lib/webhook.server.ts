import { authenticate } from "../shopify.server";

export async function authenticateWebhook(request: Request) {
  try {
    return await authenticate.webhook(request);
  } catch (error) {
    if (error instanceof Response && error.status === 401) {
      throw new Response("Bad Request", { status: 400 });
    }

    throw error;
  }
}
