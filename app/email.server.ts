const RECIPIENT = process.env.CONTACT_EMAIL ?? "damianbe86@gmail.com";

export async function sendContactEmail({
  type,
  subject,
  message,
  replyEmail,
  shop,
}: {
  type: string;
  subject: string;
  message: string;
  replyEmail?: string;
  shop: string;
}) {
  const payload = {
    app: "Gift Message Bridge Lite",
    type,
    subject,
    message,
    replyEmail,
    shop,
    recipient: RECIPIENT,
  };

  if (process.env.CONTACT_WEBHOOK_URL) {
    await fetch(process.env.CONTACT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return payload;
  }

  console.log("[email.server] Contact email webhook not configured:", payload);
  return payload;
}
