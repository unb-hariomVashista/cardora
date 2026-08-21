import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData, useSearchParams, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { Check, Zap, Gift, ShieldCheck, ArrowRight, HelpCircle } from "lucide-react";
import "../gift-cards.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const billingCheck = await billing.check({
    plans: ["monthlyPaid"],
    isTest: true,
  } as any);

  const hasPaidPlan = billingCheck.hasActivePayment;

  // Fetch current gift cards count
  const countResponse = await admin.graphql(
    `#graphql
    query GetGiftCardStats {
      all: giftCardsCount {
        count
      }
    }`
  );
  const countJson = await countResponse.json();
  const giftCardsCount = countJson.data?.all?.count || 0;

  const url = new URL(request.url);
  const subscribed = url.searchParams.get("subscribed") === "true";
  const downgraded = url.searchParams.get("downgraded") === "true";

  if (subscribed) {
    try {
      await db.activityLog.create({
        data: {
          shop: session.shop,
          action: "Plan Upgraded",
          description: "Upgraded subscription to Pro Plan ($4/mo, Unlimited gift cards)",
          performedBy: "Merchant",
        },
      });
    } catch (err) {
      console.error("[Cardora] Failed to record ActivityLog for Upgrade:", err);
    }
  }

  return {
    hasPaidPlan,
    giftCardsCount,
    subscribed,
    downgraded,
    shop: session.shop,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const formAction = formData.get("action") as string || "";

  if (formAction === "upgrade") {
    const url = new URL(request.url);
    const shopHandle = session.shop.replace(".myshopify.com", "");
    const apiKey = process.env.SHOPIFY_API_KEY;

    const returnUrl = (apiKey && shopHandle)
      ? `https://admin.shopify.com/store/${shopHandle}/apps/${apiKey}/app/pricing?subscribed=true`
      : `${url.origin}/app/pricing?subscribed=true`;

    return await billing.request({
      plan: "monthlyPaid",
      isTest: true,
      returnUrl,
    } as any);
  }

  if (formAction === "downgrade") {
    const billingCheck = await billing.check({
      plans: ["monthlyPaid"],
      isTest: true,
    } as any);

    const subscription = billingCheck.appSubscriptions?.[0];
    if (subscription?.id) {
      await billing.cancel({
        subscriptionId: subscription.id,
        isTest: true,
        prorate: true,
      });
    }

    try {
      await db.activityLog.create({
        data: {
          shop: session.shop,
          action: "Plan Downgraded",
          description: "Downgraded subscription to Free Plan ($0/mo, 20 gift cards limit)",
          performedBy: "Merchant",
        },
      });
    } catch (err) {
      console.error("[Cardora] Failed to record ActivityLog for Downgrade:", err);
    }

    return redirect("/app/pricing?downgraded=true");
  }

  return null;
};

