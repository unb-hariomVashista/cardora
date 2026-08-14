import { useState, useEffect } from "react";
import { Form } from "react-router";
import { X, FileText, ChevronDown } from "lucide-react";

interface CreateGiftCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  loaderData: any;
  actionData: any;
  shopify: any;
  initialTab?: "autogenerate" | "import";
}

export function CreateGiftCardModal({
  isOpen,
  onClose,
  loaderData,
  actionData,
  shopify,
  initialTab = "autogenerate",
}: CreateGiftCardModalProps) {
  const [modalTab, setModalTab] = useState<"autogenerate" | "import">(initialTab);
  const [quantity, setQuantity] = useState(1);
  const [value, setValue] = useState("10.00");
  const [codeLength, setCodeLength] = useState(12);
  const [prefix, setPrefix] = useState("");
  const [postfix, setPostfix] = useState("");
  const [isOptionalOpen, setIsOptionalOpen] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [selectedCSVFile, setSelectedCSVFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) {
      setModalTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const handleCloseModal = () => {
    setSelectedCSVFile(null);
    onClose();
  };

  const previewSnippet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const getExampleCode = () => {
    const snippet = previewSnippet.substring(0, codeLength);
    let code = snippet;
    if (prefix) {
      code = `${prefix.trim().toUpperCase()}-${code}`;
    }
    if (postfix) {
      code = `${code}-${postfix.trim().toUpperCase()}`;
    }
    return code;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <span className="modal-title">Create gift cards</span>
          <button className="modal-close-btn" onClick={handleCloseModal} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><X size={20} /></button>
        </div>
        
        <Form method="post" encType="multipart/form-data">
          {/* Passing auto-generation values inside form */}
          <input type="hidden" name="modalTab" value={modalTab} />
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="codeLength" value={codeLength} />
          <input type="hidden" name="prefix" value={prefix} />
          <input type="hidden" name="postfix" value={postfix} />

          <div className="modal-tabs">
            <button
              type="button"
              className={`modal-tab-btn ${modalTab === "autogenerate" ? "active" : ""}`}
              onClick={() => setModalTab("autogenerate")}
            >
              Autogenerate
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${modalTab === "import" ? "active" : ""}`}
              onClick={() => setModalTab("import")}
            >
              Import from CSV
            </button>
          </div>

          {modalTab === "autogenerate" ? (
            <div className="modal-body">
              <div>
                <h3 className="modal-section-title" style={{ marginBottom: "4px" }}>Gift card details</h3>
                <span style={{ fontSize: "12px", color: "#6d7175" }}>
                  Fields marked with * are required.
                </span>
              </div>
              
              {/* Row 1: Quantity and Value */}
              <div className="modal-grid-2">
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="20"
                    required
                    className="form-input"
                  />
                  <span className="form-input-help">Number of gift cards to create.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Value ({loaderData.stats.currencyCode === "INR" || loaderData.stats.currencyCode === "₹" ? "₹" : "$"}) *</label>
                  <div style={{ position: "relative", display: "flex", width: "100%" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#6d7175", fontSize: "14px" }}>
                      {loaderData.stats.currencyCode === "INR" || loaderData.stats.currencyCode === "₹" ? "₹" : "$"}
                    </span>
                    <input
                      type="number"
                      name="initialValue"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      step="0.01"
                      min="0.01"
                      required
                      className="form-input"
                      style={{ paddingLeft: "26px", width: "100%" }}
                    />
                  </div>
                  <span className="form-input-help">The value customers will have on each gift card.</span>
                </div>
              </div>

              {/* Code length (Full width) */}
              <div className="form-group">
                <label className="form-label">Code length *</label>
                <select
                  value={codeLength}
                  onChange={(e) => setCodeLength(parseInt(e.target.value))}
                  className="form-input"
                  style={{ width: "100%" }}
                >
                  <option value="8">8 characters</option>
                  <option value="12">12 characters</option>
                  <option value="16">16 characters</option>
                </select>
                <span className="form-input-help">Length of the gift card code to generate.</span>
              </div>

              {/* Divider line between required and optional settings */}
              <hr style={{ border: "none", borderTop: "1px solid #e1e3e5", margin: "8px 0" }} />

              {/* Optional settings collapsible section */}
              <div
                className="optional-settings-header"
                onClick={() => setIsOptionalOpen(!isOptionalOpen)}
              >
                <span className="optional-settings-title">Optional settings</span>
                <span className="optional-settings-caret" style={{ transform: isOptionalOpen ? "rotate(180deg)" : "rotate(0deg)", display: "flex" }}>
                  <ChevronDown size={20} />
                </span>
              </div>

              {isOptionalOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.2s ease" }}>
                  {/* Batch name (Full width) */}
                  <div className="form-group">
                    <label className="form-label">Batch name</label>
                    <input
                      type="text"
                      name="batchName"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="e.g. Summer Campaign"
                      className="form-input"
                      style={{ width: "100%" }}
                    />
                    <span className="form-input-help">Internal name to identify this batch.</span>
                  </div>

                  {/* Prefix and Postfix */}
                  <div className="modal-grid-2">
                    <div className="form-group">
                      <label className="form-label">Prefix</label>
                      <input
                        type="text"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                        placeholder="e.g. SUMMER"
                        className="form-input"
                      />
                      <span className="form-input-help">Will be added at the beginning of each code.</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Postfix</label>
                      <input
                        type="text"
                        value={postfix}
                        onChange={(e) => setPostfix(e.target.value)}
                        placeholder="e.g. 2025"
                        className="form-input"
                      />
                      <span className="form-input-help">Will be added at the end of each code.</span>
                    </div>
                  </div>

                  {/* Expiration date and Internal note */}
                  <div className="modal-grid-2">
                    <div className="form-group">
                      <label className="form-label">Expiration date</label>
                      <input
                        type="date"
                        name="expiresOn"
                        className="form-input"
                      />
                      <span className="form-input-help">Set a date when the cards expire.</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Internal note</label>
                      <input
                        type="text"
                        name="note"
                        placeholder="Add details about this batch..."
                        className="form-input"
                      />
                      <span className="form-input-help">Internal note for tracking.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Banner */}
              <div className="preview-banner">
                <div className="preview-left">
                  <span className="preview-title">Preview</span>
                  <span className="preview-sub">This is how your gift card codes will look.</span>
                </div>
                <div className="preview-right">
                  <div className="preview-code-box">
                    {getExampleCode()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="modal-body">
              {/* 1. Upload CSV file */}
              <div>
                <h3 className="modal-section-title" style={{ marginBottom: "2px" }}>1. Upload CSV file</h3>
                {selectedCSVFile ? (
                  <div style={{
                    border: "1.5px dashed #a5b4fc",
                    borderRadius: "8px",
                    padding: "24px 16px",
                    textAlign: "center",
                    background: "#f5f3ff",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    position: "relative",
                    animation: "fadeIn 0.2s ease"
                  }}>
                    <button
                      type="button"
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#6d7175",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "4px"
                      }}
                      onClick={() => {
                        setSelectedCSVFile(null);
                        const picker = document.getElementById("csv-file-picker") as HTMLInputElement;
                        if (picker) picker.value = "";
                      }}
                    >
                      <X size={18} />
                    </button>

                    <div style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "#e0e7ff",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <FileText size={24} />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#303030", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedCSVFile.name}
                      </span>
                      <span style={{ fontSize: "12px", color: "#6d7175" }}>
                        {(selectedCSVFile.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="upload-zone" onClick={() => document.getElementById("csv-file-picker")?.click()}>
                    <div className="upload-icon-box">
                      <svg viewBox="0 0 20 20" style={{ width: "20px", height: "20px", fill: "currentColor" }}>
                        <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0v-8.5A.75.75 0 0 1 10 3Zm-3.72 3.78a.75.75 0 0 1 1.06-1.06l2.13 2.12 2.12-2.12a.75.75 0 1 1 1.06 1.06l-2.65 2.65a.75.75 0 0 1-1.06 0L6.28 6.78Z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M3.75 13.5a.75.75 0 0 1 .75.75v1c0 .414.336.75.75.75h9.5a.75.75 0 0 0 .75-.75v-1a.75.75 0 0 1 1.5 0v1a2.25 2.25 0 0 1-2.25 2.25h-9.5A2.25 2.25 0 0 1 3 15.25v-1a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="upload-zone-text">Drag and drop your CSV file here</span>
                    <span className="upload-zone-or">or</span>
                    <button type="button" className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}>Choose file</button>
                  </div>
                )}
                <input
                  type="file"
                  id="csv-file-picker"
                  name="csvFile"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedCSVFile(file);
                      shopify.toast.show(`Selected: ${file.name}`);
                    }
                  }}
                />
                <span className="form-input-help" style={{ marginTop: "6px", display: "block" }}>Maximum file size: 5MB</span>
              </div>

              {/* 2. CSV requirements */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h3 className="modal-section-title">2. CSV requirements</h3>
                <span style={{ fontSize: "13px", color: "#6d7175" }}>
                  Your CSV file must include a header row and the following columns.
                </span>
                <div className="requirements-pills">
                  <span className="req-pill">code<span className="req-pill-required">*</span></span>
                  <span className="req-pill">value<span className="req-pill-required">*</span></span>
                  <span className="req-pill">expires_on<span className="req-pill-optional">(optional)</span></span>
                  <span className="req-pill">initial_balance<span className="req-pill-optional">(optional)</span></span>
                  <span className="req-pill">notes<span className="req-pill-optional">(optional)</span></span>
                </div>
                <button
                  type="button"
                  className="btn-download"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,code,value,expires_on,initial_balance,notes\nSUMMER-SAMPLE-1234,100.00,2027-05-20,100.00,Summer promo code";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "gift_cards_import_template.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    shopify.toast.show("Template downloaded");
                  }}
                >
                  <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "currentColor", transform: "rotate(180deg)" }}>
                    <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0v-8.5A.75.75 0 0 1 10 3Zm-3.72 3.78a.75.75 0 0 1 1.06-1.06l2.13 2.12 2.12-2.12a.75.75 0 1 1 1.06 1.06l-2.65 2.65a.75.75 0 0 1-1.06 0L6.28 6.78Z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M3.75 13.5a.75.75 0 0 1 .75.75v1c0 .414.336.75.75.75h9.5a.75.75 0 0 0 .75-.75v-1a.75.75 0 0 1 1.5 0v1a2.25 2.25 0 0 1-2.25 2.25h-9.5A2.25 2.25 0 0 1 3 15.25v-1a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                  </svg>
                  Download CSV template
                </button>
              </div>

              {/* 3. Additional options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <h3 className="modal-section-title">3. Additional options</h3>
                
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#303030", marginTop: "2px" }}>
                  If a gift card code already exists
                </span>

                <div className="options-list">
                  <label className="option-item-radio">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      value="skip"
                      defaultChecked
                      className="option-radio-input"
                    />
                    <span className="option-label-group">
                      <span className="option-label-title">Skip and continue</span>
                      <span className="option-label-sub">Existing codes will be skipped and new ones will be created.</span>
                    </span>
                  </label>

                  <label className="option-item-radio">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      value="stop"
                      className="option-radio-input"
                    />
                    <span className="option-label-group">
                      <span className="option-label-title">Stop and show errors</span>
                      <span className="option-label-sub">The import will stop if any codes already exist.</span>
                    </span>
                  </label>

                  <label className="option-item-radio" style={{ opacity: 0.6, cursor: "not-allowed" }}>
                    <input
                      type="checkbox"
                      disabled
                      className="option-radio-input"
                    />
                    <span className="option-label-group">
                      <span className="option-label-title">Send notification to customers (coming soon)</span>
                      <span className="option-label-sub">We'll notify customers when their gift cards are created.</span>
                    </span>
                  </label>
                </div>

                {/* Important Info Banner */}
                <div className="important-banner">
                  <div className="important-banner-title">
                    <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "currentColor" }}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-1 8a1 1 0 1 0 2 0v-4a1 1 0 1 0-2 0v4Z" clipRule="evenodd" />
                    </svg>
                    <span>Important details</span>
                  </div>
                  <ul className="important-banner-list">
                    <li>All values will be processed in {loaderData.stats.currencyCode === "INR" || loaderData.stats.currencyCode === "₹" ? "INR (₹)" : "USD ($)"}.</li>
                    <li>Date format for expires_on must be YYYY-MM-DD (e.g. 2027-05-20).</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="modal-footer">
            {actionData?.errors && actionData.errors.length > 0 && (
              <div className="error-banner">
                <svg viewBox="0 0 20 20" style={{ width: "20px", height: "20px", fill: "currentColor" }}>
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 7.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
                </svg>
                <span className="error-banner-text">{actionData.errors[0].message}</span>
              </div>
            )}
            
            <div className="modal-footer-actions">
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "8px 16px", fontSize: "14px" }}
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  backgroundColor: "#5c36cd",
                  color: "#ffffff",
                  border: "none"
                }}
              >
                {modalTab === "autogenerate" ? "Create" : "Upload and preview"}
              </button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
