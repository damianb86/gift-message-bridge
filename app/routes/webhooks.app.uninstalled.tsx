import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { notifyAppUninstalled } from "../lib/app-lifecycle-email.server";
import { authenticateWebhook } from "../lib/webhook.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticateWebhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await notifyAppUninstalled({ payload, shop, topic });

  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