export default function PricingPage() {
  const { hasPaidPlan, giftCardsCount, subscribed, downgraded } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (subscribed) {
      shopify.toast.show("Successfully upgraded to Pro Plan!");
    } else if (downgraded) {
      shopify.toast.show("Successfully downgraded to Free Plan.");
    }
  }, [subscribed, downgraded, shopify]);

  const dismissBanner = () => {
    setSearchParams((prev) => {
      prev.delete("subscribed");
      prev.delete("downgraded");
      return prev;
    });
  };

  return (
    <s-page heading="Cardora - Pricing Plans">
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "16px 20px 40px" }}>
        
        {/* Success / Info Alerts */}
        {subscribed && (
          <div style={{
            backgroundColor: "#ecfdf5",
            border: "1px solid #10b981",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#065f46"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Zap size={20} color="#10b981" />
              <div>
                <strong>Upgrade Successful!</strong> You are now subscribed to the Pro Plan with unlimited gift card creation.
              </div>
            </div>
            <button
              onClick={dismissBanner}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#065f46", fontWeight: "bold" }}
            >
              Dismiss
            </button>
          </div>
        )}

        {downgraded && (
          <div style={{
            backgroundColor: "#fefce8",
            border: "1px solid #eab308",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#854d0e"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Gift size={20} color="#eab308" />
              <div>
                <strong>Plan Updated:</strong> Your subscription has been downgraded to the Free Plan.
              </div>
            </div>
            <button
              onClick={dismissBanner}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#854d0e", fontWeight: "bold" }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginBottom: "8px" }}>
            Flexible Plans for Every Growing Merchant
          </h1>
          <p style={{ fontSize: "15px", color: "#6b7280", maxWidth: "600px", margin: "0 auto" }}>
            Upgrade or downgrade your plan anytime directly inside Shopify Admin. No support tickets or app reinstalls needed.
          </p>
        </div>

        {/* Pricing Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          marginBottom: "40px"
        }}>

          {/* FREE PLAN CARD */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: !hasPaidPlan ? "2px solid #5c36cd" : "1px solid #e5e7eb",
            boxShadow: !hasPaidPlan ? "0 10px 25px -5px rgba(92, 54, 205, 0.1)" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            transition: "all 0.2s ease"
          }}>
            {!hasPaidPlan && (
              <span style={{
                position: "absolute",
                top: "-12px",
                right: "24px",
                backgroundColor: "#5c36cd",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "700",
                padding: "3px 12px",
                borderRadius: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Active Plan
              </span>
            )}

            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", marginBottom: "4px" }}>Free Plan</h2>
              <p style={{ fontSize: "13px", color: "#6b7280" }}>Ideal for stores getting started with digital gift cards.</p>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "24px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "#111827" }}>$0</span>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>/ month</span>
            </div>

            {/* Progress bar on Free Plan */}
            {!hasPaidPlan && (
              <div style={{
                backgroundColor: "#f9fafb",
                border: "1px solid #f3f4f6",
                borderRadius: "8px",
                padding: "12px 14px",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#374151", fontWeight: "600", marginBottom: "6px" }}>
                  <span>Free Plan Usage</span>
                  <span>{giftCardsCount} / 20 cards</span>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (giftCardsCount / 20) * 100)}%`, height: "100%", backgroundColor: "#5c36cd", borderRadius: "3px" }} />
                </div>
              </div>
            )}

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#10b981" />
                <span>Up to <strong>20 Gift Cards</strong> total</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#10b981" />
                <span>CSV Import & Export</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#10b981" />
                <span>Basic Activity Logging</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#10b981" />
                <span>Automated Email Notifications</span>
              </li>
            </ul>

            {!hasPaidPlan ? (
              <button
                disabled
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f3f4f6",
                  color: "#9ca3af",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "not-allowed"
                }}
              >
                Current Active Plan
              </button>
            ) : (
              <Form method="post">
                <input type="hidden" name="action" value="downgrade" />
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #dc2626",
                    backgroundColor: "#ffffff",
                    color: "#dc2626",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onClick={(e) => {
                    if (!confirm("Are you sure you want to downgrade to the Free Plan?")) {
                      e.preventDefault();
                    }
                  }}
                >
                  Downgrade to Free Plan
                </button>
              </Form>
            )}
          </div>

          {/* PAID PLAN CARD */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: hasPaidPlan ? "2px solid #10b981" : "2px solid #7c3aed",
            boxShadow: "0 12px 30px -5px rgba(124, 58, 237, 0.15)",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            transition: "all 0.2s ease"
          }}>
            <span style={{
              position: "absolute",
              top: "-12px",
              right: "24px",
              background: hasPaidPlan ? "#10b981" : "linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "700",
              padding: "3px 12px",
              borderRadius: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              {hasPaidPlan ? "Active Plan" : "Most Popular"}
            </span>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", marginBottom: "4px" }}>Pro Plan</h2>
                <Zap size={18} color="#7c3aed" />
              </div>
              <p style={{ fontSize: "13px", color: "#6b7280" }}>For growing stores that need unlimited gift card generation.</p>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "24px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "#111827" }}>$4</span>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>/ month</span>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#111827", fontWeight: "600" }}>
                <Check size={18} color="#7c3aed" />
                <span>UNLIMITED Gift Cards creation</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#7c3aed" />
                <span>CSV Import & Bulk Generation</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#7c3aed" />
                <span>Full Audit & Activity Trail</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#7c3aed" />
                <span>Instant Email Delivery to Store Email</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#374151" }}>
                <Check size={18} color="#7c3aed" />
                <span>Priority Customer Support</span>
              </li>
            </ul>

            {hasPaidPlan ? (
              <button
                disabled
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #10b981",
                  backgroundColor: "#ecfdf5",
                  color: "#065f46",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: "default"
                }}
              >
                Current Active Plan
              </button>
            ) : (
              <Form method="post">
                <input type="hidden" name="action" value="upgrade" />
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(90deg, #6d28d9 0%, #7c3aed 100%)",
                    color: "#ffffff",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(109, 40, 217, 0.3)",
                    transition: "all 0.2s ease"
                  }}
                >
                  Upgrade to Pro ($4/mo)
                </button>
              </Form>
            )}
          </div>

        </div>

        {/* Billing Guarantees & FAQ */}
        <div style={{
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "28px 32px"
        }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldCheck size={20} color="#5c36cd" />
            Shopify Secure Billing Details
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>
                Instant Plan Switching
              </h4>
              <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.5" }}>
                You can upgrade or downgrade your plan at any time. Changes are reflected immediately in your merchant account and charge history.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>
                Safe & Seamless Charges
              </h4>
              <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.5" }}>
                All app charges are processed securely through Shopify's Billing API and appear directly on your official Shopify invoice.
              </p>
            </div>
          </div>
        </div>

      </div>
    </s-page>
  );
}

export function ErrorBoundary() {
  const error: any = useRouteError();

  useEffect(() => {
    if (error?.data && typeof error.data === "string" && error.data.includes("<script")) {
      const div = document.createElement("div");
      div.innerHTML = error.data;
      const scripts = div.querySelectorAll("script");
      scripts.forEach((oldScript) => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) =>
          newScript.setAttribute(attr.name, attr.value)
        );
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        document.body.appendChild(newScript);
      });
    }
  }, [error]);

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
