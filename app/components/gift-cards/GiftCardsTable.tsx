import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal } from "lucide-react";

interface GiftCardsTableProps {
  giftCards: any[];
  selectedCardIds: string[];
  onToggleSelectCard: (id: string) => void;
  onToggleSelectAll: () => void;
  sortKey: string;
  sortDirection: string;
  onSort: (key: string) => void;
  currentPage: number;
  totalPages: number;
  totalMatched: number;
  pageSize: number;
  onPageChange: (pageNum: number) => void;
  formatCurrency: (amount: number | string, currencyCode: string) => string;
  formatDate: (dateString: string | null) => string;
}

export function GiftCardsTable({
  giftCards,
  selectedCardIds,
  onToggleSelectCard,
  onToggleSelectAll,
  sortKey,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  totalMatched,
  pageSize,
  onPageChange,
  formatCurrency,
  formatDate,
}: GiftCardsTableProps) {
  // Page number list helper
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

  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const showingStart = totalMatched === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, totalMatched);

  return (
    <>
      <div className="table-wrapper">
        <table className="gift-cards-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <label className="custom-checkbox-container">
                  <input
                    type="checkbox"
                    checked={giftCards.length > 0 && giftCards.every((c: any) => selectedCardIds.includes(c.id))}
                    onChange={onToggleSelectAll}
                  />
                  <span className="custom-checkmark"></span>
                </label>
              </th>
              <th>Code</th>
              <th onClick={() => onSort("initialValue")} style={{ cursor: "pointer", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Initial value
                  {sortKey === "initialValue" ? (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : (
                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th onClick={() => onSort("balance")} style={{ cursor: "pointer", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Current balance
                  {sortKey === "balance" ? (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : (
                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th>Status</th>
              <th onClick={() => onSort("createdAt")} style={{ cursor: "pointer", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Created on
                  {sortKey === "createdAt" ? (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : (
                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
              <th onClick={() => onSort("expiresOn")} style={{ cursor: "pointer", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Expires on
                  {sortKey === "expiresOn" ? (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : (
                    <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {giftCards.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#6d7175" }}>
                  No gift cards found.
                </td>
              </tr>
            ) : (
              giftCards.map((card: any) => {
                const status = card.enabled ? "Active" : "Disabled";
                return (
                  <tr key={card.id} className={selectedCardIds.includes(card.id) ? "row-selected" : ""}>
                    <td>
                      <label className="custom-checkbox-container">
                        <input
                          type="checkbox"
                          checked={selectedCardIds.includes(card.id)}
                          onChange={() => onToggleSelectCard(card.id)}
                        />
                        <span className="custom-checkmark"></span>
                      </label>
                    </td>
                    <td style={{ fontWeight: "500", letterSpacing: "0.5px" }}>
                      •••• •••• •••• {card.lastCharacters.toUpperCase()}
                    </td>
                    <td>{formatCurrency(card.initialValue.amount, card.initialValue.currencyCode)}</td>
                    <td>{formatCurrency(card.balance.amount, card.balance.currencyCode)}</td>
                    <td>
                      <span className={`status-badge status-badge-${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </td>
                    <td>{formatDate(card.createdAt)}</td>
                    <td>{formatDate(card.expiresOn)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="pagination-bar">
        <div>
          Showing {showingStart}–{showingEnd} of {totalMatched} results
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="page-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
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
                className={`page-btn ${currentPage === pageNum ? "page-btn-active" : ""}`}
                onClick={() => onPageChange(pageNum as number)}
                disabled={currentPage === pageNum}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            className="page-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            &gt;
          </button>
        </div>
      </div>
    </>
  );
}
