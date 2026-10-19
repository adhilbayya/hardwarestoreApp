import { useEffect, useMemo, useState } from "react";
import {
  getCreditInvoices,
  closeCredit,
  type CreditInvoice,
} from "../../database/invoice";
import { confirm } from "@tauri-apps/plugin-dialog";

export default function CreditsPage() {
  const [credits, setCredits] = useState<CreditInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

  async function handleCloseCredit(invoice: CreditInvoice) {
    let confirmed = false;
    try {
      confirmed = await confirm(
        `Are you sure you want to settle the credit for "${invoice.customer_name || "Walk-in Customer"}" (Invoice: ${invoice.invoice_number}) for ₹${invoice.grand_total.toFixed(2)}?`,
        { title: "Settle Customer Credit", kind: "warning" },
      );
    } catch {
      confirmed = window.confirm(
        `Are you sure you want to settle credit for Invoice ${invoice.invoice_number} (₹${invoice.grand_total.toFixed(2)})?`
      );
    }

    if (confirmed) {
      try {
        await closeCredit(invoice.id);
        await loadCredits();
      } catch (error) {
        console.error("Failed to close credit:", error);
      }
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
      totalOutstanding += c.grand_total;
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
          <p>Track outstanding unpaid invoices, customer debts, and record payment settlements.</p>
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
            <div className="stat-sub">Across all unsettled credit sales</div>
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
            <div className="stat-sub">Bills awaiting collection</div>
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
            <div className="stat-sub">Unique customers with credit</div>
          </div>
          <div className="credits-stat-icon stat-icon-purple">👥</div>
        </div>
      </div>

      {/* Main Credits Card */}
      <div className="credits-card">
        <div className="credits-card-header">
          <div>
            <h4>
              <span>Outstanding Credit Invoices</span>
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
            <p>Review customer invoices flagged as credit and settle once payment is received.</p>
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
                  ? "There are currently no outstanding credit invoices in your store."
                  : "Try clearing your search query to see all pending credit invoices."}
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
                  <th style={{ width: "160px" }}>Invoice No</th>
                  <th>Customer Name</th>
                  <th style={{ width: "140px" }}>Invoice Date</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Status</th>
                  <th style={{ width: "150px", textAlign: "right" }}>Pending Amount</th>
                  <th style={{ width: "140px", textAlign: "center" }}>Settlement</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredits.map((credit, index) => (
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
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        {credit.customer_name || "Walk-in Customer"}
                      </div>
                    </td>

                    <td>
                      <span style={{ color: "#475569", fontSize: "12px" }}>
                        📅 {formatDate(credit.invoice_date)}
                      </span>
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#d97706",
                          background: "#fffbeb",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          border: "1px solid #fde68a",
                          display: "inline-block",
                        }}
                      >
                        Unpaid Credit
                      </span>
                    </td>

                    <td style={{ textAlign: "right", fontWeight: 700, color: "#b45309", fontSize: "14px" }}>
                      ₹{credit.grand_total.toFixed(2)}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="credits-settle-btn"
                        onClick={() => handleCloseCredit(credit)}
                        title="Mark this credit as settled and paid"
                      >
                        <span>✓</span>
                        <span>Settle Bill</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filteredCredits.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: "right", fontWeight: 700, padding: "12px 14px", background: "#f8fafc" }}>
                      Total Filtered Outstanding:
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#b45309", fontSize: "15px", padding: "12px 14px", background: "#f8fafc" }}>
                      ₹{filteredCredits.reduce((s, c) => s + c.grand_total, 0).toFixed(2)}
                    </td>
                    <td style={{ background: "#f8fafc" }}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
