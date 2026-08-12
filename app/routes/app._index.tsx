import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import "../home-page.css";
import { Gift, Sparkles } from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // 1. Fetch counts using Shopify GraphQL Admin API
  const countResponse = await admin.graphql(
    `#graphql
    query GetGiftCardStats {
      all: giftCardsCount {
        count
      }
      active: giftCardsCount(query: "status:enabled") {
        count
      }
      disabled: giftCardsCount(query: "status:disabled") {
        count
      }
    }`
  );
  
  const countJson = await countResponse.json();
  const totalCount = countJson.data?.all?.count || 0;
  const activeCount = countJson.data?.active?.count || 0;
  const disabledCount = countJson.data?.disabled?.count || 0;

  // 2. Fetch list of cards to sum balance (up to 250 cards)
  const listResponse = await admin.graphql(
    `#graphql
    query GetBalances {
      giftCards(first: 250) {
        edges {
          node {
            balance {
              amount
            }
          }
        }
      }
      shop {
        currencyCode
      }
    }`
  );

  const listJson = await listResponse.json();
  const shopCurrency = listJson.data?.shop?.currencyCode || "USD";
  const cards = (listJson.data?.giftCards?.edges || []).map((e: any) => e.node);

  let totalBalance = 0;
  for (const card of cards) {
    totalBalance += parseFloat(card.balance?.amount || "0");
  }

  // 3. Fetch checklist task states
  const hasImported = await db.activityLog.count({
    where: { shop: session.shop, action: "CSV Import" }
  }) > 0;

  const hasViewedLogs = await db.activityLog.count({
    where: { shop: session.shop, action: "Viewed Logs" }
  }) > 0;

  return {
    stats: {
      total: totalCount,
      active: activeCount,
      disabled: disabledCount,
      totalBalance,
      currencyCode: shopCurrency,
    },
    checklist: {
      step1: totalCount > 0,
      step2: hasImported,
      step3: hasViewedLogs,
    }
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
            demoInfo: metafield(namespace: "$app", key: "demo_info") {
              jsonValue
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
          metafields: [
            {
              namespace: "$app",
              key: "demo_info",
              value: "Created by React Router Template",
            },
          ],
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  const metaobjectResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpsertMetaobject($handle: MetaobjectHandleInput!, $values: JSON!) {
      metaobjectUpsert(handle: $handle, values: $values) {
        metaobject {
          id
          handle
          values
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        handle: {
          type: "$app:example",
          handle: "demo-entry",
        },
        values: {
          title: "Demo Entry",
          description:
            "This metaobject was created by the Shopify app template to demonstrate the metaobject API.",
        },
      },
    },
  );

  const metaobjectResponseJson = await metaobjectResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
    metaobject: metaobjectResponseJson!.data!.metaobjectUpsert!.metaobject,
  };
};

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);

  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Cardora">
      {/* Premium Hero Banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Cardora</h1>
          <p className="hero-subtitle">
            Create, manage, and track your store's gift cards in one place. Boost merchant sales, run custom campaigns, and retain loyal customers with ease.
          </p>
        </div>
        <div className="hero-decoration">
          <div className="hero-gift-badge">
            <Gift size={28} />
          </div>
          <div className="hero-sparkle-1"><Sparkles size={16} /></div>
          <div className="hero-sparkle-2"><Sparkles size={14} /></div>
        </div>
      </div>
      <s-section>
        <s-heading>Quick Actions</s-heading>
        <s-stack gap="large-300">
          <s-paragraph>Choose an action to get started</s-paragraph>
          <s-grid alignItems="start" gridTemplateColumns="repeat(3, 1fr)" gap="large-100 large-500">
            <s-link href="/app/gift-cards">
              <s-grid-item>
                <s-grid gridTemplateColumns="30% 70%">
                  <s-grid-item>
                    <div style={{ width: "45px", height: "45px" }}>
                      <s-image src="/plus-heading.png" />
                    </div>
                  </s-grid-item>
                  <s-grid-item>
                    <s-heading>Create Gift Cards</s-heading>
                    <s-paragraph>Create single or multiple gift cards</s-paragraph>
                  </s-grid-item>
                </s-grid>
              </s-grid-item>
            </s-link>
            <s-link href="/app/activity-log">
              <s-grid-item>
                <s-grid gridTemplateColumns="30% 70%">
                  <s-grid-item>
                    <div style={{ width: "45px", height: "45px" }}>
                      <s-image src="/pencil-icon.png" />
                    </div>
                  </s-grid-item>
                  <s-grid-item>
                    <s-heading>Activity Log</s-heading>
                    <s-paragraph>Track card creations and merchant actions</s-paragraph>
                  </s-grid-item>
                </s-grid>
              </s-grid-item>
            </s-link>
            <s-grid-item>
              <s-grid gridTemplateColumns="30% 70%">
                <s-grid-item>
                  <div style={{ width: "45px", height: "45px" }}>
                    <s-image src="/import-icon.png" />
                  </div>
                </s-grid-item>
                <s-grid-item>
                  <s-heading>Import Gift Cards</s-heading>
                  <s-paragraph>Import Gift Cards via CSV</s-paragraph>
                </s-grid-item>
              </s-grid>
            </s-grid-item>
          </s-grid>
        </s-stack>
      </s-section>

      {/* Get started & Gift card overview sections */}
      <div className="home-two-col">
        {/* Get Started Steps Checklist */}
        <div className="home-card">
          <span className="home-card-title">Get started</span>
          <div className="steps-container">
            <div className="steps-line"></div>

            {/* Step 1: Create your first gift card */}
            <div className="step-item">
              <div className="step-left">
                <div className={`step-circle ${loaderData.checklist.step1 ? "step-circle-completed" : "step-circle-pending"}`}>
                  {loaderData.checklist.step1 ? (
                    <svg viewBox="0 0 20 20" style={{ width: "18px", height: "18px", fill: "currentColor" }}>
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>1</span>
                  )}
                </div>
                <div className="step-details">
                  <span className="step-title">Create your first gift card</span>
                  <span className="step-sub">Generate a single or bulk gift card</span>
                </div>
              </div>
              <s-link href="/app/gift-cards?openModal=true">
                <span
                  className="btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "13px" }}
                >
                  Create gift cards
                </span>
              </s-link>
            </div>

            {/* Step 2: Import gift cards */}
            <div className="step-item">
              <div className="step-left">
                <div className={`step-circle ${loaderData.checklist.step2 ? "step-circle-completed" : "step-circle-pending"}`}>
                  {loaderData.checklist.step2 ? (
                    <svg viewBox="0 0 20 20" style={{ width: "18px", height: "18px", fill: "currentColor" }}>
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>2</span>
                  )}
                </div>
                <div className="step-details">
                  <span className="step-title">Import gift cards</span>
                  <span className="step-sub">Import existing gift cards using CSV</span>
                </div>
              </div>
              <s-link href="/app/gift-cards?openModal=true&tab=import">
                <span
                  className="btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "13px" }}
                >
                  Import now
                </span>
              </s-link>
            </div>

            {/* Step 3: Show activity log */}
            <div className="step-item">
              <div className="step-left">
                <div className={`step-circle ${loaderData.checklist.step3 ? "step-circle-completed" : "step-circle-pending"}`}>
                  {loaderData.checklist.step3 ? (
                    <svg viewBox="0 0 20 20" style={{ width: "18px", height: "18px", fill: "currentColor" }}>
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>3</span>
                  )}
                </div>
                <div className="step-details">
                  <span className="step-title">Show activity log</span>
                  <span className="step-sub">Track all gift card actions and campaigns</span>
                </div>
              </div>
              <s-link href="/app/activity-log">
                <span
                  className="btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "13px" }}
                >
                  View logs
                </span>
              </s-link>
            </div>
          </div>
        </div>

        {/* Gift Card Overview */}
        <div className="home-card">
          <span className="home-card-title">Gift card overview</span>
          <div className="overview-grid">
            <div className="overview-card">
              <span className="overview-card-title">Total gift cards</span>
              <span className="overview-card-value">{loaderData.stats.total.toLocaleString()}</span>
            </div>
            <div className="overview-card">
              <span className="overview-card-title">Active gift cards</span>
              <span className="overview-card-value overview-card-value-green">
                {loaderData.stats.active.toLocaleString()}
              </span>
            </div>
            <div className="overview-card">
              <span className="overview-card-title">Total balance</span>
              <span className="overview-card-value">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: loaderData.stats.currencyCode,
                }).format(loaderData.stats.totalBalance)}
              </span>
            </div>
            <div className="overview-card">
              <span className="overview-card-title">Disabled / Expired</span>
              <span className="overview-card-value overview-card-value-orange">
                {loaderData.stats.disabled.toLocaleString()}
              </span>
            </div>
          </div>
          <s-link href="/app/gift-cards">
            <span className="overview-link">
              <span>View all gift cards</span>
              <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "currentColor" }}>
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.22 5.08a.75.75 0 1 1 1.06-1.06l5.5 5.5a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 1 1-1.06-1.06l4.168-4.17H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </span>
          </s-link>
        </div>
      </div>

      {/* Bottom banner: Secure. Compliant. Reliable. */}
      <div className="banner-card">
        <div className="banner-left">
          <div className="banner-icon-shield">
            <svg viewBox="0 0 20 20" style={{ width: "20px", height: "20px", fill: "currentColor" }}>
              <path fillRule="evenodd" d="M10.338 1.15a.75.75 0 0 0-.676 0c-.57.307-1.263.608-1.996.84a25.291 25.291 0 0 1-3.186.772.75.75 0 0 0-.606.62c-.246 1.764-.298 3.86.136 6.002.428 2.112 1.34 4.3 3.012 6.09a.75.75 0 0 0 1.085 0c1.673-1.79 2.585-3.978 3.013-6.09.434-2.142.382-4.238.136-6.002a.75.75 0 0 0-.606-.62 25.292 25.292 0 0 1-3.186-.772c-.733-.232-1.427-.533-1.996-.84ZM10 13.913c-.93-.896-1.636-2.229-1.97-3.883-.341-1.685-.308-3.32-.128-4.66.702-.15 1.488-.344 2.098-.537.61-.193 1.116-.39 1.116-.39s.507.197 1.117.39c.61.193 1.396.387 2.098.538.18 1.339.213 2.974-.128 4.66-.334 1.654-1.04 2.987-1.97 3.882v-.004Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="banner-text-group">
            <span className="banner-title">Secure. Compliant. Reliable.</span>
            <span className="banner-sub">Gift Card Manager uses Shopify's secure APIs and follows best practices to keep your data safe.</span>
          </div>
        </div>
        <div className="banner-icon-lock">
          <svg viewBox="0 0 20 20" style={{ width: "20px", height: "20px", fill: "currentColor" }}>
            <path fillRule="evenodd" d="M10 2a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4Zm2 6V6a2 2 0 1 0-4 0v2h4Zm-2 5.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
