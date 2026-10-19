import { useEffect, useState } from "react";
import {
  getReportSummary,
  getTopSellingProducts,
  getItemwiseSalesReport,
  getItemwisePurchaseReport,
  type ReportSummary,
  type TopSellingProduct,
  type ItemwiseReportRow,
} from "../../database/reports";
import {
  getAuditorReportItems,
  type AuditorReportItem,
} from "../../database/invoice";
import {
  getAuditorPurchaseItems,
  type AuditorPurchaseItem,
} from "../../database/purchase";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import * as XLSX from "xlsx-js-style";
import { generateGstExcelData } from "../../database/gstExport";
import { invoke } from "@tauri-apps/api/core";
import logo from "../../assets/logosquaregreen.jpeg";

function AuditorExportModal({
  onClose,
  onExportGST,
  onExportPDF,
}: {
  onClose: () => void;
  onExportGST: (start: string, end: string) => void;
  onExportPDF: (start: string, end: string) => void;
}) {
  const [start, setStart] = useState(new Date().toISOString().split("T")[0]);
  const [end, setEnd] = useState(new Date().toISOString().split("T")[0]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal product-editor-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px" }}
      >
        <div className="modal-header">
          <div>
            <h3>Auditor Tax Export</h3>
            <p>Generate clean tax filing reports excluding non-taxable / 0% tax items.</p>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="product-editor-body" style={{ padding: "20px" }}>
          <div
            style={{
              padding: "10px 14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#1e40af",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <span>ℹ️</span>
            <span>
              Per auditor standards, this export filters out zero-rated / 0% GST items and packages both Outward Sales & Inward Purchase ITC.
            </span>
          </div>

          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>📅</span>
              <span>Select Date Period</span>
            </div>

            <div className="product-editor-grid-2">
              <div className="product-editor-field">
                <label>Start Date</label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>

              <div className="product-editor-field">
                <label>End Date</label>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0" }}>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="primary-button"
              onClick={() => onExportGST(start, end)}
              style={{
                backgroundColor: "#16a34a",
                borderColor: "#16a34a",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📊</span>
              <span>Export GST Excel</span>
            </button>
            <button
              className="primary-button"
              onClick={() => onExportPDF(start, end)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🖨️</span>
              <span>Print PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function ReportsPage() {
  const today = new Date().toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedPreset, setSelectedPreset] = useState("Today");

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);
  const [itemwiseSales, setItemwiseSales] = useState<ItemwiseReportRow[]>([]);
  const [itemwisePurchases, setItemwisePurchases] = useState<ItemwiseReportRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showAuditorModal, setShowAuditorModal] = useState(false);

  const [printAuditorData, setPrintAuditorData] = useState<{
    items: AuditorReportItem[];
    purchases: AuditorPurchaseItem[];
    startDate: string;
    endDate: string;
  } | null>(null);

  const [printItemwiseSalesMode, setPrintItemwiseSalesMode] = useState(false);
  const [printItemwisePurchasesMode, setPrintItemwisePurchasesMode] = useState(false);

  useEffect(() => {
    if (
      !printItemwiseSalesMode &&
      !printItemwisePurchasesMode &&
      !printAuditorData
    )
      return;

    const timer = setTimeout(() => {
      window.print();
    }, 300);

    const handleAfterPrint = () => {
      setPrintItemwiseSalesMode(false);
      setPrintItemwisePurchasesMode(false);
      setPrintAuditorData(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printItemwiseSalesMode, printItemwisePurchasesMode, printAuditorData]);

  async function loadReports(
    selectedFromDate = fromDate,
    selectedToDate = toDate,
  ) {
    try {
      setLoading(true);
      setError("");

      const [
        summaryData,
        productsData,
        itemwiseSalesData,
        itemwisePurchasesData,
      ] = await Promise.all([
        getReportSummary(selectedFromDate, selectedToDate),
        getTopSellingProducts(selectedFromDate, selectedToDate),
        getItemwiseSalesReport(selectedFromDate, selectedToDate),
        getItemwisePurchaseReport(selectedFromDate, selectedToDate),
      ]);

      setSummary(summaryData);
      setTopProducts(productsData);
      setItemwiseSales(itemwiseSalesData);
      setItemwisePurchases(itemwisePurchasesData);
    } catch (err) {
      console.error("Failed to load reports:", err);
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  function handlePreset(preset: string) {
    const now = new Date();

    let from = new Date(now);
    let to = new Date(now);

    if (preset === "Today") {
      // Already today
    }

    if (preset === "Yesterday") {
      from.setDate(now.getDate() - 1);
      to.setDate(now.getDate() - 1);
    }

    if (preset === "This Week") {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      from.setDate(now.getDate() + diff);
    }

    if (preset === "This Month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const fromString = getDateString(from);
    const toString = getDateString(to);

    setFromDate(fromString);
    setToDate(toString);
    setSelectedPreset(preset);

    loadReports(fromString, toString);
  }

  function handleApplyFilter() {
    if (!fromDate || !toDate) {
      setError("Please select both dates.");
      return;
    }

    if (fromDate > toDate) {
      setError("From date cannot be after To date.");
      return;
    }

    loadReports();
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN");
  }

  async function handleExportGSTExcel(startDate: string, endDate: string) {
    try {
      const defaultFileName = `GST_Report_${startDate}_to_${endDate}.xlsx`;
      const wb = await generateGstExcelData(startDate, endDate);
      const fileData = XLSX.write(wb, { type: "array", bookType: "xlsx" });

      const savePath = await saveDialog({
        title: "Save GST Excel",
        defaultPath: defaultFileName,
        filters: [
          {
            name: "Excel Workbook",
            extensions: ["xlsx"],
          },
        ],
      });

      if (savePath) {
        await invoke("save_binary_file", {
          path: savePath,
          content: Array.from(new Uint8Array(fileData)),
        });
        alert("GST Excel Export successful!");
        setShowAuditorModal(false);
      }
    } catch (error: any) {
      console.error("Export failed:", error);
      alert(
        "Failed to export auditor report. Error: " +
          (error?.message || error || "Unknown Error"),
      );
    }
  }

  const isProfitable = (summary?.grossProfit ?? 0) >= 0;

  return (
    <div className="reports-page-container">
      {/* Header Row */}
      <div className="reports-header-row">
        <div>
          <h3>Reports & Financial Analytics</h3>
          <p>Track business revenue, gross profits, tax obligations, product sales, and auditor exports.</p>
        </div>

        <div className="reports-header-actions">
          <div className="reports-summary-badge">
            <span>📅</span>
            <span>
              {selectedPreset}: {formatDate(fromDate)} {fromDate !== toDate ? `to ${formatDate(toDate)}` : ""}
            </span>
          </div>

          <button
            type="button"
            className="reports-auditor-btn"
            onClick={() => setShowAuditorModal(true)}
          >
            <span>📑</span>
            <span>Export for Auditor</span>
          </button>
        </div>
      </div>

      {/* Date Filter Panel */}
      <div className="reports-filter-card">
        {/* Presets Segmented Row */}
        <div className="reports-presets-row">
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginRight: "4px",
            }}
          >
            Period:
          </span>
          {["Today", "Yesterday", "This Week", "This Month"].map((preset) => (
            <button
              key={preset}
              type="button"
              className={`reports-preset-btn ${selectedPreset === preset ? "active" : ""}`}
              onClick={() => handlePreset(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Date Range & Apply Action */}
        <div className="reports-date-row">
          <div className="reports-date-field">
            <label>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setSelectedPreset("Custom");
              }}
            />
          </div>

          <div className="reports-date-field">
            <label>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setSelectedPreset("Custom");
              }}
            />
          </div>

          <button
            type="button"
            className="reports-apply-btn"
            onClick={handleApplyFilter}
            disabled={loading}
          >
            <span>🔍</span>
            <span>{loading ? "Loading Data..." : "Apply Date Filter"}</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#dc2626",
              fontSize: "12px",
            }}
          >
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* 8-Card Summary KPI Grid */}
      <div className="reports-stats-grid">
        {/* Total Sales */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Total Sales</div>
            <div className="stat-value" style={{ color: "#0f172a" }}>
              ₹{(summary?.totalSales ?? 0).toFixed(2)}
            </div>
            <div className="stat-sub">Across {summary?.totalBills ?? 0} invoices</div>
          </div>
          <div className="reports-stat-icon stat-icon-green">📈</div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Cost of Goods</div>
            <div className="stat-value" style={{ color: "#475569" }}>
              ₹{(summary?.totalCost ?? 0).toFixed(2)}
            </div>
            <div className="stat-sub">Inventory cost basis</div>
          </div>
          <div className="reports-stat-icon stat-icon-amber">📦</div>
        </div>

        {/* Gross Profit */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Gross Profit</div>
            <div
              className="stat-value"
              style={{ color: isProfitable ? "#059669" : "#dc2626" }}
            >
              ₹{(summary?.grossProfit ?? 0).toFixed(2)}
            </div>
            <div className="stat-sub">Net revenue after COGS</div>
          </div>
          <div className="reports-stat-icon stat-icon-emerald">💰</div>
        </div>

        {/* Profit Margin */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Profit Margin</div>
            <div
              className="stat-value"
              style={{ color: isProfitable ? "#0284c7" : "#dc2626" }}
            >
              {(summary?.profitMargin ?? 0).toFixed(2)}%
            </div>
            <div className="stat-sub">Gross margin ratio</div>
          </div>
          <div className="reports-stat-icon stat-icon-blue">📊</div>
        </div>

        {/* Total Purchases */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Total Purchases</div>
            <div className="stat-value" style={{ color: "#7c3aed" }}>
              ₹{(summary?.totalPurchases ?? 0).toFixed(2)}
            </div>
            <div className="stat-sub">Incoming supplier stock</div>
          </div>
          <div className="reports-stat-icon stat-icon-purple">📥</div>
        </div>

        {/* Total Bills Count */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Total Bills Issued</div>
            <div className="stat-value">
              {summary?.totalBills ?? 0}
            </div>
            <div className="stat-sub">Completed sales transactions</div>
          </div>
          <div className="reports-stat-icon stat-icon-slate">🧾</div>
        </div>

        {/* Output Sales Tax */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Output Sales Tax</div>
            <div className="stat-value" style={{ color: "#0d9488" }}>
              ₹{(summary?.salesTax ?? 0).toFixed(2)}
            </div>
            <div className="stat-sub">GST collected on outward supplies</div>
          </div>
          <div className="reports-stat-icon stat-icon-teal">🏛️</div>
        </div>

        {/* Input Purchase Tax (ITC) */}
        <div className="reports-stat-card">
          <div>
            <div className="stat-label">Input Tax Credit</div>
            <div className="stat-value" style={{ color: "#4f46e5" }}>
              ₹{(summary?.purchaseTax ?? 0).toFixed(2)}
            </div>
            <div className="stat-sub">ITC eligible on purchases</div>
          </div>
          <div className="reports-stat-icon stat-icon-indigo">🏷️</div>
        </div>
      </div>

      {/* Item-wise Sales Report Card */}
      <div className="reports-section-card">
        <div className="reports-section-header">
          <div>
            <h4>
              <span>Item-wise Sales Breakdown</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#059669",
                  background: "#ecfdf5",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {itemwiseSales.length} {itemwiseSales.length === 1 ? "Product" : "Products"}
              </span>
            </h4>
            <p>Complete itemized breakdown of items billed in this period.</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
            onClick={() => setPrintItemwiseSalesMode(true)}
            disabled={itemwiseSales.length === 0}
          >
            <span>🖨️</span>
            <span>Print Sales Report</span>
          </button>
        </div>

        <div className="reports-table-wrapper">
          {loading ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              Loading sales items...
            </div>
          ) : itemwiseSales.length === 0 ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>📦</div>
              No sales recorded for the selected date range.
            </div>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ width: "35px", textAlign: "center" }}>#</th>
                  <th>Product Name</th>
                  <th style={{ width: "95px" }}>HSN/SAC</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Qty Sold</th>
                  <th style={{ width: "105px", textAlign: "right" }}>GST Tax (₹)</th>
                  <th style={{ width: "115px", textAlign: "right" }}>Revenue (₹)</th>
                  <th style={{ width: "105px", textAlign: "right" }}>Cost (₹)</th>
                  <th style={{ width: "110px", textAlign: "right" }}>Profit (₹)</th>
                  <th style={{ width: "85px", textAlign: "center" }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {itemwiseSales.map((item, index) => {
                  const profit = item.gross_profit ?? 0;
                  const isItemProfitable = profit >= 0;
                  const marginVal = item.profit_margin ?? 0;

                  return (
                    <tr key={item.product_id}>
                      <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                        {index + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>
                          {item.product_name}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#475569" }}>
                          {item.hsn_sac || "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>
                        {item.quantity}
                      </td>
                      <td style={{ textAlign: "right", color: "#0d9488" }}>
                        ₹{(item.tax_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                        ₹{item.total_amount.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", color: "#64748b" }}>
                        ₹{(item.total_cost || 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color: isItemProfitable ? "#059669" : "#dc2626",
                        }}
                      >
                        ₹{profit.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: isItemProfitable ? "#ecfdf5" : "#fef2f2",
                            color: isItemProfitable ? "#047857" : "#b91c1c",
                          }}
                        >
                          {marginVal.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const totalQty = itemwiseSales.reduce((acc, curr) => acc + curr.quantity, 0);
                  const totalTax = itemwiseSales.reduce((acc, curr) => acc + (curr.tax_amount || 0), 0);
                  const totalAmount = itemwiseSales.reduce((acc, curr) => acc + curr.total_amount, 0);
                  const totalCost = itemwiseSales.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);
                  const totalProfit = itemwiseSales.reduce((acc, curr) => acc + (curr.gross_profit || 0), 0);
                  const netRev = totalAmount - totalTax;
                  const overallMargin = netRev > 0 ? (totalProfit / netRev) * 100 : 0;

                  return (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>
                        Total Summary:
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>
                        {totalQty}
                      </td>
                      <td style={{ textAlign: "right", color: "#0d9488", fontWeight: 600 }}>
                        ₹{totalTax.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>
                        ₹{totalAmount.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", color: "#64748b", fontWeight: 600 }}>
                        ₹{totalCost.toFixed(2)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 800,
                          color: totalProfit >= 0 ? "#059669" : "#dc2626",
                          fontSize: "13px",
                        }}
                      >
                        ₹{totalProfit.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 800 }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: totalProfit >= 0 ? "#d1fae5" : "#fee2e2",
                            color: totalProfit >= 0 ? "#065f46" : "#991b1b",
                          }}
                        >
                          {overallMargin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Item-wise Purchase Report Card */}
      <div className="reports-section-card">
        <div className="reports-section-header">
          <div>
            <h4>
              <span>Item-wise Purchase Breakdown</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#7c3aed",
                  background: "#faf5ff",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {itemwisePurchases.length} {itemwisePurchases.length === 1 ? "Product" : "Products"}
              </span>
            </h4>
            <p>Summary of all incoming inventory purchases and supplier stock.</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
            onClick={() => setPrintItemwisePurchasesMode(true)}
            disabled={itemwisePurchases.length === 0}
          >
            <span>🖨️</span>
            <span>Print Purchase Report</span>
          </button>
        </div>

        <div className="reports-table-wrapper">
          {loading ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              Loading purchase items...
            </div>
          ) : itemwisePurchases.length === 0 ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>📥</div>
              No inventory purchases found for the selected date range.
            </div>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>#</th>
                  <th>Product Name</th>
                  <th style={{ width: "110px" }}>HSN/SAC</th>
                  <th style={{ width: "110px", textAlign: "center" }}>Qty Purchased</th>
                  <th style={{ width: "120px", textAlign: "right" }}>ITC Tax (₹)</th>
                  <th style={{ width: "140px", textAlign: "right" }}>Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {itemwisePurchases.map((item, index) => (
                  <tr key={item.product_id}>
                    <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                      {index + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        {item.product_name}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "#475569" }}>
                        {item.hsn_sac || "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>
                      {item.quantity}
                    </td>
                    <td style={{ textAlign: "right", color: "#4f46e5" }}>
                      ₹{(item.tax_amount || 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                      ₹{item.total_amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right" }}>
                    Total Purchases Summary:
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {itemwisePurchases.reduce((acc, curr) => acc + curr.quantity, 0)}
                  </td>
                  <td style={{ textAlign: "right", color: "#4f46e5" }}>
                    ₹{itemwisePurchases.reduce((acc, curr) => acc + (curr.tax_amount || 0), 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right", color: "#7c3aed", fontSize: "14px" }}>
                    ₹{itemwisePurchases.reduce((acc, curr) => acc + curr.total_amount, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Top Selling Products Card */}
      <div className="reports-section-card">
        <div className="reports-section-header">
          <div>
            <h4>
              <span>Top Performing Products</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#d97706",
                  background: "#fef3c7",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                By Volume Sold
              </span>
            </h4>
            <p>Catalog items generating the highest customer demand and sales value.</p>
          </div>
        </div>

        <div className="reports-table-wrapper">
          {loading ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              Loading top products...
            </div>
          ) : topProducts.length === 0 ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>🏆</div>
              No sales activity found for this period.
            </div>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ width: "50px", textAlign: "center" }}>Rank</th>
                  <th>Product Name</th>
                  <th style={{ width: "140px", textAlign: "center" }}>Units Sold</th>
                  <th style={{ width: "160px", textAlign: "right" }}>Total Revenue (₹)</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => {
                  const rankClass =
                    index === 0
                      ? "rank-1"
                      : index === 1
                      ? "rank-2"
                      : index === 2
                      ? "rank-3"
                      : "rank-other";

                  return (
                    <tr key={product.product_id}>
                      <td style={{ textAlign: "center" }}>
                        <span className={`rank-badge ${rankClass}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>
                          {product.product_name}
                        </div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "#0f172a" }}>
                        {product.quantity_sold}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#059669" }}>
                        ₹{product.sales_amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ================= PRINT RENDERS ================= */}
      {printItemwiseSalesMode && (
        <div className="print-itemwise" style={{ padding: "20px" }}>
          <div
            className="print-header"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              textAlign: "left",
              marginBottom: "20px",
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{ width: "60px", height: "auto", borderRadius: "4px" }}
            />
            <div>
              <h1>NILGIRI PUMPS AND FITTINGS</h1>
              <p>11/339A3, Calicut Road, Gudalur, Nilgiris, Tamilnadu 643212</p>
              <p>
                GSTIN/UIN: 33BHFPM8521H1ZE | CONTACT: 8592884441, 9486938207
              </p>
            </div>
          </div>

          <div
            className="print-header"
            style={{ textAlign: "center", marginBottom: "20px" }}
          >
            <h2>Item-wise Sales Report</h2>
            <p>
              From: {formatDate(fromDate)} To: {formatDate(toDate)}
            </p>
          </div>
          <table
            className="print-items"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", padding: "5px" }}>#</th>
                <th style={{ textAlign: "left", padding: "5px" }}>Product</th>
                <th style={{ textAlign: "left", padding: "5px" }}>HSN/SAC</th>
                <th style={{ textAlign: "right", padding: "5px" }}>Qty Sold</th>
                <th style={{ textAlign: "right", padding: "5px" }}>Tax</th>
                <th style={{ textAlign: "right", padding: "5px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemwiseSales.map((item, index) => (
                <tr
                  key={item.product_id}
                  style={{ borderBottom: "1px solid #ddd" }}
                >
                  <td style={{ padding: "5px" }}>{index + 1}</td>
                  <td style={{ padding: "5px" }}>{item.product_name}</td>
                  <td style={{ padding: "5px" }}>{item.hsn_sac || "-"}</td>
                  <td style={{ textAlign: "right", padding: "5px" }}>
                    {item.quantity}
                  </td>
                  <td style={{ textAlign: "right", padding: "5px" }}>
                    ₹{(item.tax_amount || 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right", padding: "5px" }}>
                    ₹{item.total_amount.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "right",
                    fontWeight: "bold",
                    padding: "10px 5px",
                    borderTop: "2px solid #000",
                  }}
                >
                  Total Sales Amount (incl. Tax):
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: "bold",
                    padding: "10px 5px",
                    borderTop: "2px solid #000",
                  }}
                >
                  ₹
                  {itemwiseSales
                    .reduce((acc, curr) => acc + curr.total_amount, 0)
                    .toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            className="print-thank-you"
            style={{ marginTop: "20px", textAlign: "center" }}
          >
            Sales record generated by NILGIRI PUMPS AND FITTINGS.
          </p>
        </div>
      )}

      {printItemwisePurchasesMode && (
        <div className="print-itemwise" style={{ padding: "20px" }}>
          <div
            className="print-header"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              textAlign: "left",
              marginBottom: "20px",
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{ width: "60px", height: "auto", borderRadius: "4px" }}
            />
            <div>
              <h1>NILGIRI PUMPS AND FITTINGS</h1>
              <p>11/339A3, Calicut Road, Gudalur, Nilgiris, Tamilnadu 643212</p>
              <p>
                GSTIN/UIN: 33BHFPM8521H1ZE | CONTACT: 8592884441, 9486938207
              </p>
            </div>
          </div>

          <div
            className="print-header"
            style={{ textAlign: "center", marginBottom: "20px" }}
          >
            <h2>Item-wise Purchase Report</h2>
            <p>
              From: {formatDate(fromDate)} To: {formatDate(toDate)}
            </p>
          </div>
          <table
            className="print-items"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", padding: "5px" }}>#</th>
                <th style={{ textAlign: "left", padding: "5px" }}>Product</th>
                <th style={{ textAlign: "left", padding: "5px" }}>HSN/SAC</th>
                <th style={{ textAlign: "right", padding: "5px" }}>
                  Qty Purchased
                </th>
                <th style={{ textAlign: "right", padding: "5px" }}>Tax</th>
                <th style={{ textAlign: "right", padding: "5px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemwisePurchases.map((item, index) => (
                <tr
                  key={item.product_id}
                  style={{ borderBottom: "1px solid #ddd" }}
                >
                  <td style={{ padding: "5px" }}>{index + 1}</td>
                  <td style={{ padding: "5px" }}>{item.product_name}</td>
                  <td style={{ padding: "5px" }}>{item.hsn_sac || "-"}</td>
                  <td style={{ textAlign: "right", padding: "5px" }}>
                    {item.quantity}
                  </td>
                  <td style={{ textAlign: "right", padding: "5px" }}>
                    ₹{(item.tax_amount || 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right", padding: "5px" }}>
                    ₹{item.total_amount.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "right",
                    fontWeight: "bold",
                    padding: "10px 5px",
                    borderTop: "2px solid #000",
                  }}
                >
                  Total Purchase Amount (incl. Tax):
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: "bold",
                    padding: "10px 5px",
                    borderTop: "2px solid #000",
                  }}
                >
                  ₹
                  {itemwisePurchases
                    .reduce((acc, curr) => acc + curr.total_amount, 0)
                    .toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            className="print-thank-you"
            style={{ marginTop: "20px", textAlign: "center" }}
          >
            Purchase record generated by NILGIRI PUMPS AND FITTINGS.
          </p>
        </div>
      )}

      {printAuditorData && (() => {
        const items = printAuditorData.items;
        const purchases = printAuditorData.purchases;

        const tSalesIGST = items.reduce((s: number, i: any) => s + i.igst_amount, 0);
        const tSalesCGST = items.reduce((s: number, i: any) => s + i.cgst_amount, 0);
        const tSalesSGST = items.reduce((s: number, i: any) => s + i.sgst_amount, 0);
        const tSalesTaxable = items.reduce((s: number, i: any) => s + i.taxable_value, 0);
        const tSalesGrand = items.reduce((s: number, i: any) => s + i.total_amount, 0);
        const b2bSalesTaxable = items.filter(i => i.customer_gstin && i.customer_gstin.trim() !== "").reduce((s: number, i: any) => s + i.taxable_value, 0);
        const b2cSalesTaxable = tSalesTaxable - b2bSalesTaxable;
        const tSalesTotalTax = tSalesIGST + tSalesCGST + tSalesSGST;

        const tPurIGST = purchases.reduce((s: number, i: any) => s + (i.derived_tax_type === "IGST" ? i.tax_amount : 0), 0);
        const tPurCGST = purchases.reduce((s: number, i: any) => s + (i.derived_tax_type === "CGST_SGST" ? i.tax_amount / 2 : 0), 0);
        const tPurSGST = purchases.reduce((s: number, i: any) => s + (i.derived_tax_type === "CGST_SGST" ? i.tax_amount / 2 : 0), 0);
        const tPurTaxable = purchases.reduce((s: number, i: any) => s + i.subtotal, 0);
        const tPurGrand = purchases.reduce((s: number, i: any) => s + i.grand_total, 0);
        const tPurTotalTax = purchases.reduce((s: number, i: any) => s + i.tax_amount, 0);

        const netLiability = tSalesTotalTax - tPurTotalTax;

        return (
          <div className="print-invoice">
            <div className="print-header-grid" style={{ marginBottom: "15px" }}>
              <div className="print-shop-details">
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <img src={logo} alt="Logo" style={{ width: "55px", height: "auto", borderRadius: "4px" }} />
                  <div>
                    <h1 style={{ margin: 0, fontSize: "18px", paddingBottom: "2px", color: "#000", fontWeight: "bold" }}>
                      NILGIRI PUMPS AND FITTINGS
                    </h1>
                    <div style={{ fontSize: "11px", lineHeight: "1.3", color: "#333" }}>
                      <div>11/339A3, Calicut Road, Gudalur, Nilgiris, Tamilnadu 643212</div>
                      <div><b>GSTIN/UIN:</b> 33BHFPM8521H1ZE</div>
                      <div><b>CONTACT:</b> 8592884441, 9486938207</div>
                      <div><b>Email:</b> nilgiripumpsandfittings@gmail.com</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="print-invoice-details">
                <h2 style={{ fontSize: "16px", margin: "0 0 5px 0", color: "#000", textTransform: "uppercase" }}>
                  AUDITOR TAX REPORT
                </h2>
                <table style={{ fontSize: "11px", float: "right" }}>
                  <tbody>
                    <tr><td style={{ padding: "2px 5px" }}><b>From:</b></td><td style={{ padding: "2px 5px" }}>{formatDate(printAuditorData.startDate)}</td></tr>
                    <tr><td style={{ padding: "2px 5px" }}><b>To:</b></td><td style={{ padding: "2px 5px" }}>{formatDate(printAuditorData.endDate)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* DASHBOARD SUMMARY (Mirrors Excel) */}
            <div style={{ marginBottom: "20px", border: "2px solid #000", padding: "10px 15px", pageBreakInside: "avoid" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", borderBottom: "1px solid #000", paddingBottom: "5px", textTransform: "uppercase", textAlign: "center" }}>
                INVOICE & ITC SUMMARY DASHBOARD
              </h3>
              
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#1E88E5" }}>SALES SUMMARY (OUTWARD SUPPLIES)</h4>
                  <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr><td style={{ padding: "2px 0" }}>Total Sales (Grand Total)</td><td style={{ textAlign: "right", fontWeight: "bold" }}>₹{tSalesGrand.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0" }}>Total Taxable Value</td><td style={{ textAlign: "right" }}>₹{tSalesTaxable.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0", paddingLeft: "10px", color: "#666" }}>B2B Taxable Value</td><td style={{ textAlign: "right", color: "#666" }}>₹{b2bSalesTaxable.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0", paddingLeft: "10px", color: "#666" }}>B2C Taxable Value</td><td style={{ textAlign: "right", color: "#666" }}>₹{b2cSalesTaxable.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0", paddingTop: "5px" }}>Output CGST</td><td style={{ textAlign: "right", paddingTop: "5px" }}>₹{tSalesCGST.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0" }}>Output SGST</td><td style={{ textAlign: "right" }}>₹{tSalesSGST.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0" }}>Output IGST</td><td style={{ textAlign: "right" }}>₹{tSalesIGST.toFixed(2)}</td></tr>
                      <tr style={{ borderTop: "1px solid #ccc" }}><td style={{ padding: "4px 0", fontWeight: "bold" }}>Total Output GST</td><td style={{ textAlign: "right", fontWeight: "bold" }}>₹{tSalesTotalTax.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#E53935" }}>PURCHASES SUMMARY (INWARD SUPPLIES & ITC)</h4>
                  <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr><td style={{ padding: "2px 0" }}>Total Purchases (Grand Total)</td><td style={{ textAlign: "right", fontWeight: "bold" }}>₹{tPurGrand.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0" }}>Purchase Taxable Subtotal</td><td style={{ textAlign: "right" }}>₹{tPurTaxable.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0", paddingTop: "5px" }}>Purchase ITC - CGST</td><td style={{ textAlign: "right", paddingTop: "5px" }}>₹{tPurCGST.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0" }}>Purchase ITC - SGST</td><td style={{ textAlign: "right" }}>₹{tPurSGST.toFixed(2)}</td></tr>
                      <tr><td style={{ padding: "2px 0" }}>Purchase ITC - IGST</td><td style={{ textAlign: "right" }}>₹{tPurIGST.toFixed(2)}</td></tr>
                      <tr style={{ borderTop: "1px solid #ccc" }}><td style={{ padding: "4px 0", fontWeight: "bold" }}>Total Purchase Tax (ITC)</td><td style={{ textAlign: "right", fontWeight: "bold" }}>₹{tPurTotalTax.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: "15px", borderTop: "2px solid #000", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "14px" }}>FINAL NET LIABILITY: <span style={{ fontSize: "11px", color: "#666", fontWeight: "normal" }}>(Output GST - Input Tax Credit)</span></h4>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: netLiability > 0 ? "#E53935" : "#43A047" }}>
                  {netLiability > 0 ? "PAYABLE: " : "CREDIT: "} ₹{Math.abs(netLiability).toFixed(2)}
                </div>
              </div>
            </div>

            {/* SALES REGISTER */}
            <h3 style={{ margin: "0 0 10px 0", fontSize: "13px", textTransform: "uppercase", backgroundColor: "#f3f4f6", padding: "5px", border: "1px solid #ddd", pageBreakBefore: "always" }}>1. Sales Register (Outward Supplies)</h3>
            <table className="print-items" style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse", marginBottom: "20px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>Invoice No</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>Product</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>HSN/SAC</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>Tax %</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>Taxable Amt</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>CGST</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>SGST</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>IGST</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>No sales recorded.</td></tr>
                ) : items.map((item: any, index: number) => (
                  <tr key={"s"+index}>
                    <td style={{ padding: "3px", border: "1px solid #ddd" }}>{formatDate(item.invoice_date)}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd" }}>{item.invoice_number}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd" }}>{item.product_name}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd" }}>{item.hsn_sac || "-"}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd" }}>{item.tax_rate}%</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>₹{item.taxable_value.toFixed(2)}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>{item.cgst_amount > 0 ? `₹${item.cgst_amount.toFixed(2)}` : "-"}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>{item.sgst_amount > 0 ? `₹${item.sgst_amount.toFixed(2)}` : "-"}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>{item.igst_amount > 0 ? `₹${item.igst_amount.toFixed(2)}` : "-"}</td>
                    <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold" }}>₹{item.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PURCHASE REGISTER */}
            <h3 style={{ margin: "20px 0 10px 0", fontSize: "13px", textTransform: "uppercase", backgroundColor: "#f3f4f6", padding: "5px", border: "1px solid #ddd", pageBreakBefore: "always" }}>2. Purchase Register & ITC (Inward Supplies)</h3>
            <table className="print-items" style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse", marginBottom: "20px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>Purchase No</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>Supplier</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "left" }}>GSTIN</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>Taxable Subtotal</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>CGST</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>SGST</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>IGST</th>
                  <th style={{ padding: "4px", border: "1px solid #ddd", textAlign: "right" }}>Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>No purchases recorded.</td></tr>
                ) : purchases.map((item: any, index: number) => {
                  const isIgst = item.derived_tax_type === "IGST";
                  const cSgstStr = !isIgst && item.tax_amount > 0 ? `₹${(item.tax_amount / 2).toFixed(2)}` : "-";
                  const igstStr = isIgst && item.tax_amount > 0 ? `₹${item.tax_amount.toFixed(2)}` : "-";
                  return (
                    <tr key={"p"+index}>
                      <td style={{ padding: "3px", border: "1px solid #ddd" }}>{formatDate(item.purchase_date)}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd" }}>{item.purchase_number}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd" }}>{item.supplier_name || "Unknown"}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd" }}>{item.supplier_gstin || "-"}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>₹{item.subtotal.toFixed(2)}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>{cSgstStr}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>{cSgstStr}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right" }}>{igstStr}</td>
                      <td style={{ padding: "3px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold" }}>₹{item.grand_total.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            <div style={{ clear: "both" }}></div>
          </div>
        );
      })()}
      
      {showAuditorModal && (
        <AuditorExportModal
          onClose={() => setShowAuditorModal(false)}
          onExportGST={handleExportGSTExcel}
          onExportPDF={async (startDate, endDate) => {
            const items = await getAuditorReportItems(startDate, endDate);
            const purchases = await getAuditorPurchaseItems(startDate, endDate);
            if (items.length === 0 && purchases.length === 0) {
              alert("No data found in this date range.");
              return;
            }
            setPrintAuditorData({ items, purchases, startDate, endDate });
            setShowAuditorModal(false);
          }}
        />
      )}
    </div>
  );
}

export default ReportsPage;
