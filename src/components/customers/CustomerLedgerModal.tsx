import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  getCustomerLedger,
  recordCustomerPayment,
  type CustomerLedgerResult,
} from "../../database/customerPayment";
import type { Customer } from "../../database/customer";
import { numberToWords } from "../../utils/numberToWords";
import logo from "../../assets/logosquaregreen.jpeg";

interface CustomerLedgerModalProps {
  customer: Customer;
  onClose: () => void;
  onPaymentRecorded?: () => void;
}

export default function CustomerLedgerModal({
  customer,
  onClose,
  onPaymentRecorded,
}: CustomerLedgerModalProps) {
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerResult | null>(null);
  const [error, setError] = useState("");

  // Date filters
  const [filterMode, setFilterMode] = useState<"ALL" | "THIS_MONTH" | "LAST_30" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Record Payment Sub-modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState<string>("Cash");
  const [payNotes, setPayNotes] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | "">("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    loadLedger();
  }, [customer.id, filterMode, startDate, endDate]);

  async function loadLedger() {
    try {
      setLoading(true);
      setError("");

      let start: string | undefined = undefined;
      let end: string | undefined = undefined;

      const now = new Date();
      if (filterMode === "THIS_MONTH") {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        start = firstDay.toISOString().split("T")[0];
        end = now.toISOString().split("T")[0];
      } else if (filterMode === "LAST_30") {
        const past = new Date();
        past.setDate(past.getDate() - 30);
        start = past.toISOString().split("T")[0];
        end = now.toISOString().split("T")[0];
      } else if (filterMode === "CUSTOM") {
        if (startDate) start = startDate;
        if (endDate) end = endDate;
      }

      const res = await getCustomerLedger(customer.id, {
        startDate: start,
        endDate: end,
      });

      setLedgerData(res);
    } catch (err: any) {
      console.error("Failed to load customer ledger:", err);
      setError(err?.message || "Failed to load account ledger.");
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(mode: "ALL" | "THIS_MONTH" | "LAST_30" | "CUSTOM") {
    setFilterMode(mode);
    if (mode === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (mode === "THIS_MONTH") {
      const now = new Date();
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
      setEndDate(now.toISOString().split("T")[0]);
    } else if (mode === "LAST_30") {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split("T")[0]);
      setEndDate(new Date().toISOString().split("T")[0]);
    }
  }

  function openPaymentModal(invoiceId?: number) {
    setPayAmount(
      ledgerData?.summary.current_balance_due && ledgerData.summary.current_balance_due > 0
        ? Math.round(ledgerData.summary.current_balance_due)
        : "",
    );
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("Cash");
    setPayNotes("");
    setSelectedInvoiceId(invoiceId || "");
    setPayError("");
    setShowPaymentModal(true);
  }

  async function handleSavePayment() {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayError("Please enter a valid payment amount greater than 0.");
      return;
    }

    try {
      setSavingPayment(true);
      setPayError("");

      await recordCustomerPayment({
        customer_id: customer.id,
        invoice_id: selectedInvoiceId ? Number(selectedInvoiceId) : null,
        payment_date: payDate ? `${payDate}T12:00:00` : new Date().toISOString(),
        amount: amt,
        payment_method: payMethod,
        notes: payNotes.trim() || (selectedInvoiceId ? `Payment for invoice` : `General payment`),
      });

      setShowPaymentModal(false);
      await loadLedger();
      if (onPaymentRecorded) {
        onPaymentRecorded();
      }
    } catch (err: any) {
      console.error("Failed to record payment:", err);
      setPayError(err?.message || "Failed to save payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  function handlePrint() {
    setTimeout(() => {
      window.print();
    }, 150);
  }

  function formatDate(d: string) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d.split("T")[0];
    }
  }

  function formatDateTime(d: string) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  }

  // List of open invoices for invoice-specific dropdown
  const openInvoices = useMemo(() => {
    if (!ledgerData) return [];
    return ledgerData.entries
      .filter((e) => e.type === "INVOICE" && e.invoice_id)
      .map((e) => ({
        id: e.invoice_id!,
        invoice_number: e.reference,
        date: e.date,
        amount: e.billed_amount,
      }));
  }, [ledgerData]);

  const summary = ledgerData?.summary;
  const entries = ledgerData?.entries || [];

  return (
    <>
      {/* SCREEN MODAL VIEW */}
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal customer-ledger-modal"
          style={{
            maxWidth: "1000px",
            width: "95vw",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header" style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 700,
                }}
              >
                📋
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{customer.name}</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: summary && summary.current_balance_due > 0 ? "#b45309" : "#059669",
                      background: summary && summary.current_balance_due > 0 ? "#fef3c7" : "#ecfdf5",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      border: summary && summary.current_balance_due > 0 ? "1px solid #fde68a" : "1px solid #a7f3d0",
                    }}
                  >
                    {summary && summary.current_balance_due > 0
                      ? `Due: ₹${summary.current_balance_due.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "Account Cleared"}
                  </span>
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                  Customer Khata & Payment Statement • {customer.phone ? `📞 ${customer.phone}` : "No phone registered"}
                  {customer.gstin ? ` • GSTIN: ${customer.gstin}` : ""}
                  {customer.address ? ` • 📍 ${customer.address}` : ""}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="secondary-button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={handlePrint}
                title="Print official customer account statement"
              >
                <span>🖨️</span>
                <span>Print Statement</span>
              </button>

              <button
                type="button"
                className="primary-button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "#059669",
                  cursor: "pointer",
                }}
                onClick={() => openPaymentModal()}
                title="Record new payment or partial installment"
              >
                <span>➕</span>
                <span>Record Payment</span>
              </button>

              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                title="Close ledger"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div
            style={{
              padding: "18px 24px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#dc2626",
                  fontSize: "13px",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {/* KPI Summary Cards */}
            {summary && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: "12px",
                }}
              >
                {/* Total Billed */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Total Purchases (Billed)
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b", marginTop: "4px" }}>
                    ₹{summary.total_billed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Across {summary.total_invoices_count} tax bills
                  </div>
                </div>

                {/* Total Paid */}
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#15803d", textTransform: "uppercase" }}>
                    Total Payments Received
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#166534", marginTop: "4px" }}>
                    ₹{summary.total_paid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "2px" }}>
                    Cash, UPI, & Bank collections
                  </div>
                </div>

                {/* Net Balance Due */}
                <div
                  style={{
                    background: summary.current_balance_due > 0 ? "#fffbeb" : "#f0fdf4",
                    border: summary.current_balance_due > 0 ? "1px solid #fde68a" : "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: summary.current_balance_due > 0 ? "#b45309" : "#15803d",
                      textTransform: "uppercase",
                    }}
                  >
                    Current Net Outstanding
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: summary.current_balance_due > 0 ? "#b45309" : "#166534",
                      marginTop: "4px",
                    }}
                  >
                    ₹{summary.current_balance_due.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: "11px", color: summary.current_balance_due > 0 ? "#d97706" : "#16a34a", marginTop: "2px" }}>
                    {summary.current_balance_due > 0 ? "Pending collection" : "Zero dues"}
                  </div>
                </div>

                {/* Period Balance (if filtered) */}
                {filterMode !== "ALL" && (
                  <div
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "12px 16px",
                    }}
                  >
                    <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", textTransform: "uppercase" }}>
                      Opening Balance
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#334155", marginTop: "4px" }}>
                      ₹{summary.opening_balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      Balance prior to period
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filter Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                background: "#f8fafc",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>Period:</span>
                <button
                  type="button"
                  onClick={() => handleFilterChange("ALL")}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: filterMode === "ALL" ? "#2563eb" : "#cbd5e1",
                    background: filterMode === "ALL" ? "#eff6ff" : "#fff",
                    color: filterMode === "ALL" ? "#2563eb" : "#475569",
                    fontWeight: filterMode === "ALL" ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange("THIS_MONTH")}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: filterMode === "THIS_MONTH" ? "#2563eb" : "#cbd5e1",
                    background: filterMode === "THIS_MONTH" ? "#eff6ff" : "#fff",
                    color: filterMode === "THIS_MONTH" ? "#2563eb" : "#475569",
                    fontWeight: filterMode === "THIS_MONTH" ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange("LAST_30")}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: filterMode === "LAST_30" ? "#2563eb" : "#cbd5e1",
                    background: filterMode === "LAST_30" ? "#eff6ff" : "#fff",
                    color: filterMode === "LAST_30" ? "#2563eb" : "#475569",
                    fontWeight: filterMode === "LAST_30" ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange("CUSTOM")}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: filterMode === "CUSTOM" ? "#2563eb" : "#cbd5e1",
                    background: filterMode === "CUSTOM" ? "#eff6ff" : "#fff",
                    color: filterMode === "CUSTOM" ? "#2563eb" : "#475569",
                    fontWeight: filterMode === "CUSTOM" ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  Custom Dates
                </button>
              </div>

              {filterMode === "CUSTOM" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "#64748b" }}>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>
              )}

              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Showing <strong>{entries.length}</strong> transactions
              </div>
            </div>

            {/* Transactions Ledger Table */}
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  Loading transactions...
                </div>
              ) : entries.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>🧾</div>
                  <h4 style={{ margin: "0 0 6px", color: "#1e293b" }}>No Transactions Found</h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    There are no invoices or payments recorded for this customer in the selected date range.
                  </p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px", width: "110px", color: "#475569" }}>Date</th>
                      <th style={{ padding: "10px 12px", width: "90px", color: "#475569" }}>Type</th>
                      <th style={{ padding: "10px 12px", width: "120px", color: "#475569" }}>Ref #</th>
                      <th style={{ padding: "10px 12px", color: "#475569" }}>Details / Items</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", width: "120px", color: "#475569" }}>
                        Billed (Dr ₹)
                      </th>
                      <th style={{ padding: "10px 12px", textAlign: "right", width: "120px", color: "#475569" }}>
                        Paid (Cr ₹)
                      </th>
                      <th style={{ padding: "10px 12px", textAlign: "right", width: "130px", color: "#475569" }}>
                        Balance Due (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening Balance Row if filtered */}
                    {filterMode !== "ALL" && summary && summary.opening_balance !== 0 && (
                      <tr style={{ background: "#f8fafc", borderBottom: "1px dashed #cbd5e1" }}>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>—</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#475569",
                              background: "#e2e8f0",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            OPENING
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>—</td>
                        <td style={{ padding: "8px 12px", color: "#475569", fontWeight: 500 }}>
                          Opening Balance Brought Forward
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "#94a3b8" }}>—</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "#94a3b8" }}>—</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#334155" }}>
                          ₹{summary.opening_balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}

                    {entries.map((entry) => {
                      const isInv = entry.type === "INVOICE";
                      return (
                        <tr
                          key={entry.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isInv ? "transparent" : "#f0fdf440",
                          }}
                        >
                          <td style={{ padding: "10px 12px", color: "#334155", whiteSpace: "nowrap" }}>
                            {formatDate(entry.date)}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "10px",
                                color: isInv ? "#2563eb" : "#059669",
                                background: isInv ? "#eff6ff" : "#ecfdf5",
                                border: isInv ? "1px solid #bfdbfe" : "1px solid #a7f3d0",
                                display: "inline-block",
                              }}
                            >
                              {isInv ? "🧾 Bill" : "💰 Payment"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: isInv ? "#1d4ed8" : "#0f766e" }}>
                            {entry.reference}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#334155" }}>
                            <div>{entry.description}</div>
                            {entry.items_summary && (
                              <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                                🛍️ {entry.items_summary}
                              </div>
                            )}
                            {entry.notes && (
                              <div style={{ fontSize: "11px", color: "#854d0e", fontStyle: "italic", marginTop: "2px" }}>
                                Note: {entry.notes}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              textAlign: "right",
                              fontWeight: isInv ? 600 : 400,
                              color: isInv ? "#1e293b" : "#94a3b8",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {isInv
                              ? `₹${entry.billed_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              textAlign: "right",
                              fontWeight: !isInv ? 700 : 400,
                              color: !isInv ? "#059669" : "#94a3b8",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {!isInv
                              ? `₹${entry.paid_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: entry.running_balance > 0 ? "#b45309" : "#166534",
                              fontSize: "13px",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            ₹{entry.running_balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {summary && (
                    <tfoot style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: 700 }}>
                      <tr>
                        <td colSpan={4} style={{ padding: "10px 12px", textAlign: "right", color: "#475569" }}>
                          Period Total / Net Closing Balance:
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "#1e293b" }}>
                          ₹{summary.period_billed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "#059669" }}>
                          ₹{summary.period_paid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "right",
                            color: summary.closing_balance > 0 ? "#b45309" : "#166534",
                            fontSize: "14px",
                          }}
                        >
                          ₹{summary.closing_balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT SUB-MODAL */}
      {showPaymentModal && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1100 }}
          onClick={() => !savingPayment && setShowPaymentModal(false)}
        >
          <div
            className="modal"
            style={{ maxWidth: "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Record Customer Payment</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Receive cash, UPI, or bank deposit from {customer.name}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowPaymentModal(false)}
                disabled={savingPayment}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {payError && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    color: "#dc2626",
                    fontSize: "12.5px",
                  }}
                >
                  ⚠️ {payError}
                </div>
              )}

              {/* Outstanding Due Banner */}
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12.5px", color: "#92400e", fontWeight: 600 }}>
                  Current Outstanding Due:
                </span>
                <span style={{ fontSize: "16px", color: "#b45309", fontWeight: 800 }}>
                  ₹{(summary?.current_balance_due || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Payment Amount */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 500"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "16px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>

              {/* Payment Date & Mode Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Payment Mode
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                    }}
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">🏦 Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cheque">📜 Cheque</option>
                    <option value="Card">💳 Card</option>
                  </select>
                </div>
              </div>

              {/* Invoice Allocation Option */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Link to Specific Bill (Optional)
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value === "" ? "" : Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    fontSize: "13px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                  }}
                >
                  <option value="">Auto-allocate across oldest unpaid bills (Recommended)</option>
                  {openInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} ({formatDate(inv.date)}) - Bill Total ₹{inv.amount.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. GPay UTR 912839213 or Cheque #00123"
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    fontSize: "13px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={savingPayment}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  style={{ background: "#059669" }}
                  onClick={handleSavePayment}
                  disabled={savingPayment}
                >
                  {savingPayment ? "Saving Payment..." : "✓ Confirm Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY OFFICIAL STATEMENT VIEW (Portaled directly to body to bypass modal/screen display:none) */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="print-ledger print-ledger-container">
        {/* Store Header */}
        <div style={{ borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <img
                src={logo}
                alt="Logo"
                style={{ width: "60px", height: "60px", objectFit: "contain", borderRadius: "4px" }}
              />
              <div>
                <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "bold", letterSpacing: "0.5px" }}>
                  NILGIRI PUMPS AND FITTINGS
                </h1>
                <div style={{ fontSize: "11px", color: "#333", marginTop: "2px", lineHeight: "1.3" }}>
                  11/339A3, Calicut Road, Gudalur, Nilgiris, Tamilnadu - 643212
                  <br />
                  <strong>GSTIN:</strong> 33BHFPM8521H1ZE | <strong>Phone:</strong> 8592884441, 9486938207
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  background: "#000",
                  color: "#fff",
                  padding: "4px 10px",
                  display: "inline-block",
                  borderRadius: "2px",
                }}
              >
                ACCOUNT STATEMENT
              </div>
              <div style={{ fontSize: "11px", marginTop: "4px", color: "#333" }}>
                <strong>Date:</strong> {formatDateTime(new Date().toISOString())}
              </div>
              <div style={{ fontSize: "11px", color: "#333" }}>
                <strong>Period:</strong>{" "}
                {filterMode === "ALL"
                  ? "All Transactions"
                  : `${formatDate(startDate || "")} to ${formatDate(endDate || "")}`}
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Account Summary Box */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 2fr",
            gap: "12px",
            border: "1px solid #000",
            padding: "10px",
            marginBottom: "14px",
            fontSize: "11.5px",
          }}
        >
          {/* Customer Profile */}
          <div style={{ borderRight: "1px solid #ccc", paddingRight: "10px" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "bold", color: "#555" }}>
              STATEMENT FOR:
            </div>
            <div style={{ fontSize: "15px", fontWeight: "bold", color: "#000", marginTop: "2px" }}>
              {customer.name}
            </div>
            {customer.phone && <div><strong>Phone:</strong> {customer.phone}</div>}
            {customer.address && <div><strong>Address:</strong> {customer.address}</div>}
            {customer.gstin ? (
              <div><strong>GSTIN:</strong> {customer.gstin}</div>
            ) : (
              <div><strong>Category:</strong> Consumer / Unregistered</div>
            )}
            {customer.state_name && <div><strong>State:</strong> {customer.state_name} ({customer.state_code || "33"})</div>}
          </div>

          {/* Account Metrics Box */}
          <div style={{ paddingLeft: "6px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>Total Billed (Purchases):</span>
              <strong>₹{summary ? summary.total_billed.toFixed(2) : "0.00"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>Total Payments Received:</span>
              <strong style={{ color: "#000" }}>₹{summary ? summary.total_paid.toFixed(2) : "0.00"}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #000",
                paddingTop: "4px",
                marginTop: "2px",
                fontSize: "13px",
              }}
            >
              <strong>NET OUTSTANDING BALANCE:</strong>
              <strong style={{ fontSize: "14px" }}>
                ₹{summary ? summary.current_balance_due.toFixed(2) : "0.00"}
              </strong>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
            marginBottom: "14px",
          }}
        >
          <thead>
            <tr style={{ background: "#eee", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", width: "75px", border: "1px solid #000" }}>Date</th>
              <th style={{ padding: "6px 8px", textAlign: "left", width: "65px", border: "1px solid #000" }}>Type</th>
              <th style={{ padding: "6px 8px", textAlign: "left", width: "85px", border: "1px solid #000" }}>Ref #</th>
              <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid #000" }}>Particulars / Item Details</th>
              <th style={{ padding: "6px 8px", textAlign: "right", width: "95px", border: "1px solid #000" }}>
                Debit (Billed ₹)
              </th>
              <th style={{ padding: "6px 8px", textAlign: "right", width: "95px", border: "1px solid #000" }}>
                Credit (Paid ₹)
              </th>
              <th style={{ padding: "6px 8px", textAlign: "right", width: "100px", border: "1px solid #000" }}>
                Balance Due (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {filterMode !== "ALL" && summary && summary.opening_balance !== 0 && (
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: "5px 8px", border: "1px solid #000" }}>—</td>
                <td style={{ padding: "5px 8px", border: "1px solid #000", fontWeight: "bold" }}>OPENING</td>
                <td style={{ padding: "5px 8px", border: "1px solid #000" }}>—</td>
                <td style={{ padding: "5px 8px", border: "1px solid #000", fontStyle: "italic" }}>
                  Opening Balance Brought Forward
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #000" }}>—</td>
                <td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #000" }}>—</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "bold", border: "1px solid #000" }}>
                  ₹{summary.opening_balance.toFixed(2)}
                </td>
              </tr>
            )}

            {entries.map((e) => {
              const isInv = e.type === "INVOICE";
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 8px", border: "1px solid #000" }}>{formatDate(e.date)}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #000", fontWeight: "bold" }}>
                    {isInv ? "BILL" : "PAYMENT"}
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #000" }}>{e.reference}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #000" }}>
                    <div>{e.description}</div>
                    {e.items_summary && (
                      <div style={{ fontSize: "10px", color: "#444" }}>Items: {e.items_summary}</div>
                    )}
                    {e.notes && <div style={{ fontSize: "9.5px", color: "#555" }}>Note: {e.notes}</div>}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #000" }}>
                    {isInv ? `₹${e.billed_amount.toFixed(2)}` : "—"}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #000" }}>
                    {!isInv ? `₹${e.paid_amount.toFixed(2)}` : "—"}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "bold", border: "1px solid #000" }}>
                    ₹{e.running_balance.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {summary && (
            <tfoot>
              <tr style={{ background: "#eee", fontWeight: "bold", borderTop: "2px solid #000" }}>
                <td colSpan={4} style={{ padding: "6px 8px", textAlign: "right", border: "1px solid #000" }}>
                  Total Period Transactions / Net Closing Balance:
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right", border: "1px solid #000" }}>
                  ₹{summary.period_billed.toFixed(2)}
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right", border: "1px solid #000" }}>
                  ₹{summary.period_paid.toFixed(2)}
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontSize: "12px", border: "1px solid #000" }}>
                  ₹{summary.closing_balance.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Amount in Words */}
        {summary && summary.current_balance_due > 0 && (
          <div
            style={{
              border: "1px solid #000",
              padding: "6px 10px",
              fontSize: "11px",
              marginBottom: "14px",
              background: "#fafafa",
            }}
          >
            <strong>Total Amount Due in Words: </strong>
            <span>Rupees {numberToWords(Math.round(summary.current_balance_due))} Only</span>
          </div>
        )}

        {/* Store Bank / UPI Details & Signatures */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: "14px",
            border: "1px solid #000",
            padding: "10px",
            fontSize: "10.5px",
            lineHeight: "1.4",
          }}
        >
          <div>
            <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>
              BANK / UPI PAYMENT DETAILS:
            </div>
            <div><strong>Account Name:</strong> NILGIRI PUMPS AND FITTINGS</div>
            <div><strong>Bank:</strong> South Indian Bank, Gudalur Branch</div>
            <div><strong>Google Pay / PhonePe:</strong> 8592884441 / 9486938207</div>
            <div style={{ marginTop: "4px", fontSize: "9.5px", color: "#555" }}>
              * Please quote Customer Name or Bill No when making UPI / NEFT transfers.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "right" }}>
            <div>
              <strong>For NILGIRI PUMPS AND FITTINGS</strong>
            </div>
            <div style={{ marginTop: "35px" }}>
              Authorized Signatory
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: "9.5px", color: "#666", marginTop: "10px" }}>
          This is a computer generated customer statement. Thank you for your business!
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
