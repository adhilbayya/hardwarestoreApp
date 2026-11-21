import { useEffect, useMemo, useState } from "react";
import {
  getCreditInvoices,
  closeCredit,
  type CreditInvoice,
} from "../../database/invoice";
import { getCustomerById, type Customer } from "../../database/customer";
import CustomerLedgerModal from "../customers/CustomerLedgerModal";

export default function CreditsPage() {
  const [credits, setCredits] = useState<CreditInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Customer Ledger Modal state
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);

  // Settlement modal state
  const [settlingInvoice, setSettlingInvoice] = useState<CreditInvoice | null>(null);
  const [collectAmount, setCollectAmount] = useState<number | "">("");
  const [settleMethod, setSettleMethod] = useState("Cash");
  const [settleNotes, setSettleNotes] = useState("");
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState("");

  useEffect(() => {
    loadCredits();
  }, []);

  async function loadCredits() {
    try {
      setLoading(true);
      const data = await getCreditInvoices();
      setCredits(data);
    } catch (error) {
      console.error("Failed to load credits:", error);
    } finally {
      setLoading(false);
    }
  }

  function openSettleModal(invoice: CreditInvoice) {
    const bal =
      invoice.balance_amount !== undefined && invoice.balance_amount !== null
        ? Number(invoice.balance_amount)
        : Number(invoice.grand_total);
    setSettlingInvoice(invoice);
    setCollectAmount(bal);
    setSettleMethod("Cash");
    setSettleNotes("");
    setSettleError("");
  }

  async function openCustomerLedger(customerId: number) {
    try {
      const c = await getCustomerById(customerId);
      if (c) {
        setLedgerCustomer(c);
      }
    } catch (err) {
      console.error("Failed to load customer details:", err);
    }
  }

  async function handleConfirmSettlement() {
    if (!settlingInvoice) return;
    const amountToCollect = Number(collectAmount);
    if (!amountToCollect || amountToCollect <= 0) {
      setSettleError("Please enter a valid collection amount greater than 0.");
      return;
    }

    const currentBal =
      settlingInvoice.balance_amount !== undefined && settlingInvoice.balance_amount !== null
        ? Number(settlingInvoice.balance_amount)
        : Number(settlingInvoice.grand_total);

    if (amountToCollect > currentBal) {
      setSettleError(`Collection amount cannot exceed the pending due balance (₹${currentBal.toFixed(2)}).`);
      return;
    }

    try {
      setSettling(true);
      setSettleError("");
      await closeCredit(settlingInvoice.id, amountToCollect, settleMethod, settleNotes);
      setSettlingInvoice(null);
      await loadCredits();
    } catch (error: any) {
      console.error("Failed to settle credit:", error);
      setSettleError(error?.message || "Failed to record payment settlement.");
    } finally {
      setSettling(false);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getInvoiceBalance(c: CreditInvoice): number {
    return c.balance_amount !== undefined && c.balance_amount !== null
      ? Number(c.balance_amount)
      : Number(c.grand_total);
  }

  function getInvoicePaid(c: CreditInvoice): number {
    return c.paid_amount !== undefined && c.paid_amount !== null
      ? Number(c.paid_amount)
      : 0;
  }

  const filteredCredits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return credits;

    return credits.filter(
      (c) =>
        c.invoice_number.toLowerCase().includes(q) ||
        (c.customer_name ?? "").toLowerCase().includes(q),
    );
  }, [credits, searchTerm]);

  // Derived KPI statistics
  const stats = useMemo(() => {
    let totalOutstanding = 0;
    const customerSet = new Set<string>();

    for (const c of credits) {
      totalOutstanding += getInvoiceBalance(c);
      if (c.customer_name) customerSet.add(c.customer_name.trim());
    }

    return {
      totalInvoices: credits.length,
      totalAmount: totalOutstanding,
      uniqueCustomers: customerSet.size,
    };
  }, [credits]);

  return (
    <div className="credits-page-container">
      {/* Header Row */}
      <div className="credits-header-row">
        <div>
          <h3>Credit Management & Receivables</h3>
          <p>Track outstanding unpaid invoices, customer debts, and record partial or full payment settlements.</p>
        </div>

        <div className="credits-header-actions">
          <div className="credits-summary-badge">
            <span>⏱️</span>
            <span>
              {credits.length} {credits.length === 1 ? "Pending Invoice" : "Pending Invoices"}
            </span>
          </div>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="credits-stats-grid">
        {/* Total Outstanding Amount */}
        <div className="credits-stat-card">
          <div>
            <div className="stat-label">Total Outstanding Balance</div>
            <div className="stat-value" style={{ color: "#d97706" }}>
              ₹{stats.totalAmount.toFixed(2)}
            </div>
            <div className="stat-sub">Across all unsettled customer sales</div>
          </div>
          <div className="credits-stat-icon stat-icon-amber">💰</div>
        </div>

        {/* Pending Invoices */}
        <div className="credits-stat-card">
          <div>
            <div className="stat-label">Pending Invoices</div>
            <div className="stat-value" style={{ color: "#2563eb" }}>
              {stats.totalInvoices}
            </div>
            <div className="stat-sub">Bills awaiting full payment</div>
          </div>
          <div className="credits-stat-icon stat-icon-blue">🧾</div>
        </div>

        {/* Debtors Count */}
        <div className="credits-stat-card">
          <div>
            <div className="stat-label">Debtor Accounts</div>
            <div className="stat-value" style={{ color: "#7c3aed" }}>
              {stats.uniqueCustomers}
            </div>
            <div className="stat-sub">Unique customers with credit balance</div>
          </div>
          <div className="credits-stat-icon stat-icon-purple">👥</div>
        </div>
      </div>

      {/* Main Credits Card */}
      <div className="credits-card">
        <div className="credits-card-header">
          <div>
            <h4>
              <span>Outstanding Customer Accounts</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#d97706",
                  background: "#fffbeb",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {filteredCredits.length} of {credits.length} Invoices
              </span>
            </h4>
            <p>Review customer invoices with pending dues, collect payments, and settle credit vouchers.</p>
          </div>
        </div>

        {/* Search Row */}
        <div className="credits-search-row">
          <div className="credits-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Filter by invoice number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-btn"
                title="Clear search"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="credits-table-wrapper">
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Loading credit balances...
            </div>
          ) : filteredCredits.length === 0 ? (
            <div style={{ padding: "44px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                {credits.length === 0 ? "🎉" : "🔍"}
              </div>
              <h5 style={{ margin: "0 0 6px", fontSize: "15px", color: "#1e293b" }}>
                {credits.length === 0
                  ? "All credit bills settled!"
                  : "No credit records match your filter"}
              </h5>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
                {credits.length === 0
                  ? "There are currently no outstanding credit or balance-due invoices in your store."
                  : "Try clearing your search query to see all pending customer balances."}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSearchTerm("")}
                >
                  Clear Filter
                </button>
              )}
            </div>
          ) : (
            <table className="credits-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>#</th>
                  <th style={{ width: "150px" }}>Invoice No</th>
                  <th>Customer Name</th>
                  <th style={{ width: "130px" }}>Invoice Date</th>
                  <th style={{ width: "110px", textAlign: "right" }}>Bill Total</th>
                  <th style={{ width: "110px", textAlign: "right" }}>Paid</th>
                  <th style={{ width: "130px", textAlign: "center" }}>Payment Type</th>
                  <th style={{ width: "130px", textAlign: "right" }}>Pending Due</th>
                  <th style={{ width: "140px", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredits.map((credit, index) => {
                  const paid = getInvoicePaid(credit);
                  const bal = getInvoiceBalance(credit);
                  const isPartial = paid > 0;

                  return (
                    <tr key={credit.id}>
                      <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                        {index + 1}
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: "#2563eb" }}>
                          {credit.invoice_number}
                        </span>
                      </td>

                      <td>
                        {credit.customer_id ? (
                          <button
                            type="button"
                            onClick={() => openCustomerLedger(credit.customer_id!)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              fontWeight: 600,
                              color: "#2563eb",
                              textAlign: "left",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                            title="View Customer Khata / Ledger"
                          >
                            {credit.customer_name || "Unknown Customer"}
                          </button>
                        ) : (
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {credit.customer_name || "Walk-in Customer"}
                          </div>
                        )}
                        {credit.customer_phone && (
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            📞 {credit.customer_phone}
                          </div>
                        )}
                      </td>

                      <td>
                        <span style={{ color: "#475569", fontSize: "12px" }}>
                          📅 {formatDate(credit.invoice_date)}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                        ₹{credit.grand_total.toFixed(2)}
                      </td>

                      <td style={{ textAlign: "right", color: "#059669", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        ₹{paid.toFixed(2)}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: isPartial ? "#c2410c" : "#d97706",
                            background: isPartial ? "#fff7ed" : "#fffbeb",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            border: isPartial ? "1px solid #fed7aa" : "1px solid #fde68a",
                            display: "inline-block",
                          }}
                        >
                          {isPartial ? "Partial Due" : "100% Credit"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", fontWeight: 700, color: "#b45309", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>
                        ₹{bal.toFixed(2)}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            className="credits-settle-btn"
                            onClick={() => openSettleModal(credit)}
                            title="Record payment or settle credit"
                          >
                            <span>✓</span>
                            <span>Collect</span>
                          </button>
                          {credit.customer_id && (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{
                                padding: "4px 8px",
                                fontSize: "11.5px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                cursor: "pointer",
                                borderColor: "#cbd5e1",
                              }}
                              onClick={() => openCustomerLedger(credit.customer_id!)}
                              title="View Customer Khata & Statement"
                            >
                              <span>📄</span>
                              <span>Statement</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredCredits.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={7} style={{ textAlign: "right", fontWeight: 700, padding: "12px 14px", background: "#f8fafc" }}>
                      Total Filtered Outstanding Due:
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#b45309", fontSize: "15px", padding: "12px 14px", background: "#f8fafc" }}>
                      ₹{filteredCredits.reduce((s, c) => s + getInvoiceBalance(c), 0).toFixed(2)}
                    </td>
                    <td style={{ background: "#f8fafc" }}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {/* Settle / Collect Payment Modal */}
      {settlingInvoice && (
        <div
          className="modal-overlay"
          onClick={() => !settling && setSettlingInvoice(null)}
        >
          <div
            className="modal"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Receive Payment / Settle Credit</h3>
                <p>Record a customer payment collection toward outstanding invoice balance.</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setSettlingInvoice(null)}
                disabled={settling}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {settleError && (
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
                  ⚠️ {settleError}
                </div>
              )}

              {/* Invoice Summary Box */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  fontSize: "12.5px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Invoice: </span>
                  <strong style={{ color: "#2563eb" }}>{settlingInvoice.invoice_number}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Customer: </span>
                  <strong style={{ color: "#0f172a" }}>{settlingInvoice.customer_name || "Walk-in"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Bill Total: </span>
                  <strong>₹{settlingInvoice.grand_total.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Already Paid: </span>
                  <strong style={{ color: "#059669" }}>₹{getInvoicePaid(settlingInvoice).toFixed(2)}</strong>
                </div>
                <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed #cbd5e1", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#92400e", fontWeight: 600 }}>Current Pending Balance:</span>
                  <strong style={{ color: "#b45309", fontSize: "14px" }}>
                    ₹{getInvoiceBalance(settlingInvoice).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Amount to Collect Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                    Amount Collected Now (₹) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(getInvoiceBalance(settlingInvoice))}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#2563eb",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Collect Full (₹{getInvoiceBalance(settlingInvoice).toFixed(2)})
                  </button>
                </div>

                <input
                  type="number"
                  min="0.01"
                  max={getInvoiceBalance(settlingInvoice)}
                  step="any"
                  value={collectAmount}
                  onChange={(e) =>
                    setCollectAmount(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  autoFocus
                  style={{
                    height: "38px",
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>

              {/* Payment Method & Notes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Payment Mode
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    style={{
                      width: "100%",
                      height: "36px",
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI / GPay</option>
                    <option value="Bank Transfer">🏦 Bank Transfer</option>
                    <option value="Cheque">📜 Cheque</option>
                    <option value="Card">💳 Card</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Notes / Ref # (Optional)
                  </label>
                  <input
                    type="text"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    placeholder="e.g. GPay ref 918231"
                    style={{
                      width: "100%",
                      height: "36px",
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Calculated Result Hint */}
              {collectAmount !== "" && Number(collectAmount) > 0 && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    background:
                      Number(collectAmount) >= getInvoiceBalance(settlingInvoice)
                        ? "#f0fdf4"
                        : "#fffbeb",
                    border:
                      Number(collectAmount) >= getInvoiceBalance(settlingInvoice)
                        ? "1px solid #bbf7d0"
                        : "1px solid #fde68a",
                    color:
                      Number(collectAmount) >= getInvoiceBalance(settlingInvoice)
                        ? "#15803d"
                        : "#92400e",
                  }}
                >
                  {Number(collectAmount) >= getInvoiceBalance(settlingInvoice)
                    ? "✓ This bill will be fully settled and cleared from credit."
                    : `ℹ Partial settlement: ₹${Math.max(0, getInvoiceBalance(settlingInvoice) - Number(collectAmount)).toFixed(2)} will remain due.`}
                </div>
              )}
            </div>

            <div
              className="modal-actions"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                padding: "14px 22px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSettlingInvoice(null)}
                disabled={settling}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleConfirmSettlement}
                disabled={settling || !collectAmount || Number(collectAmount) <= 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>✓</span>
                <span>{settling ? "Recording..." : "Record Payment"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Ledger & Statement Modal */}
      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
          onPaymentRecorded={loadCredits}
        />
      )}
    </div>
  );
}
