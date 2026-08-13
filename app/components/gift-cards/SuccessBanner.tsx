import { X } from "lucide-react";

interface SuccessBannerProps {
  showSuccessBanner: boolean;
  setShowSuccessBanner: (show: boolean) => void;
  createdCardsList: any[];
  shopEmail: string;
  shopify: any;
}

export function SuccessBanner({
  showSuccessBanner,
  setShowSuccessBanner,
  createdCardsList,
  shopEmail,
  shopify,
}: SuccessBannerProps) {
  if (!showSuccessBanner || createdCardsList.length === 0) return null;

  const handleCopyAll = () => {
    const codes = createdCardsList.map((card: any) => card.code).join("\n");
    navigator.clipboard.writeText(codes);
    shopify.toast.show(
      createdCardsList.length > 1 ? "All codes copied" : "Code copied"
    );
  };

  return (
    <div className="success-banner" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="success-banner-body">
          <span className="success-banner-title">
            {createdCardsList.length} Gift card{createdCardsList.length > 1 ? "s" : ""} created successfully!
          </span>
          <span style={{ fontSize: "12px", color: "#2b5c3f", marginTop: "4px" }}>
            {shopEmail ? (
              <>
                Their codes have been mailed to the shop owner's email (<strong>{shopEmail}</strong>).<br />
              </>
            ) : ""}
            Make sure to copy these codes now. For security reasons, you won't be able to view them again.
          </span>
        </div>
        <button className="info-banner-close" style={{ color: "#0e623b", margin: 0, padding: 0 }} onClick={() => setShowSuccessBanner(false)}>
          <X size={16} />
        </button>
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxHeight: "150px",
        overflowY: "auto",
        background: "#ffffff",
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid #a3e9be"
      }}>
        {createdCardsList.map((card: any) => (
          <div key={card.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "600", color: "#303030" }}>
              {card.code}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="success-banner-copy-btn"
          onClick={handleCopyAll}
        >
          {createdCardsList.length > 1 ? "Copy All Codes" : "Copy Code"}
        </button>
      </div>
    </div>
  );
}
