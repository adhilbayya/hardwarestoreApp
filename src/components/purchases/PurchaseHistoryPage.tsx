import React, { useEffect, useState } from "react";
import {
  getPurchasesReport,
  type PurchaseReportRow,
} from "../../database/reports";
import { getPurchaseById, deletePurchase } from "../../database/purchase";
import { getSupplierById, type Supplier } from "../../database/supplier";
import { confirm } from "@tauri-apps/plugin-dialog";
import { numberToWords } from "../../utils/numberToWords";
import logo from "../../assets/logosquaregreen.jpeg";

export default function PurchaseHistoryPage({
  onRedoPurchase,
}: {
  onRedoPurchase?: (id: number) => void;
}) {
  const [purchases, setPurchases] = useState<PurchaseReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [activePreset, setActivePreset] = useState<string>("month");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Awaited<
    ReturnType<typeof getPurchaseById>
  > | null>(null);

  const [printPurchase, setPrintPurchase] = useState<
    | (Awaited<ReturnType<typeof getPurchaseById>> & {
        supplier: Supplier | null;
      })
    | null
  >(null);

  useEffect(() => {
    if (!printPurchase) return;

    const timer = setTimeout(() => {
      window.print();
    }, 300);

    const handleAfterPrint = () => {
      setPrintPurchase(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printPurchase]);

  async function loadPurchases() {
    try {
      setLoading(true);
      setError("");
      const data = await getPurchasesReport(fromDate, toDate);
      setPurchases(data);
    } catch (err) {
      console.error("Failed to load purchases:", err);
      setError("Failed to load purchases.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPurchases();
  }, [fromDate, toDate]);

  function handlePreset(range: "today" | "week" | "month" | "year") {
    setActivePreset(range);
    const now = new Date();
    const to = now.toISOString().split("T")[0];
    let from = to;

    if (range === "today") {
      from = to;
    } else if (range === "week") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      from = past.toISOString().split("T")[0];
    } else if (range === "month") {
      const past = new Date();
      past.setMonth(past.getMonth() - 1);
      from = past.toISOString().split("T")[0];
    } else if (range === "year") {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);
      from = past.toISOString().split("T")[0];
    }

    setFromDate(from);
    setToDate(to);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN");
  }

  function formatDateTime(dateStr: string) {
    try {
      const clean = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
      const d = new Date(clean.endsWith("Z") ? clean : clean + "Z");
      if (isNaN(d.getTime())) return formatDate(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return formatDate(dateStr);
    }
  }

  async function handleViewPurchase(id: number) {
    try {
      const data = await getPurchaseById(id);
      setSelectedPurchase(data);
      setShowPurchaseDetails(true);
    } catch (error) {
      console.error("Failed to load purchase:", error);
    }
  }

  async function handleReprintPurchase() {
    if (!selectedPurchase) return;
    let supplier = null;
    if (selectedPurchase.purchase.supplier_id) {
      supplier = await getSupplierById(selectedPurchase.purchase.supplier_id);
    }
    setShowPurchaseDetails(false);
    setPrintPurchase({ ...selectedPurchase, supplier });
  }

  async function handleDeletePurchase(id: number) {
    const isConfirmed = await confirm(
      "Are you sure you want to completely delete this purchase record? This action cannot be undone.",
      { title: "Delete Purchase", kind: "warning" },
    );
    if (!isConfirmed) return;

    try {
      await deletePurchase(id);
      setShowPurchaseDetails(false);
      setSelectedPurchase(null);
      loadPurchases();
    } catch (err) {
      console.error("Failed to delete purchase:", err);
      alert("Failed to delete purchase.");
    }
  }

  const filteredPurchases = purchases.filter(
    (p) =>
      p.purchase_number.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
      (p.bill_number || "").toLowerCase().includes(purchaseSearch.toLowerCase()) ||
      (p.supplier_name || "")
        .toLowerCase()
        .includes(purchaseSearch.toLowerCase()) ||
      formatDate(p.purchase_date).includes(purchaseSearch),
  );

  const totalPurchaseValue = purchases.reduce(
    (acc, p) => acc + (p.grand_total || 0),
    0,
  );
  const totalTaxITC = purchases.reduce(
    (acc, p) => acc + (p.tax_amount || 0),
    0,
  );
  const purchaseOrdersCount = purchases.length;

  return (
    <>
      <div className="purchase-history-page-container">
      {/* Header */}
      <div className="purchase-history-header-row">
        <div>
          <h3>Purchase History</h3>
          <p>
            Track inward procurement, inspect PO line items, and reprint invoices.
          </p>
        </div>

        <div className="invoices-summary-badge">
          <span>📦</span>
          <span>
            {purchaseOrdersCount} {purchaseOrdersCount === 1 ? "Record" : "Records"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="purchase-history-stats-grid">
        <div className="purchase-history-stat-card">
          <div>
            <div className="stat-label">Total Procured</div>
            <div className="stat-value">₹{totalPurchaseValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="stat-sub">Across selected date range</div>
          </div>
          <div className="customer-stat-icon stat-icon-blue">🛒</div>
        </div>

        <div className="purchase-history-stat-card">
          <div>
            <div className="stat-label">Total Inward Tax (ITC)</div>
            <div className="stat-value">₹{totalTaxITC.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="stat-sub">Claimable input tax credit</div>
          </div>
          <div className="customer-stat-icon stat-icon-purple">🧾</div>
        </div>

        <div className="purchase-history-stat-card">
          <div>
            <div className="stat-label">Purchase Invoices</div>
            <div className="stat-value">{purchaseOrdersCount}</div>
            <div className="stat-sub">Completed vendor entries</div>
          </div>
          <div className="customer-stat-icon stat-icon-emerald">📋</div>
        </div>
      </div>

      {/* Date Filter & Search Controls */}
      <div className="purchase-history-filter-card">
        <div className="purchase-history-presets-bar">
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginRight: "4px" }}>
            Date Preset:
          </span>
          <button
            className={`purchase-history-preset-btn ${activePreset === "today" ? "active" : ""}`}
            onClick={() => handlePreset("today")}
          >
            Today
          </button>
          <button
            className={`purchase-history-preset-btn ${activePreset === "week" ? "active" : ""}`}
            onClick={() => handlePreset("week")}
          >
            Last 7 Days
          </button>
          <button
            className={`purchase-history-preset-btn ${activePreset === "month" ? "active" : ""}`}
            onClick={() => handlePreset("month")}
          >
            Last 30 Days
          </button>
          <button
            className={`purchase-history-preset-btn ${activePreset === "year" ? "active" : ""}`}
            onClick={() => handlePreset("year")}
          >
            Past Year
          </button>
        </div>

        <div className="purchase-history-filter-inputs">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset("");
              }}
              style={{
                padding: "7px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset("");
              }}
              style={{
                padding: "7px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "13px",
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="purchase-history-table-card">
        <div className="purchase-history-table-header">
          <h4>Purchases List ({filteredPurchases.length})</h4>

          <div className="suppliers-search-box">
            <span className="suppliers-search-icon">🔍</span>
            <input
              type="text"
              className="suppliers-search-input"
              placeholder="Search by vendor, PO number, date..."
              value={purchaseSearch}
              onChange={(e) => setPurchaseSearch(e.target.value)}
            />
            {purchaseSearch && (
              <button
                className="suppliers-search-clear"
                onClick={() => setPurchaseSearch("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            style={{
              margin: "16px 20px 0",
              padding: "10px 14px",
              borderRadius: "6px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
            Loading purchases...
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📦</div>
            <h4
              style={{
                margin: "0 0 4px",
                color: "#1e293b",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              No matching purchase records found
            </h4>
            <p style={{ margin: 0, fontSize: "13px" }}>
              {purchaseSearch
                ? "Try searching with a different PO number or supplier name."
                : "No purchases recorded within this date range."}
            </p>
          </div>
        ) : (
          <div className="suppliers-table-wrapper">
            <table className="purchase-history-table">
              <thead>
                <tr>
                  <th>Purchase No</th>
                  <th>Supplier Bill No</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Tax Amount</th>
                  <th style={{ textAlign: "right" }}>Grand Total</th>
                  <th style={{ textAlign: "center" }}>Payment</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="purchase-row"
                    onClick={() => handleViewPurchase(purchase.id)}
                  >
                    <td>
                      <span className="invoice-badge-mono">
                        {purchase.purchase_number}
                      </span>
                    </td>
                    <td>
                      {purchase.bill_number ? (
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          backgroundColor: "#f1f5f9",
                          color: "#0f172a",
                          fontWeight: 700,
                          fontSize: "12px",
                          border: "1px solid #e2e8f0"
                        }}>
                          {purchase.bill_number}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: "#0f172a" }}>
                        {purchase.supplier_name || "Unspecified Supplier"}
                      </strong>
                    </td>
                    <td style={{ color: "#64748b", fontSize: "13px" }}>
                      {formatDate(purchase.purchase_date)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      ₹{purchase.tax_amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <strong style={{ color: "#0f172a" }}>
                        ₹{purchase.grand_total.toFixed(2)}
                      </strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={`badge ${
                          purchase.payment_method.toLowerCase() === "cash"
                            ? "paid"
                            : "credit"
                        }`}
                      >
                        {purchase.payment_method}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        className="customers-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPurchase(purchase.id);
                        }}
                      >
                        🔍 Details
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Redesigned Purchase Details Modal */}
      {showPurchaseDetails && selectedPurchase && (
        <div
          className="modal-overlay"
          onClick={() => setShowPurchaseDetails(false)}
        >
          <div
            className="modal product-editor-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "640px" }}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  Purchase #{selectedPurchase.purchase.purchase_number}
                </h3>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Recorded on {formatDate(selectedPurchase.purchase.purchase_date)} • {selectedPurchase.purchase.payment_method}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowPurchaseDetails(false)}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                maxHeight: "65vh",
                overflowY: "auto",
                padding: "20px",
              }}
            >
              {/* Info Badges Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "12px",
                  background: "#f8fafc",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Purchase No
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                    {selectedPurchase.purchase.purchase_number}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Supplier Bill No
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0284c7", marginTop: "2px" }}>
                    {selectedPurchase.purchase.bill_number || "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Date
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>
                    {formatDate(selectedPurchase.purchase.purchase_date)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Payment Mode
                  </div>
                  <div style={{ marginTop: "2px" }}>
                    <span
                      className={`badge ${
                        selectedPurchase.purchase.payment_method.toLowerCase() === "cash"
                          ? "paid"
                          : "credit"
                      }`}
                    >
                      {selectedPurchase.purchase.payment_method}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table Card */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  marginBottom: "16px",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 700, color: "#475569", textAlign: "left", textTransform: "uppercase" }}>Product</th>
                      <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 700, color: "#475569", textAlign: "center", textTransform: "uppercase", width: "60px" }}>Qty</th>
                      <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 700, color: "#475569", textAlign: "right", textTransform: "uppercase" }}>Rate</th>
                      <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 700, color: "#475569", textAlign: "right", textTransform: "uppercase" }}>Tax</th>
                      <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 700, color: "#475569", textAlign: "right", textTransform: "uppercase" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.items.map((item) => (
                      <tr key={item.product_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "center", color: "#334155" }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                          ₹{item.unit_price.toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                          ₹{item.tax_amount.toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right", fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                          ₹{item.line_total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#64748b" }}>
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>₹{selectedPurchase.purchase.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#64748b" }}>
                  <span>Tax Amount</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>₹{selectedPurchase.purchase.tax_amount.toFixed(2)}</span>
                </div>
                {selectedPurchase.purchase.discount_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#dc2626" }}>
                    <span>Discount</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>- ₹{selectedPurchase.purchase.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#0f172a",
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: "8px",
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "#059669" }}>
                    ₹{selectedPurchase.purchase.grand_total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="modal-actions"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "16px 20px",
                borderTop: "1px solid #e2e8f0",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                {onRedoPurchase && (
                  <button
                    className="secondary-button"
                    style={{ color: "#d97706", borderColor: "#f59e0b", padding: "6px 12px", fontSize: "13px" }}
                    onClick={async () => {
                      const isConfirmed = await confirm(
                        "Are you sure you want to redo this purchase? This will discard the current purchase and let you edit it.",
                        { title: "Redo Purchase", kind: "warning" },
                      );
                      if (isConfirmed) {
                        setShowPurchaseDetails(false);
                        onRedoPurchase(selectedPurchase.purchase.id);
                      }
                    }}
                  >
                    ✏️ Redo
                  </button>
                )}

                <button
                  className="secondary-button"
                  style={{ color: "#ef4444", borderColor: "#fecaca", padding: "6px 12px", fontSize: "13px" }}
                  onClick={() =>
                    handleDeletePurchase(selectedPurchase.purchase.id)
                  }
                >
                  🗑️ Delete
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="secondary-button"
                  onClick={() => setShowPurchaseDetails(false)}
                >
                  Close
                </button>
                <button
                  className="primary-button"
                  onClick={handleReprintPurchase}
                >
                  🖨️ Print Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Preserve Exact Print View */}
      {printPurchase && (
        <div
          className={`print-invoice print-purchase ${
            printPurchase.items.length <= 10 ? "print-bottom-pinned" : ""
          }`}
        >
          <div className="print-header-grid">
            <div className="print-shop-details">
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                }}
              >
                <img
                  src={logo}
                  alt="Logo"
                  style={{ width: "55px", height: "auto", borderRadius: "4px" }}
                />
                <div>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      paddingBottom: "2px",
                    }}
                  >
                    NILGIRI PUMPS AND FITTINGS
                  </h1>
                  <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                    <div>
                      11/339A3, Calicut Road, Gudalur, Nilgiris, Tamilnadu
                      643212
                    </div>
                    <div>
                      <b>GSTIN/UIN:</b> 33BHFPM8521H1ZE
                    </div>
                    <div>
                      <b>CONTACT:</b> 8592884441, 9486938207
                    </div>
                    <div>
                      <b>Email:</b> nilgiripumpsandfittings@gmail.com
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="print-invoice-details">
              <h2
                style={{
                  fontSize: "16px",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "5px",
                  marginBottom: "5px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>TAX INVOICE</span>
                <span style={{ fontSize: "10px", color: "#555" }}>
                  PURCHASE RECORD
                </span>
              </h2>
              <table
                style={{
                  width: "100%",
                  fontSize: "12px",
                  borderCollapse: "collapse",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Purchase No:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {printPurchase.purchase.purchase_number}
                    </td>
                  </tr>
                  {printPurchase.purchase.bill_number && (
                    <tr>
                      <td style={{ padding: "3px 0" }}>
                        <b>Supplier Bill No:</b>
                      </td>
                      <td style={{ padding: "3px 0" }}>
                        {printPurchase.purchase.bill_number}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Date:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {formatDateTime(printPurchase.purchase.purchase_date)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Payment Terms:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {printPurchase.purchase.payment_method}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="print-party-details"
            style={{ width: "100%", marginBottom: "10px", padding: "6px" }}
          >
            <h3
              style={{
                fontSize: "12px",
                margin: "0 0 3px 0",
                borderBottom: "1px solid #ccc",
                paddingBottom: "3px",
              }}
            >
              Supplier Details (From)
            </h3>
            {printPurchase.supplier ? (
              <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                <strong>{printPurchase.supplier.name}</strong>
                {printPurchase.supplier.address && (
                  <div>{printPurchase.supplier.address}</div>
                )}
                <div>
                  <b>Phone:</b> {printPurchase.supplier.phone || "-"}
                </div>
                {printPurchase.supplier.gstin && (
                  <div>
                    <b>GSTIN:</b> {printPurchase.supplier.gstin}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "12px" }}>Unspecified Supplier</div>
            )}
          </div>

          <table className="print-items">
            <thead>
              <tr>
                <th style={{ width: "35px" }}>Sl No.</th>
                <th>Description of Goods</th>
                <th style={{ width: "65px", textAlign: "center" }}>Qty</th>
                <th style={{ width: "75px", textAlign: "right" }}>Rate</th>
                <th style={{ width: "85px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {printPurchase.items.map((item, index) => (
                <tr key={`${item.product_id}-${index}`}>
                  <td style={{ padding: "4px" }}>{index + 1}</td>
                  <td style={{ padding: "4px" }}>{item.product_name}</td>
                  <td style={{ padding: "4px", textAlign: "center", whiteSpace: "nowrap" }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: "4px", textAlign: "right" }}>
                    ₹{item.unit_price.toFixed(2)}
                  </td>
                  <td style={{ padding: "4px", textAlign: "right" }}>
                    ₹{item.line_total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-spacer" />

          <div className="print-footer-container">
            {printPurchase.purchase.tax_amount > 0 && (
              <div
                className="print-tax-summary"
                style={{ marginTop: "5px", fontSize: "10px" }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #ccc",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                        Taxable Value
                      </th>
                      <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                        Total Tax
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                        ₹{printPurchase.purchase.subtotal.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                        ₹{printPurchase.purchase.tax_amount.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div
              className="print-footer-bottom"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "6px",
              }}
            >
              <div style={{ flex: "1", paddingRight: "16px" }}>
                <div style={{ marginBottom: "6px", fontSize: "10.5px" }}>
                  <b>Total Amount (in words):</b>
                  <br />
                  {numberToWords(printPurchase.purchase.grand_total)}
                </div>
              </div>

              <div style={{ width: "270px" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "11px",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "2px 0" }}>Subtotal:</td>
                      <td style={{ textAlign: "right", padding: "2px 0" }}>
                        ₹{printPurchase.purchase.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    {printPurchase.purchase.discount_amount > 0 && (
                      <tr>
                        <td style={{ padding: "2px 0" }}>Discount:</td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "2px 0",
                            color: "red",
                          }}
                        >
                          - ₹{printPurchase.purchase.discount_amount.toFixed(2)}
                        </td>
                      </tr>
                    )}
                    {/* Tax Breakdown Rows */}
                    {(() => {
                      const taxByRate: Record<number, number> = {};
                      printPurchase.items.forEach((item) => {
                        const rate = Number(item.tax_rate) || 0;
                        if (rate > 0) {
                          taxByRate[rate] = (taxByRate[rate] || 0) + item.tax_amount;
                        }
                      });

                      const sortedRates = Object.keys(taxByRate)
                        .map(Number)
                        .sort((a, b) => a - b);

                      if (sortedRates.length === 0 && printPurchase.purchase.tax_amount > 0) {
                        return (
                          <tr>
                            <td style={{ padding: "2px 0" }}>Total Tax:</td>
                            <td style={{ textAlign: "right", padding: "2px 0" }}>
                              ₹{printPurchase.purchase.tax_amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      }

                      return sortedRates.map((rate) => {
                        const totalTaxForRate = taxByRate[rate];
                        const halfRate = rate / 2;
                        const halfTax = totalTaxForRate / 2;
                        return (
                          <React.Fragment key={rate}>
                            <tr>
                              <td style={{ padding: "2px 0", color: "#475569" }}>
                                CGST ({halfRate}%):
                              </td>
                              <td style={{ textAlign: "right", padding: "2px 0" }}>
                                ₹{halfTax.toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "2px 0", color: "#475569" }}>
                                SGST ({halfRate}%):
                              </td>
                              <td style={{ textAlign: "right", padding: "2px 0" }}>
                                ₹{halfTax.toFixed(2)}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      });
                    })()}
                    <tr>
                      <td
                        style={{
                          padding: "3px 0",
                          fontWeight: "bold",
                          fontSize: "12px",
                          borderTop: "1px solid #ccc",
                          borderBottom: "1px solid #ccc",
                        }}
                      >
                        Grand Total:
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "3px 0",
                          fontWeight: "bold",
                          fontSize: "12px",
                          borderTop: "1px solid #ccc",
                          borderBottom: "1px solid #ccc",
                        }}
                      >
                        ₹{printPurchase.purchase.grand_total.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: "10px",
                    textAlign: "right",
                    fontSize: "10px",
                  }}
                >
                  <p style={{ margin: "0 0 14px 0" }}>
                    For <b>NILGIRI PUMPS AND FITTINGS</b>
                  </p>
                  <div
                    style={{
                      borderTop: "1px solid #000",
                      display: "inline-block",
                      paddingTop: "3px",
                    }}
                  >
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </div>

            <div
              className="print-declaration"
              style={{ marginTop: "5px", fontSize: "9.5px", color: "#555" }}
            >
              <b>Declaration:</b> 1) Goods can only be returned within 7 days of the purchase. 2)
              Subject to Nilgiris Jurisdiction Only.
              <span style={{ float: "right" }}>E. & O.E</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
