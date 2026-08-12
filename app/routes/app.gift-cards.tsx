import { useState, useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useActionData, useSubmit, useSearchParams, useNavigation, useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import "../gift-cards.css";
import { sendGiftCardsEmail } from "../utils/email.server";
import db from "../db.server";
import { X, Info, Search, Filter, Download } from "lucide-react";
import { KpiGrid } from "../components/gift-cards/KpiGrid";
import { SuccessBanner } from "../components/gift-cards/SuccessBanner";
import { CreateGiftCardModal } from "../components/gift-cards/CreateGiftCardModal";
import { GiftCardsTable } from "../components/gift-cards/GiftCardsTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);
  const billingCheck = await billing.check({
    plans: ["monthlyPaid"],
    isTest: true,
  } as any);
  const hasPaidPlan = billingCheck.hasActivePayment;
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "10", 10);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "All";
  const sortKey = url.searchParams.get("sortKey") || "createdAt";
  const sortDirection = url.searchParams.get("sortDirection") || "desc";
  const balanceStatus = url.searchParams.get("balanceStatus") || "All";
  const expiresBefore = url.searchParams.get("expiresBefore") || "";

  // 1. Build query for matching cards in the table
  const queryParts: string[] = [];
  if (status === "Active") {
    queryParts.push("status:enabled");
  } else if (status === "Disabled") {
    queryParts.push("status:disabled");
  } else if (status === "Spent") {
    queryParts.push("status:enabled AND balance_status:empty");
  }

  if (search) {
    queryParts.push(search);
  }

  if (balanceStatus !== "All") {
    queryParts.push(`balance_status:${balanceStatus}`);
  }

  if (expiresBefore) {
    queryParts.push(`expires_on:<=${expiresBefore}`);
  }

  const queryStr = queryParts.length > 0 ? queryParts.join(" AND ") : undefined;

  // 2. Fetch all dashboard data (stats counts, balances, matching lists) in a SINGLE GraphQL query
  const dashboardResponse = await admin.graphql(
    `#graphql
    query GetGiftCardDashboardData($query: String) {
      shop {
        currencyCode
      }
      total: giftCardsCount {
        count
      }
      active: giftCardsCount(query: "status:enabled") {
        count
      }
      disabled: giftCardsCount(query: "status:disabled") {
        count
      }
      balanceCards: giftCards(first: 250) {
        edges {
          node {
            balance {
              amount
            }
          }
        }
      }
      listCards: giftCards(first: 250, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            createdAt
            expiresOn
            lastCharacters
            enabled
            initialValue {
              amount
              currencyCode
            }
            balance {
              amount
              currencyCode
            }
          }
        }
      }
    }`,
    {
      variables: {
        query: queryStr,
      },
    }
  );

  const dashboardJson = await dashboardResponse.json();
  
  const shopCurrency = dashboardJson.data?.shop?.currencyCode || "USD";
  const totalCount = dashboardJson.data?.total?.count || 0;
  const activeCount = dashboardJson.data?.active?.count || 0;
  const disabledCount = dashboardJson.data?.disabled?.count || 0;

  // Calculate total balance
  const balanceEdges = dashboardJson.data?.balanceCards?.edges || [];
  let totalBalance = 0;
  for (const edge of balanceEdges) {
    totalBalance += parseFloat(edge.node.balance?.amount || "0");
  }

  // Extract matching cards list
  const allMatchedCards = (dashboardJson.data?.listCards?.edges || []).map((e: any) => e.node);

  // Sort matched cards based on sortKey and sortDirection
  allMatchedCards.sort((a: any, b: any) => {
    let valA: any;
    let valB: any;

    if (sortKey === "initialValue") {
      valA = parseFloat(a.initialValue?.amount || "0");
      valB = parseFloat(b.initialValue?.amount || "0");
    } else if (sortKey === "balance") {
      valA = parseFloat(a.balance?.amount || "0");
      valB = parseFloat(b.balance?.amount || "0");
    } else if (sortKey === "createdAt") {
      valA = new Date(a.createdAt).getTime();
      valB = new Date(b.createdAt).getTime();
    } else if (sortKey === "expiresOn") {
      valA = a.expiresOn ? new Date(a.expiresOn).getTime() : (sortDirection === "asc" ? Infinity : -Infinity);
      valB = b.expiresOn ? new Date(b.expiresOn).getTime() : (sortDirection === "asc" ? Infinity : -Infinity);
    } else {
      valA = new Date(a.createdAt).getTime();
      valB = new Date(b.createdAt).getTime();
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Apply pagination slicing
  const totalMatched = allMatchedCards.length;
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalMatched);
  const paginatedCards = allMatchedCards.slice(startIndex, endIndex);

  return {
    giftCards: paginatedCards,
    totalMatched,
    totalPages,
    currentPage,
    pageSize,
    search,
    status,
    sortKey,
    sortDirection,
    balanceStatus,
    expiresBefore,
    hasPaidPlan,
    stats: {
      total: totalCount,
      active: activeCount,
      disabled: disabledCount,
      totalBalance,
      currencyCode: shopCurrency,
    }
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const formAction = formData.get("action") as string || "";

  if (formAction === "upgrade") {
    const url = new URL(request.url);
    const returnUrl = `${url.origin}/app/gift-cards`;
    return await billing.request({
      plan: "monthlyPaid",
      isTest: true,
      returnUrl,
    } as any);
  }

  const modalTab = formData.get("modalTab") as string || "autogenerate";

  // Check Billing limits
  const billingCheck = await billing.check({
    plans: ["monthlyPaid"],
    isTest: true,
  } as any);
  const hasPaidPlan = billingCheck.hasActivePayment;

  if (!hasPaidPlan) {
    let requestedQuantity = 0;
    if (modalTab === "import") {
      const csvFile = formData.get("csvFile") as File | null;
      if (csvFile && csvFile.size > 0) {
        const text = await csvFile.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length > 1) {
          requestedQuantity = lines.length - 1;
        }
      }
    } else {
      requestedQuantity = parseInt(formData.get("quantity") as string || "1", 10);
    }

    if (requestedQuantity > 0) {
      const countResponse = await admin.graphql(
        `#graphql
        query GetGiftCardsCountForLimit {
          giftCardsCount {
            count
          }
        }`
      );
      const countJson = await countResponse.json();
      const currentCount = countJson.data?.giftCardsCount?.count || 0;

      if (currentCount + requestedQuantity > 1000) {
        return {
          giftCards: [],
          errors: [
            {
              message: `Creating ${requestedQuantity} gift card(s) would exceed the Free Plan limit of 1,000 total gift cards (current: ${currentCount}). Please upgrade to the Paid Plan to create unlimited gift cards.`,
            },
          ],
        };
      }
    }
  }

  // Fetch shop details and currency code
  const shopResponse = await admin.graphql(
    `#graphql
    query GetShopDetails {
      shop {
        name
        currencyCode
        email
        contactEmail
      }
    }`
  );
  const shopJson = await shopResponse.json();
  const shopData = shopJson.data?.shop || {};
  const currencyCode = shopData.currencyCode || "USD";
  const shopName = shopData.name || "Merchant";
  const shopEmail = shopData.email || shopData.contactEmail;
  const recipientEmail = shopEmail;

  const createdCards = [];
  const errors = [];

  if (modalTab === "import") {
    const csvFile = formData.get("csvFile") as File | null;
    const duplicateHandling = formData.get("duplicateHandling") as string || "skip";

    if (csvFile && csvFile.size > 0) {
      const text = await csvFile.text();
      const lines = text.split(/\r?\n/);
      if (lines.length > 1) {
        // Find headers
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const codeIdx = headers.indexOf("code");
        const valueIdx = headers.indexOf("value");
        const expiresIdx = headers.indexOf("expires_on");
        const noteIdx = headers.indexOf("notes");

        if (codeIdx === -1 || valueIdx === -1) {
          return { giftCards: [], errors: [{ message: "CSV must contain 'code' and 'value' columns." }] };
        }

        // Loop through lines (excluding header and empty lines)
        const maxRows = Math.min(lines.length - 1, 20); // safety cap
        for (let i = 1; i <= maxRows; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const row = line.split(",").map(c => c.trim());
          if (row.length < Math.max(codeIdx, valueIdx) + 1) continue;

          const code = row[codeIdx];
          const valStr = row[valueIdx];
          const expiresOn = expiresIdx !== -1 ? row[expiresIdx] : "";
          const note = noteIdx !== -1 ? row[noteIdx] : "CSV Import";

          if (!code || !valStr) continue;

          const amount = parseFloat(valStr) || 100.00;

          const input: any = {
            code: code.trim().toUpperCase(),
            initialValue: amount.toFixed(2),
            note: note || "Imported via CSV",
          };

          if (expiresOn) {
            input.expiresOn = expiresOn;
          }

          const response = await admin.graphql(
            `#graphql
            mutation CreateGiftCard($input: GiftCardCreateInput!) {
              giftCardCreate(input: $input) {
                giftCardCode
                giftCard {
                  id
                  lastCharacters
                  createdAt
                  expiresOn
                  enabled
                  initialValue {
                    amount
                    currencyCode
                  }
                  balance {
                    amount
                    currencyCode
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            {
              variables: {
                input,
              },
            }
          );

          const json = await response.json();
          const giftCard = json.data?.giftCardCreate?.giftCard;
          const userErrors = json.data?.giftCardCreate?.userErrors || [];

          if (giftCard) {
            giftCard.code = json.data?.giftCardCreate?.giftCardCode || "";
            createdCards.push(giftCard);
          }
          if (userErrors.length > 0) {
            if (duplicateHandling === "skip") {
              const nonDuplicateErrors = userErrors.filter((err: any) => {
                const msg = (err.message || "").toLowerCase();
                return !(msg.includes("taken") || msg.includes("already") || msg.includes("exist"));
              });
              if (nonDuplicateErrors.length > 0) {
                errors.push(...nonDuplicateErrors);
              }
            } else {
              errors.push(...userErrors);
              break; // stop and show errors immediately
            }
          }
        }
      }

      if (createdCards.length === 0 && errors.length === 0) {
        errors.push({ message: "All codes in the CSV already exist and were skipped." });
      }

      if (createdCards.length > 0) {
        // Log activity
        await db.activityLog.create({
          data: {
            shop: session.shop,
            action: "CSV Import",
            description: `Imported ${createdCards.length} gift cards via CSV (Duplicate Handling: ${duplicateHandling})`,
            performedBy: recipientEmail || "Unknown Merchant",
          },
        }).catch((err) => {
          console.error("[Cardora] Failed to record ActivityLog for CSV Import:", err);
        });

        if (recipientEmail) {
          // Send email asynchronously in the background
          sendGiftCardsEmail(recipientEmail, shopName, createdCards).catch((err) => {
            console.error("[Cardora] Failed to send gift cards email for import:", err);
          });
        }
      }

      return {
        giftCards: createdCards,
        errors,
        shopEmail: recipientEmail,
      };
    } else {
      return {
        giftCards: [],
        errors: [{ message: "Please choose a valid CSV file to upload." }],
      };
    }
  }

  // Autogenerate logic
  const quantity = parseInt(formData.get("quantity") as string || "1", 10);
  const codeLength = parseInt(formData.get("codeLength") as string || "8", 10);
  const prefix = formData.get("prefix") as string || "";
  const postfix = formData.get("postfix") as string || "";
  const initialValueInput = formData.get("initialValue") as string || "100.00";
  const expiresOnInput = formData.get("expiresOn") as string || "";
  const batchName = formData.get("batchName") as string || "";
  const noteInput = formData.get("note") as string || "";

  // Build the note
  let finalNote = "Created via Cardora App";
  if (batchName) {
    finalNote = `${batchName} - ${finalNote}`;
  }
  if (noteInput) {
    finalNote = `${finalNote}. Note: ${noteInput}`;
  }

  const amount = parseFloat(initialValueInput);

  // Helper to generate a random alphanumeric string of length N
  const generateRandomCode = (length: number) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Limit quantity to max 20 to avoid rate limit timeouts in single request
  const runLimit = Math.min(Math.max(1, quantity), 20);

  for (let i = 0; i < runLimit; i++) {
    const randomSnippet = generateRandomCode(codeLength);
    let generatedCode = randomSnippet;
    
    if (prefix) {
      generatedCode = `${prefix.trim().toUpperCase()}-${generatedCode}`;
    }
    if (postfix) {
      generatedCode = `${generatedCode}-${postfix.trim().toUpperCase()}`;
    }

    const input: any = {
      code: generatedCode,
      initialValue: amount.toFixed(2),
      note: finalNote,
    };

    if (expiresOnInput) {
      input.expiresOn = expiresOnInput;
    }

    const response = await admin.graphql(
      `#graphql
      mutation CreateGiftCard($input: GiftCardCreateInput!) {
        giftCardCreate(input: $input) {
          giftCardCode
          giftCard {
            id
            lastCharacters
            createdAt
            expiresOn
            enabled
            initialValue {
              amount
              currencyCode
            }
            balance {
              amount
              currencyCode
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input,
        },
      }
    );

    const json = await response.json();
    const giftCard = json.data?.giftCardCreate?.giftCard;
    const userErrors = json.data?.giftCardCreate?.userErrors || [];

    if (giftCard) {
      giftCard.code = json.data?.giftCardCreate?.giftCardCode || "";
      createdCards.push(giftCard);
    }
    if (userErrors.length > 0) {
      errors.push(...userErrors);
    }
  }

  if (createdCards.length > 0) {
    // Log activity
    let logDesc = `Created ${createdCards.length} gift cards (Value: ${amount.toFixed(2)} each)`;
    if (batchName) {
      logDesc += ` in batch "${batchName}"`;
    }
    await db.activityLog.create({
      data: {
        shop: session.shop,
        action: "Autogenerate",
        description: logDesc,
        performedBy: recipientEmail || "Unknown Merchant",
      },
    }).catch((err) => {
      console.error("[Cardora] Failed to record ActivityLog for Autogenerate:", err);
    });

    if (recipientEmail) {
      // Send email asynchronously in the background so it doesn't block the UI
      sendGiftCardsEmail(recipientEmail, shopName, createdCards).catch((err) => {
        console.error("[Cardora] Failed to send gift cards email:", err);
      });
    }
  }

  return {
    giftCards: createdCards,
    errors,
    shopEmail: recipientEmail,
  };
};

export default function GiftCards() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();

  const sortKey = loaderData.sortKey || "createdAt";
  const sortDirection = loaderData.sortDirection || "desc";

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [balanceStatusValue, setBalanceStatusValue] = useState(loaderData.balanceStatus || "All");
  const [expiresBeforeValue, setExpiresBeforeValue] = useState(loaderData.expiresBefore || "");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalTab, setInitialModalTab] = useState<"autogenerate" | "import">("autogenerate");
  const [searchValue, setSearchValue] = useState(loaderData.search);
  const [statusValue, setStatusValue] = useState(loaderData.status);
  const [showBanner, setShowBanner] = useState(true);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [createdCardsList, setCreatedCardsList] = useState<any[]>([]);

  const handleSort = (key: string) => {
    const newParams = new URLSearchParams(searchParams);
    const currentKey = searchParams.get("sortKey") || "createdAt";
    const currentDirection = searchParams.get("sortDirection") || "desc";
    let newDirection = "desc";
    if (currentKey === key) {
      newDirection = currentDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = "asc";
    }
    newParams.set("sortKey", key);
    newParams.set("sortDirection", newDirection);
    setSearchParams(newParams);
  };

  // Synchronize searchValue and statusValue with loader changes
  useEffect(() => {
    setSearchValue(loaderData.search);
    setStatusValue(loaderData.status);
    setBalanceStatusValue(loaderData.balanceStatus || "All");
    setExpiresBeforeValue(loaderData.expiresBefore || "");
    setSelectedCardIds([]); // Clear selection when search filters change
  }, [loaderData.search, loaderData.status, loaderData.balanceStatus, loaderData.expiresBefore]);

  // Debounce search submission to auto-search as user types
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchValue !== loaderData.search) {
        const form = document.querySelector(".filter-bar-form") as HTMLFormElement;
        if (form) {
          submit(form);
        }
      }
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue, loaderData.search, submit]);
 
  // Read search parameters on mount to open modal if requested from dashboard checklist
  useEffect(() => {
    const openModalParam = searchParams.get("openModal");
    const tabParam = searchParams.get("tab");
    
    if (openModalParam === "true") {
      if (tabParam === "import") {
        setInitialModalTab("import");
      } else {
        setInitialModalTab("autogenerate");
      }
      setIsModalOpen(true);
      
      // Reset search parameters so that the URL stays clean ("/app/gift-cards")
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("openModal");
      newParams.delete("tab");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleClearAllFilters = () => {
    setSearchValue("");
    setStatusValue("All");
    setBalanceStatusValue("All");
    setExpiresBeforeValue("");
    
    const newParams = new URLSearchParams();
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  // Handle successful creation
  useEffect(() => {
    if (actionData?.giftCards && actionData.giftCards.length > 0) {
      setCreatedCardsList(actionData.giftCards);
      setShowSuccessBanner(true);
      setIsModalOpen(false);
      shopify.toast.show(`Successfully created ${actionData.giftCards.length} gift card(s)`);
    } else if (actionData?.errors && actionData.errors.length > 0) {
      shopify.toast.show(`Error: ${actionData.errors[0].message}`, { isError: true });
    }
  }, [actionData]);

  // Format Helpers
  const formatCurrency = (amount: number | string, currencyCode: string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(num);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No expiry";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCardStatus = (card: any) => {
    if (!card.enabled) return "Disabled";
    if (parseFloat(card.balance.amount) === 0) return "Spent";
    return "Active";
  };

  // Selection handlers
  const handleToggleSelectCard = (id: string) => {
    setSelectedCardIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const pageCardIds = loaderData.giftCards.map((c: any) => c.id);
    const allSelectedOnPage = pageCardIds.length > 0 && pageCardIds.every((id: string) => selectedCardIds.includes(id));
    
    if (allSelectedOnPage) {
      setSelectedCardIds(prev => prev.filter(id => !pageCardIds.includes(id)));
    } else {
      setSelectedCardIds(prev => {
        const next = [...prev];
        pageCardIds.forEach((id: string) => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleExportSelected = () => {
    const selectedCards = loaderData.giftCards.filter((card: any) =>
      selectedCardIds.includes(card.id)
    );

    if (selectedCards.length === 0) return;

    const headers = ["ID", "Code", "Initial Value", "Current Balance", "Status", "Created On", "Expires On"];
    const rows = selectedCards.map((card: any) => [
      card.id,
      `•••• •••• •••• ${card.lastCharacters.toUpperCase()}`,
      card.initialValue.amount,
      card.balance.amount,
      getCardStatus(card),
      card.createdAt,
      card.expiresOn || "Never"
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `gift_cards_export_${selectedCardIds.length}_selected.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    shopify.toast.show(`Successfully exported ${selectedCardIds.length} gift card(s)`);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(e.currentTarget);
  };

  const handlePageChange = (pageNumber: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", pageNumber.toString());
    setSearchParams(newParams);
  };

  return (
    <s-page heading="Gift Cards">
      <s-button slot="primary-action" variant="primary" onClick={() => setIsModalOpen(true)}>
        Create gift card
      </s-button>

      <div className="gift-cards-container">
        {/* Billing Plan Status Card */}
        <div className="billing-card" style={{
          background: "linear-gradient(135deg, #f5f3ff 0%, #edd8ff 100%)",
          border: "1px solid #d8b4fe",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 4px 12px rgba(124, 58, 237, 0.05)",
          animation: "fadeIn 0.3s ease-in-out"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                backgroundColor: loaderData.hasPaidPlan ? "#c084fc" : "#818cf8",
                color: "#ffffff",
                padding: "2px 8px",
                borderRadius: "12px"
              }}>
                {loaderData.hasPaidPlan ? "Paid Plan" : "Free Plan"}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#303030" }}>
                {loaderData.hasPaidPlan ? "Unlimited Gift Cards" : "Up to 1,000 Gift Cards"}
              </span>
            </div>
            
            {!loaderData.hasPaidPlan ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "400px", marginTop: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#5c5c5c", fontWeight: "500" }}>
                  <span>Usage: {loaderData.stats.total.toLocaleString()} / 1,000</span>
                  <span>{((loaderData.stats.total / 1000) * 100).toFixed(0)}%</span>
                </div>
                <div style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "#e2e8f0",
                  borderRadius: "4px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${Math.min(100, (loaderData.stats.total / 1000) * 100)}%`,
                    height: "100%",
                    backgroundColor: "#5c36cd",
                    borderRadius: "4px",
                    transition: "width 0.3s ease"
                  }}></div>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: "12px", color: "#6d7175" }}>
                Thank you for subscribing! Your store has access to unlimited gift card generation.
              </span>
            )}
          </div>

          {!loaderData.hasPaidPlan && (
            <Form method="post">
              <input type="hidden" name="action" value="upgrade" />
              <button
                type="submit"
                className="action-btn-secondary"
                style={{
                  backgroundColor: "#5c36cd",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: "600",
                  padding: "10px 18px",
                  fontSize: "14px",
                  boxShadow: "0 2px 8px rgba(92, 54, 205, 0.25)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Upgrade to Paid ($4/mo)
              </button>
            </Form>
          )}
        </div>

        {/* KPI Grid */}
        <KpiGrid stats={loaderData.stats} formatCurrency={formatCurrency} />

        {/* Success Banner */}
        <SuccessBanner
          showSuccessBanner={showSuccessBanner}
          setShowSuccessBanner={setShowSuccessBanner}
          createdCardsList={createdCardsList}
          shopEmail={actionData?.shopEmail || ""}
          shopify={shopify}
        />

        {/* Info Banner */}
        {showBanner && (
          <div className="info-banner">
            <div className="info-banner-content">
              <div className="info-banner-icon">
                <Info size={20} />
              </div>
              <div className="info-banner-text">
                <strong>Create, manage, and track your store gift cards in one place.</strong><br />
                Use bulk actions to save time and keep everything organized.
              </div>
            </div>
            <button className="info-banner-close" onClick={() => setShowBanner(false)}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Table & Filters Card */}
        <div className="table-card">
          <Form method="get" onSubmit={handleSearchSubmit} className="filter-bar-form" style={{ display: "flex", flexDirection: "column" }}>
            {/* Reset pagination page to 1 when changing search/filters */}
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="pageSize" value={loaderData.pageSize} />
            <input type="hidden" name="sortKey" value={sortKey} />
            <input type="hidden" name="sortDirection" value={sortDirection} />

            <div className="filter-bar" style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              borderBottom: showFilterDrawer ? "none" : undefined 
            }}>
              <div className="search-wrapper">
                <span className="search-icon">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  name="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search gift cards..."
                  className="search-input"
                />
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {/* Export Selected Button */}
                {selectedCardIds.length > 0 && (
                  <button
                    type="button"
                    className="action-btn-secondary"
                    style={{
                      padding: "8px 12px",
                      fontSize: "13px",
                      backgroundColor: "#5c36cd",
                      color: "#ffffff",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer"
                    }}
                    onClick={handleExportSelected}
                  >
                    <Download size={16} />
                    Export selected ({selectedCardIds.length})
                  </button>
                )}

                <button
                  type="button"
                  className={`action-btn-secondary ${showFilterDrawer || loaderData.status !== "All" || loaderData.balanceStatus !== "All" || loaderData.expiresBefore ? "filter-active" : ""}`}
                  style={{
                    padding: "8px 10px",
                    backgroundColor: (showFilterDrawer || loaderData.status !== "All" || loaderData.balanceStatus !== "All" || loaderData.expiresBefore) ? "#e0e7ff" : undefined,
                    color: (showFilterDrawer || loaderData.status !== "All" || loaderData.balanceStatus !== "All" || loaderData.expiresBefore) ? "#4f46e5" : undefined,
                    borderColor: (showFilterDrawer || loaderData.status !== "All" || loaderData.balanceStatus !== "All" || loaderData.expiresBefore) ? "#a5b4fc" : undefined,
                  }}
                  onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                >
                  <Filter size={18} />
                </button>
              </div>
            </div>

            {/* Filter Drawer */}
            {showFilterDrawer && (
              <div className="filter-drawer" style={{
                background: "#f9fafb",
                borderBottom: "1px solid #e1e3e5",
                padding: "16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                alignItems: "end",
                animation: "fadeIn 0.2s ease-out"
              }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "13px", fontWeight: "500", color: "#303030" }}>Card Status</label>
                  <select
                    name="status"
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value)}
                    className="filter-select"
                    style={{ width: "100%", marginTop: "4px" }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Spent">Spent</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "13px", fontWeight: "500", color: "#303030" }}>Balance Status</label>
                  <select
                    name="balanceStatus"
                    value={balanceStatusValue}
                    onChange={(e) => setBalanceStatusValue(e.target.value)}
                    className="filter-select"
                    style={{ width: "100%", marginTop: "4px" }}
                  >
                    <option value="All">All</option>
                    <option value="full">Full Balance</option>
                    <option value="partial">Partial Balance</option>
                    <option value="empty">Empty (Spent)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "13px", fontWeight: "500", color: "#303030" }}>Expires On or Before</label>
                  <input
                    type="date"
                    name="expiresBefore"
                    value={expiresBeforeValue}
                    onChange={(e) => setExpiresBeforeValue(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", marginTop: "4px", padding: "6px 10px", height: "36px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="action-btn-secondary"
                    style={{ padding: "8px 12px", fontSize: "13px" }}
                    onClick={handleClearAllFilters}
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    className="action-btn-secondary"
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: "600",
                      backgroundColor: "#5c36cd",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </Form>

          <GiftCardsTable
            giftCards={loaderData.giftCards}
            selectedCardIds={selectedCardIds}
            onToggleSelectCard={handleToggleSelectCard}
            onToggleSelectAll={handleToggleSelectAll}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            currentPage={loaderData.currentPage}
            totalPages={loaderData.totalPages}
            totalMatched={loaderData.totalMatched}
            pageSize={loaderData.pageSize}
            onPageChange={handlePageChange}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        </div>
      </div>

      <CreateGiftCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        loaderData={loaderData}
        actionData={actionData}
        shopify={shopify}
        initialTab={initialModalTab}
      />
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
