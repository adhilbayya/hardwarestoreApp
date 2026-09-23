import { useEffect, useState } from "react";
import {
  getReportSummary,
  getSalesReport,
  getPurchasesReport,
  getTopSellingProducts,
  type ReportSummary,
  type SalesReportRow,
  type PurchaseReportRow,
  type TopSellingProduct,
} from "../../database/reports";
import { getInvoiceById, deleteInvoice } from "../../database/invoice";
import { getPurchaseById } from "../../database/purchase";
import { getCustomerById, type Customer } from "../../database/customer";
import { confirm } from "@tauri-apps/plugin-dialog";
import logo from "../../assets/logosquaregreen.jpeg";

function getDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function ReportsPage({ onRedoBill }: { onRedoBill?: (id: number) => void }) {
  const today = new Date().toISOString().split("T")[0];

  const [selectedPurchase, setSelectedPurchase] = useState<Awaited<
    ReturnType<typeof getPurchaseById>
  > | null>(null);

  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedPreset, setSelectedPreset] = useState("Today");

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sales, setSales] = useState<SalesReportRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseReportRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedInvoice, setSelectedInvoice] = useState<Awaited<
    ReturnType<typeof getInvoiceById>
  > | null>(null);

  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);

  const [showAllSales, setShowAllSales] = useState(false);
  const [salesSearch, setSalesSearch] = useState("");

  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState("");

  const [printInvoice, setPrintInvoice] = useState<Awaited<
    ReturnType<typeof getInvoiceById>
  > | null>(null);
  const [printCustomer, setPrintCustomer] = useState<Customer | null>(null);

  const [printPurchase, setPrintPurchase] = useState<Awaited<
    ReturnType<typeof getPurchaseById>
  > | null>(null);

  useEffect(() => {
    if (!printInvoice && !printPurchase) return;

    const timer = setTimeout(() => {
      window.print();
    }, 300);

    const handleAfterPrint = () => {
      setPrintInvoice(null);
      setPrintPurchase(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printInvoice, printPurchase]);

  async function loadReports(
    selectedFromDate = fromDate,
    selectedToDate = toDate,
  ) {
    try {
      setLoading(true);
      setError("");

      const [summaryData, salesData, purchasesData, productsData] =
        await Promise.all([
          getReportSummary(selectedFromDate, selectedToDate),
          getSalesReport(selectedFromDate, selectedToDate),
          getPurchasesReport(selectedFromDate, selectedToDate),
          getTopSellingProducts(selectedFromDate, selectedToDate),
        ]);

      setSummary(summaryData);
      setSales(salesData);
      setPurchases(purchasesData);
      setTopProducts(productsData);
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

  async function handleViewInvoice(id: number) {
    try {
      const data = await getInvoiceById(id);

      setSelectedInvoice(data);
      setShowInvoiceDetails(true);
    } catch (error) {
      console.error("Failed to load invoice:", error);
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

  async function handleReprintInvoice() {
    if (!selectedInvoice) return;

    if (selectedInvoice.invoice.customer_id) {
      const customer = await getCustomerById(
        selectedInvoice.invoice.customer_id,
      );
      setPrintCustomer(customer);
    } else {
      setPrintCustomer(null);
    }
    setPrintInvoice(selectedInvoice);
  }

  async function handleDeleteInvoice(id: number) {
    const isConfirmed = await confirm(
      "Are you sure you want to completely delete this bill? This action cannot be undone.",
      { title: "Delete Bill", kind: "warning" },
    );
    if (!isConfirmed) return;

    try {
      await deleteInvoice(id);
      setShowInvoiceDetails(false);
      setSelectedInvoice(null);
      // Reload reports to reflect the deleted bill
      loadReports();
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      alert("Failed to delete invoice.");
    }
  }

  function handleReprintPurchase() {
    if (!selectedPurchase) return;

    setPrintPurchase(selectedPurchase);
  }

  const filteredSales = showAllSales
    ? sales.filter(
        (s) =>
          s.invoice_number.toLowerCase().includes(salesSearch.toLowerCase()) ||
          (s.customer_name || "")
            .toLowerCase()
            .includes(salesSearch.toLowerCase()) ||
          formatDate(s.invoice_date).includes(salesSearch),
      )
    : sales.slice(0, 10);

  const filteredPurchases = showAllPurchases
    ? purchases.filter(
        (p) =>
          p.purchase_number
            .toLowerCase()
            .includes(purchaseSearch.toLowerCase()) ||
          (p.supplier_name || "")
            .toLowerCase()
            .includes(purchaseSearch.toLowerCase()) ||
          formatDate(p.purchase_date).includes(purchaseSearch),
      )
    : purchases.slice(0, 10);

  return (
    <div>
      {/* Header */}
      <div className="welcome">
        <div>
          <h3>Reports</h3>
          <p>View sales, purchases and product performance.</p>
        </div>
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

      {/* Sales Report */}
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
            <h3>Sales Report</h3>
            <p>
              {sales.length} transaction{sales.length !== 1 ? "s" : ""}
            </p>
          </div>
          {!showAllSales ? (
            sales.length > 10 && (
              <button
                className="primary-button"
                onClick={() => setShowAllSales(true)}
              >
                View All
              </button>
            )
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="search-input"
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <button
                className="secondary-button"
                onClick={() => {
                  setShowAllSales(false);
                  setSalesSearch("");
                }}
              >
                Show Less
              </button>
            </div>
          )}
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="empty-page">
              <p>Loading sales...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="empty-page">
              <p>No sales found for this date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Tax</th>
                  <th>Amount</th>
                  <th>Payment</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => handleViewInvoice(sale.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="invoice-number">{sale.invoice_number}</td>

                    <td>{sale.customer_name || "Walk-in Customer"}</td>

                    <td>{formatDate(sale.invoice_date)}</td>

                    <td>₹{sale.tax_amount.toFixed(2)}</td>

                    <td>₹{sale.grand_total.toFixed(2)}</td>

                    <td>
                      <span
                        className={`badge ${
                          sale.payment_method.toLowerCase() === "cash"
                            ? "paid"
                            : "credit"
                        }`}
                      >
                        {sale.payment_method}
                      </span>
                    </td>
                  </tr>
                ))}
                {showAllSales && filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
                      No matching sales found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Purchase Report */}
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
            <h3>Purchase Report</h3>
            <p>
              {purchases.length} purchase
              {purchases.length !== 1 ? "s" : ""}
            </p>
          </div>
          {!showAllPurchases ? (
            purchases.length > 10 && (
              <button
                className="primary-button"
                onClick={() => setShowAllPurchases(true)}
              >
                View All
              </button>
            )
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search..."
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                className="search-input"
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <button
                className="secondary-button"
                onClick={() => {
                  setShowAllPurchases(false);
                  setPurchaseSearch("");
                }}
              >
                Show Less
              </button>
            </div>
          )}
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="empty-page">
              <p>Loading purchases...</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="empty-page">
              <p>No purchases found for this date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Tax</th>
                  <th>Amount</th>
                  <th>Payment</th>
                </tr>
              </thead>

              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    onClick={() => handleViewPurchase(purchase.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="invoice-number">
                      {purchase.purchase_number}
                    </td>

                    <td>{purchase.supplier_name || "No Supplier"}</td>

                    <td>{formatDate(purchase.purchase_date)}</td>

                    <td>₹{purchase.tax_amount.toFixed(2)}</td>

                    <td>₹{purchase.grand_total.toFixed(2)}</td>

                    <td>
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
                  </tr>
                ))}
                {showAllPurchases && filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
                      No matching purchases found
                    </td>
                  </tr>
                )}
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
      {showInvoiceDetails && selectedInvoice && (
        <div
          className="modal-overlay"
          onClick={() => setShowInvoiceDetails(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Invoice Details</h3>
                <p>{selectedInvoice.invoice.invoice_number}</p>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowInvoiceDetails(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="invoice-detail-grid">
                <div>
                  <strong>Invoice</strong>
                  <span>{selectedInvoice.invoice.invoice_number}</span>
                </div>

                <div>
                  <strong>Date</strong>
                  <span>
                    {formatDate(selectedInvoice.invoice.invoice_date)}
                  </span>
                </div>

                <div>
                  <strong>Payment</strong>
                  <span>{selectedInvoice.invoice.payment_method}</span>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Tax</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedInvoice.items.map((item) => (
                      <tr key={item.product_id}>
                        <td>{item.product_name}</td>
                        <td>{item.quantity}</td>
                        <td>₹{item.unit_price.toFixed(2)}</td>
                        <td>₹{item.tax_amount.toFixed(2)}</td>
                        <td>₹{item.line_total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="invoice-detail-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>
                    ₹{selectedInvoice.invoice.subtotal.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Tax</span>
                  <strong>
                    ₹{selectedInvoice.invoice.tax_amount.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Discount</span>
                  <strong>
                    ₹{selectedInvoice.invoice.discount_amount.toFixed(2)}
                  </strong>
                </div>

                <div className="grand-total">
                  <span>Grand Total</span>
                  <strong>
                    ₹{selectedInvoice.invoice.grand_total.toFixed(2)}
                  </strong>
                </div>
              </div>
              <div
                className="modal-actions"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  {onRedoBill &&
                    selectedInvoice.invoice.is_redone !== 1 &&
                    Date.now() -
                      new Date(
                        selectedInvoice.invoice.created_at.replace(" ", "T") +
                          "Z",
                      ).getTime() <=
                      30 * 60 * 1000 && (
                      <>
                        <button
                          className="secondary-button"
                          style={{ color: "#d97706", borderColor: "#f59e0b" }}
                          onClick={async () => {
                            const isConfirmed = await confirm(
                              "Are you sure you want to redo this bill? This will discard the current bill and let you edit it.",
                              { title: "Redo Bill", kind: "warning" },
                            );
                            if (isConfirmed) {
                              setShowInvoiceDetails(false);
                              onRedoBill(selectedInvoice.invoice.id);
                            }
                          }}
                        >
                          Redo Bill
                        </button>

                        <button
                          className="secondary-button"
                          style={{ color: "#ef4444", borderColor: "#ef4444" }}
                          onClick={() =>
                            handleDeleteInvoice(selectedInvoice.invoice.id)
                          }
                        >
                          Delete Bill
                        </button>
                      </>
                    )}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="secondary-button"
                    onClick={() => setShowInvoiceDetails(false)}
                  >
                    Close
                  </button>

                  <button
                    className="primary-button"
                    onClick={handleReprintInvoice}
                  >
                    Print Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPurchaseDetails && selectedPurchase && (
        <div
          className="modal-overlay"
          onClick={() => setShowPurchaseDetails(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Purchase Details</h3>
                <p>{selectedPurchase.purchase.purchase_number}</p>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowPurchaseDetails(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="invoice-detail-grid">
                <div>
                  <strong>Purchase</strong>
                  <span>{selectedPurchase.purchase.purchase_number}</span>
                </div>

                <div>
                  <strong>Date</strong>
                  <span>
                    {formatDate(selectedPurchase.purchase.purchase_date)}
                  </span>
                </div>

                <div>
                  <strong>Payment</strong>
                  <span>{selectedPurchase.purchase.payment_method}</span>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Tax</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedPurchase.items.map((item) => (
                      <tr key={item.product_id}>
                        <td>{item.product_name}</td>

                        <td>{item.quantity}</td>

                        <td>₹{item.unit_price.toFixed(2)}</td>

                        <td>₹{item.tax_amount.toFixed(2)}</td>

                        <td>₹{item.line_total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="invoice-detail-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>
                    ₹{selectedPurchase.purchase.subtotal.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Tax</span>
                  <strong>
                    ₹{selectedPurchase.purchase.tax_amount.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Discount</span>
                  <strong>
                    ₹{selectedPurchase.purchase.discount_amount.toFixed(2)}
                  </strong>
                </div>

                <div className="grand-total">
                  <span>Grand Total</span>
                  <strong>
                    ₹{selectedPurchase.purchase.grand_total.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setShowPurchaseDetails(false)}
              >
                Close
              </button>

              <button
                className="primary-button"
                onClick={() => handleReprintPurchase()}
              >
                Print Purchase
              </button>
            </div>
          </div>
        </div>
      )}
      {printInvoice && (
        <div className="print-invoice">
          <div
            className="print-header"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              textAlign: "left",
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

          <h3
            style={{
              marginTop: "15px",
              marginBottom: "15px",
              textAlign: "center",
            }}
          >
            Sales Invoice{" "}
            <span style={{ fontSize: "14px", fontWeight: "normal" }}>
              (DUPLICATE COPY)
            </span>
          </h3>

          <div className="print-info">
            <div>
              <strong>Invoice:</strong> {printInvoice.invoice.invoice_number}
            </div>

            <div>
              <strong>Date:</strong>{" "}
              {new Date(
                printInvoice.invoice.created_at.replace(" ", "T") + "Z",
              ).toLocaleString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
          </div>

          <div className="print-customer">
            <strong>Customer</strong>

            {printCustomer ? (
              <>
                <div>{printCustomer.name}</div>

                {printCustomer.phone && <div>Phone: {printCustomer.phone}</div>}

                {printCustomer.address && <div>{printCustomer.address}</div>}

                {printCustomer.gstin && <div>GSTIN: {printCustomer.gstin}</div>}
              </>
            ) : (
              <div>Walk-in Customer</div>
            )}
          </div>

          <table className="print-items">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>GST</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {printInvoice.items.map((item, index) => (
                <tr key={`${item.product_id}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>₹{item.unit_price.toFixed(2)}</td>
                  <td>
                    {item.tax_amount > 0
                      ? `₹${item.tax_amount.toFixed(2)}`
                      : "-"}
                    {item.tax_rate > 0 ? ` (${item.tax_rate}%)` : ""}
                  </td>
                  <td>₹{item.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-totals">
            <div>
              <span>Subtotal</span>
              <strong>₹{printInvoice.invoice.subtotal.toFixed(2)}</strong>
            </div>

            <div>
              <span>Tax</span>
              <strong>₹{printInvoice.invoice.tax_amount.toFixed(2)}</strong>
            </div>

            {printInvoice.invoice.discount_amount > 0 && (
              <div>
                <span>Discount</span>
                <strong>
                  - ₹{printInvoice.invoice.discount_amount.toFixed(2)}
                </strong>
              </div>
            )}

            <div className="print-grand-total">
              <span>Grand Total</span>
              <strong>₹{printInvoice.invoice.grand_total.toFixed(2)}</strong>
            </div>
          </div>

          <div className="print-payment">
            <strong>Payment Method:</strong>{" "}
            {printInvoice.invoice.payment_method}
          </div>

          <div className="print-footer">Thank you for your business!</div>
        </div>
      )}
      {printPurchase && (
        <div className="print-purchase">
          <div
            className="print-header"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              textAlign: "left",
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

          <h3
            style={{ marginTop: "15px", marginBottom: 0, textAlign: "center" }}
          >
            Purchase Record
          </h3>

          <div className="print-invoice-info">
            <div>
              <strong>Purchase No:</strong>
              <span>{printPurchase.purchase.purchase_number}</span>
            </div>

            <div>
              <strong>Date:</strong>
              <span>{formatDate(printPurchase.purchase.purchase_date)}</span>
            </div>

            <div>
              <strong>Payment:</strong>
              <span>{printPurchase.purchase.payment_method}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Tax</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {printPurchase.items.map((item) => (
                <tr key={item.product_id}>
                  <td>{item.product_name}</td>

                  <td>{item.quantity}</td>

                  <td>₹{item.unit_price.toFixed(2)}</td>

                  <td>₹{item.tax_amount.toFixed(2)}</td>

                  <td>₹{item.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-totals">
            <div>
              <span>Subtotal</span>
              <strong>₹{printPurchase.purchase.subtotal.toFixed(2)}</strong>
            </div>

            <div>
              <span>Tax</span>
              <strong>₹{printPurchase.purchase.tax_amount.toFixed(2)}</strong>
            </div>

            <div>
              <span>Discount</span>
              <strong>
                ₹{printPurchase.purchase.discount_amount.toFixed(2)}
              </strong>
            </div>

            <div className="print-grand-total">
              <span>Grand Total</span>
              <strong>₹{printPurchase.purchase.grand_total.toFixed(2)}</strong>
            </div>
          </div>

          <p className="print-thank-you">
            Purchase record generated by NILGIRI PUMPS AND FITTINGS.
          </p>
        </div>
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
