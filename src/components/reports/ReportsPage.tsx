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
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "450px" }}
      >
        <div className="modal-header">
          <div>
            <h3>Auditor Export</h3>
            <p style={{ color: "#64748b", fontSize: "13px" }}>
              Generates a clean report containing only taxable items (0% tax
              filtered out).
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body" style={{ padding: "20px" }}>
          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label>Start Date</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-actions" style={{ padding: "15px 20px" }}>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="secondary-button"
              onClick={() => onExportGST(start, end)}
              style={{
                backgroundColor: "#1e88e5",
                color: "white",
                borderColor: "#1e88e5",
              }}
            >
              Export GST Excel
            </button>
            <button
              className="primary-button"
              onClick={() => onExportPDF(start, end)}
            >
              Print PDF
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
  const [itemwisePurchases, setItemwisePurchases] = useState<
    ItemwiseReportRow[]
  >([]);

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
  const [printItemwisePurchasesMode, setPrintItemwisePurchasesMode] =
    useState(false);

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

      // Monday = start of week
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

  return (
    <div>
      {/* Header */}
      <div
        className="welcome"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3>Reports</h3>
          <p>View sales, purchases and product performance.</p>
        </div>

        <button
          className="primary-button"
          style={{
            backgroundColor: "#1e293b",
            color: "#fff",
            borderColor: "#1e293b",
          }}
          onClick={() => setShowAuditorModal(true)}
        >
          Export for Auditor
        </button>
      </div>

      {/* Date Filter */}
      <section className="panel reports-filter">
        <div className="report-presets">
          {["Today", "Yesterday", "This Week", "This Month"].map((preset) => (
            <button
              key={preset}
              className={`report-preset ${
                selectedPreset === preset ? "active" : ""
              }`}
              onClick={() => handlePreset(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="reports-filter-row">
          <div className="form-group">
            <label>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <button
            className="primary-button reports-apply-button"
            onClick={handleApplyFilter}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply Filter"}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
      </section>

      {/* Summary Cards */}
      <section className="stats-grid">
        <StatCard
          title="Total Sales"
          value={`₹${(summary?.totalSales ?? 0).toFixed(2)}`}
          icon="₹"
        />

        <StatCard
          title="Total Purchases"
          value={`₹${(summary?.totalPurchases ?? 0).toFixed(2)}`}
          icon="↓"
        />

        <StatCard
          title="Total Bills"
          value={String(summary?.totalBills ?? 0)}
          icon="#"
        />

        <StatCard
          title="Sales Tax"
          value={`₹${(summary?.salesTax ?? 0).toFixed(2)}`}
          icon="%"
        />

        <StatCard
          title="Purchase Tax"
          value={`₹${(summary?.purchaseTax ?? 0).toFixed(2)}`}
          icon="%"
        />

        <StatCard
          title="Cost of Goods"
          value={`₹${(summary?.totalCost ?? 0).toFixed(2)}`}
          icon="C"
        />

        <StatCard
          title="Gross Profit"
          value={`₹${(summary?.grossProfit ?? 0).toFixed(2)}`}
          icon="P"
        />

        <StatCard
          title="Profit Margin"
          value={`${(summary?.profitMargin ?? 0).toFixed(2)}%`}
          icon="%"
        />
      </section>

      {/* Item-wise Sales Report */}
      <section className="panel report-section">
        <div
          className="panel-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3>Item-wise Sales Report</h3>
            <p>Summary of all items sold within the selected timeline.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => setPrintItemwiseSalesMode(true)}
          >
            Print Sales Report
          </button>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="empty-page">
              <p>Loading items...</p>
            </div>
          ) : itemwiseSales.length === 0 ? (
            <div className="empty-page">
              <p>No items sold found for this date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>HSN/SAC</th>
                  <th>Qty Sold</th>
                  <th>Tax</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {itemwiseSales.map((item, index) => (
                  <tr key={item.product_id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{item.product_name}</strong>
                    </td>
                    <td>{item.hsn_sac || "-"}</td>
                    <td>{item.quantity}</td>
                    <td>₹{(item.tax_amount || 0).toFixed(2)}</td>
                    <td>₹{item.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Item-wise Purchase Report */}
      <section className="panel report-section">
        <div
          className="panel-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3>Item-wise Purchase Report</h3>
            <p>Summary of all items purchased within the selected timeline.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => setPrintItemwisePurchasesMode(true)}
          >
            Print Purchase Report
          </button>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="empty-page">
              <p>Loading items...</p>
            </div>
          ) : itemwisePurchases.length === 0 ? (
            <div className="empty-page">
              <p>No items purchased found for this date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>HSN/SAC</th>
                  <th>Qty Purchased</th>
                  <th>Tax</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {itemwisePurchases.map((item, index) => (
                  <tr key={item.product_id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{item.product_name}</strong>
                    </td>
                    <td>{item.hsn_sac || "-"}</td>
                    <td>{item.quantity}</td>
                    <td>₹{(item.tax_amount || 0).toFixed(2)}</td>
                    <td>₹{item.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Top Selling Products */}
      <section className="panel report-section">
        <div className="panel-header">
          <div>
            <h3>Top Selling Products</h3>
            <p>Products with the highest quantity sold.</p>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="empty-page">
              <p>Loading products...</p>
            </div>
          ) : topProducts.length === 0 ? (
            <div className="empty-page">
              <p>No product sales found for this date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Quantity Sold</th>
                  <th>Sales Amount</th>
                </tr>
              </thead>

              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={product.product_id}>
                    <td>{index + 1}</td>

                    <td>
                      <strong>{product.product_name}</strong>
                    </td>

                    <td>{product.quantity_sold}</td>

                    <td>₹{product.sales_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

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

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-title">{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>

      <div className="stat-value">{value}</div>
    </div>
  );
}

export default ReportsPage;
