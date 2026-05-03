import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <main className={styles.index}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.badge}>Gift message operations</span>
          <h1 className={styles.heading}>Gift Message Bridge Lite</h1>
          <p className={styles.text}>
            Collect gift notes from your storefront, keep them tied to the right
            cart or product, and print clear cards for the packing table.
          </p>
          <div className={styles.highlights} aria-label="Core workflows">
            <span>Storefront capture</span>
            <span>Admin review</span>
            <span>Print-ready notes</span>
          </div>
        </div>

        <div className={styles.workbench} aria-hidden="true">
          <div className={styles.printQueue}>
            <div className={styles.queueHeader}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.queueItem}>
              <strong>Ready to print</strong>
              <small>Gift card queued</small>
            </div>
            <div className={styles.queueItem}>
              <strong>Needs review</strong>
              <small>Product note saved</small>
            </div>
            <div className={styles.queueItemMuted}>
              <strong>Printed</strong>
              <small>4 cards packed</small>
            </div>
          </div>

          <div className={styles.giftCard}>
            <div className={styles.ribbon} />
            <div className={styles.notePaper}>
              <span>Gift note</span>
              <p>Message saved with sender, recipient, and fulfillment context.</p>
              <small>Ready for packing</small>
            </div>
          </div>
        </div>

        <div className={styles.loginPanel}>
          <div>
            <h2>Open the embedded app</h2>
            <p>Enter your Shopify store domain to continue inside admin.</p>
          </div>
          {showForm && (
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label}>
                <span>Shop domain</span>
                <input
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="my-store.myshopify.com"
                  autoComplete="organization"
                />
                <small>Use the full myshopify.com domain.</small>
              </label>
              <button className={styles.button} type="submit">
                Log in
              </button>
            </Form>
          )}
        </div>
      </section>

      <section className={styles.workflow} aria-label="Gift message workflow">
        <article>
          <strong>Capture clean notes</strong>
          <span>
            Add gift-message fields where shoppers expect them, then save sender
            and recipient details with the message.
          </span>
        </article>
        <article>
          <strong>Keep fulfillment aligned</strong>
          <span>
            Review messages in admin with product context, cart references, and
            printed status for packing teams.
          </span>
        </article>
        <article>
          <strong>Print without clutter</strong>
          <span>
            Generate short-lived print pages and simple templates that work at
            the packing station.
          </span>
        </article>
      </section>
    </main>
  );
}
