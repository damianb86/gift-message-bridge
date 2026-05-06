import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Log in">
          <s-paragraph>
            Open this app from Shopify admin or the Shopify App Store to start
            authentication.
          </s-paragraph>
          {errors.shop && (
            <s-banner tone="critical" heading="Authentication could not start">
              Please return to Shopify and open the app again.
            </s-banner>
          )}
        </s-section>
      </s-page>
    </AppProvider>
  );
}
