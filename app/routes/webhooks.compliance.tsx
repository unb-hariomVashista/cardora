import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received compliance webhook: ${topic} for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Handle customer data request
      // Since this app does not store customer personal data, there is nothing to return or report.
      break;

    case "CUSTOMERS_REDACT":
      // Handle customer data deletion request
      // Since this app does not store customer personal data, there is nothing to delete.
      break;

    case "SHOP_REDACT":
      // Handle shop data deletion request
      // Delete all sessions and activity logs related to this shop to comply with GDPR/CCPA.
      console.log(`Deleting all session and activity log data for shop: ${shop}`);
      await db.session.deleteMany({
        where: { shop },
      });
      await db.activityLog.deleteMany({
        where: { shop },
      });
      break;

    default:
      return new Response("Unhandled webhook topic", { status: 400 });
  }

  return new Response();
};
