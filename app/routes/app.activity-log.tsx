import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation, useRouteError, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import db from "../db.server";
import "../gift-cards.css";
import { Trash2, Calendar, User, FileText } from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const viewExists = await db.activityLog.findFirst({
    where: { shop: session.shop, action: "Viewed Logs" }
  });
  if (!viewExists) {
    await db.activityLog.create({
      data: {
        shop: session.shop,
        action: "Viewed Logs",
        description: "Viewed the activity log page",
        performedBy: (session as any).email || "Merchant",
      }
    }).catch(err => console.error("Failed to create Viewed Logs entry:", err));
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 10;

  const skip = (page - 1) * pageSize;

  const [logs, totalMatched] = await Promise.all([
    db.activityLog.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.activityLog.count({
      where: { shop: session.shop },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));

  return {
    logs,
    totalMatched,
    totalPages,
    currentPage: page,
    pageSize,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const formAction = formData.get("action");

  if (formAction === "clear") {
    await db.activityLog.deleteMany({
      where: { shop: session.shop },
    });
    
    // Log the purge activity itself
    await db.activityLog.create({
      data: {
        shop: session.shop,
        action: "Purge",
        description: "Cleared all activity logs",
        performedBy: (session as any).email || "Merchant",
      }
    });

    return { success: true };
  }

  return { success: false };
};

export default function ActivityLogPage() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();

  const handlePageChange = (pageNumber: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", pageNumber.toString());
    setSearchParams(newParams);
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadgeClass = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("import")) return "status-badge-active"; // green
    if (act.includes("auto")) return "status-badge-disabled"; // purple (actually disabled badge is grey, but we can reuse active/disabled/spent/etc. badges)
    return ""; // generic fallback
  };

  // Generate pagination list
  const getPageNumbers = (current: number, totalPages: number) => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (current < totalPages - 2) pages.push("...");
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers(loaderData.currentPage, loaderData.totalPages);
  const showingStart = loaderData.totalMatched === 0 ? 0 : (loaderData.currentPage - 1) * loaderData.pageSize + 1;
  const showingEnd = Math.min(loaderData.currentPage * loaderData.pageSize, loaderData.totalMatched);

  const handleClearConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("Are you sure you want to clear all activity logs? This action cannot be undone.")) {
      e.preventDefault();
    } else {
      shopify.toast.show("Activity logs cleared successfully");
    }
  };

  return (
    <s-page heading="Activity Log">
      {loaderData.logs.length > 0 && (
        <Form method="post" onSubmit={handleClearConfirm} slot="primary-action">
          <input type="hidden" name="action" value="clear" />
          <button
            type="submit"
            className="action-btn-secondary"
            disabled={navigation.state === "submitting"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#c21f1f",
              borderColor: "#f5c6c6",
              backgroundColor: "#fff5f5",
              cursor: "pointer",
              padding: "8px 14px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            <Trash2 size={16} />
            Clear all logs
          </button>
        </Form>
      )}

      <div className="gift-cards-container">
        {/* Info Card */}
        <div className="info-banner" style={{ background: "#f8f9fa", border: "1px solid #e1e3e5", color: "#303030" }}>
          <div className="info-banner-content">
            <div className="info-banner-icon" style={{ color: "#5c36cd" }}>
              <FileText size={20} />
            </div>
            <div className="info-banner-text">
              <strong>Keep track of actions taken by users in your shop.</strong><br />
              This log tracks batches of gift cards created via autogeneration or imported CSV templates.
            </div>
          </div>
        </div>

        {/* Logs Table Card */}
        <div className="table-card">
          <div className="table-wrapper">
            <table className="gift-cards-table">
              <thead>
                <tr>
                  <th style={{ width: "200px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={14} style={{ opacity: 0.6 }} />
                      Activity time
                    </div>
                  </th>
                  <th style={{ width: "130px" }}>Action</th>
                  <th>Description</th>
                  <th style={{ width: "220px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <User size={14} style={{ opacity: 0.6 }} />
                      Merchant
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loaderData.logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "48px", color: "#6d7175" }}>
                      No activity logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  loaderData.logs.map((log: any) => {
                    const badgeClass = getActionBadgeClass(log.action);
                    return (
                      <tr key={log.id}>
                        <td style={{ color: "#303030", fontWeight: "500" }}>
                          {formatDate(log.createdAt)}
                        </td>
                        <td>
                          <span className={`status-badge ${badgeClass}`} style={{ textTransform: "capitalize" }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ color: "#5c5c5c", fontSize: "13px" }}>
                          {log.description}
                        </td>
                        <td style={{ color: "#6d7175", fontFamily: "monospace" }}>
                          {log.performedBy}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {loaderData.totalPages > 1 && (
            <div className="pagination-bar">
              <div>
                Showing {showingStart}–{showingEnd} of {loaderData.totalMatched} results
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => handlePageChange(loaderData.currentPage - 1)}
                  disabled={loaderData.currentPage === 1}
                >
                  &lt;
                </button>

                {pageNumbers.map((pageNum, idx) => {
                  if (pageNum === "...") {
                    return <span key={`ellipsis-${idx}`} className="page-ellipsis">...</span>;
                  }
                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      className={`page-btn ${loaderData.currentPage === pageNum ? "page-btn-active" : ""}`}
                      onClick={() => handlePageChange(pageNum as number)}
                      disabled={loaderData.currentPage === pageNum}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="page-btn"
                  onClick={() => handlePageChange(loaderData.currentPage + 1)}
                  disabled={loaderData.currentPage === loaderData.totalPages}
                >
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
