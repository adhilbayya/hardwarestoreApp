import { useEffect, useState } from "react";
import { getSalesReport, type SalesReportRow } from "../../database/reports";
import { getInvoiceById, deleteInvoice } from "../../database/invoice";
import { getCustomerById, type Customer } from "../../database/customer";
import { confirm } from "@tauri-apps/plugin-dialog";
import { numberToWords } from "../../utils/numberToWords";
import logo from "../../assets/logosquaregreen.jpeg";

export default function InvoicesPage({
  onRedoBill,
}: {
  onRedoBill?: (id: number) => void;
}) {
  const [sales, setSales] = useState<SalesReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [salesSearch, setSalesSearch] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Awaited<
    ReturnType<typeof getInvoiceById>
  > | null>(null);

  const [printInvoice, setPrintInvoice] = useState<
    | (Awaited<ReturnType<typeof getInvoiceById>> & {
        customer: Customer | null;
      })
    | null
  >(null);

  useEffect(() => {
    if (!printInvoice) return;

    const timer = setTimeout(() => {
      window.print();
    }, 300);

    const handleAfterPrint = () => {
      setPrintInvoice(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printInvoice]);

  async function loadInvoices() {
    try {
      setLoading(true);
      setError("");
      const data = await getSalesReport(fromDate, toDate);
      setSales(data);
    } catch (err) {
      console.error("Failed to load invoices:", err);
      setError("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, [fromDate, toDate]);

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

  async function handleReprintInvoice() {
    if (!selectedInvoice) return;
    let customer = null;
    if (selectedInvoice.invoice.customer_id) {
      customer = await getCustomerById(selectedInvoice.invoice.customer_id);
    }
    setPrintInvoice({ ...selectedInvoice, customer });
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
      loadInvoices();
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      alert("Failed to delete invoice.");
    }
  }

  const filteredSales = sales.filter(
    (s) =>
      s.invoice_number.toLowerCase().includes(salesSearch.toLowerCase()) ||
      (s.customer_name || "")
        .toLowerCase()
        .includes(salesSearch.toLowerCase()) ||
      (s.customer_phone || "").includes(salesSearch) ||
      formatDate(s.invoice_date).includes(salesSearch),
  );

  return (
    <div>
      <div
        className="welcome"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h3>Invoices History</h3>
          <p>Search, reprint, modify, or delete previously generated bills.</p>
        </div>
      </div>

      <section className="panel">
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
            alignItems: "flex-end",
          }}
        >
          <div className="form-group" style={{ flex: 1, minWidth: "200px" }}>
            <label>Search Bills (Name, Number, Bill No)</label>
            <input
              type="text"
              placeholder="e.g. John, 9876543210, INV-001..."
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>

          <div className="form-group" style={{ paddingBottom: "10px" }}>
            <label>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ paddingBottom: "10px" }}>
            <label>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading ? (
          <p>Loading invoices...</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Tax Amount</th>
                  <th>Grand Total</th>
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
                    <td>
                      {sale.customer_name || "Walk-in Customer"}
                      {sale.customer_phone && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            marginLeft: "6px",
                          }}
                        >
                          ({sale.customer_phone})
                        </span>
                      )}
                    </td>
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
                {filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      No matching invoices found in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invoice Details Modal */}
      {showInvoiceDetails && selectedInvoice && (
        <div
          className="modal-overlay"
          onClick={() => setShowInvoiceDetails(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="modal-header">
              <h3>Invoice Details</h3>
              <button
                className="icon-button"
                onClick={() => setShowInvoiceDetails(false)}
              >
                ×
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                maxHeight: "60vh",
                overflowY: "auto",
                paddingBottom: "16px",
              }}
            >
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
                        <td>
                          {item.product_name}
                          {item.brand && ` - ${item.brand}`}
                        </td>
                        <td>
                          {item.quantity}{" "}
                          {item.is_bulk === 1 && item.bulk_unit
                            ? `(${item.bulk_unit})`
                            : item.unit_symbol
                              ? `(${item.unit_symbol})`
                              : ""}
                        </td>
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
            </div>

            <div
              className="modal-actions"
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                padding: "16px",
                borderTop: "1px solid #e2e8f0",
                backgroundColor: "#fff",
                borderBottomLeftRadius: "8px",
                borderBottomRightRadius: "8px",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                {onRedoBill && (
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
                  Print Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print templates */}
      {printInvoice && (
        <div className="print-invoice">
          <div
            className="print-header"
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              marginBottom: "20px",
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{ width: "55px", height: "auto", borderRadius: "4px" }}
            />
            <div>
              <h1
                style={{ margin: "0", fontSize: "18px", paddingBottom: "2px" }}
              >
                NILGIRI PUMPS AND FITTINGS
              </h1>
              <p
                style={{ marginTop: "0", fontSize: "12px", lineHeight: "1.3" }}
              >
                11/339A3, Calicut Road, Gudalur, Nilgiris, Tamilnadu 643212
                <br />
                <b>GSTIN/UIN:</b> 33BHFPM8521H1ZE
                <br />
                <b>CONTACT:</b> 8592884441, 9486938207 <br />
                <b>Email:</b> nilgiripumpsandfittings@gmail.com
              </p>
            </div>
          </div>

          <div className="print-info">
            <div>
              <strong>Invoice No:</strong> {printInvoice.invoice.invoice_number}
              <br />
              <strong>Date:</strong>{" "}
              {new Date(
                printInvoice.invoice.created_at.replace(" ", "T") + "Z",
              ).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div className="print-customer">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>Billed To:</strong>
                {printInvoice.customer ? (
                  <>
                    {printInvoice.customer.name}
                    <br />
                    {printInvoice.customer.phone && (
                      <>
                        {printInvoice.customer.phone}
                        <br />
                      </>
                    )}
                    {printInvoice.customer.address && (
                      <>
                        {printInvoice.customer.address}
                        <br />
                      </>
                    )}
                    {printInvoice.customer.gstin && (
                      <>GSTIN: {printInvoice.customer.gstin}</>
                    )}
                  </>
                ) : (
                  "Walk-in Customer"
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>Payment Terms:</strong>
                {printInvoice.invoice.payment_method}
              </div>
            </div>
          </div>

          <table className="print-items">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Description</th>
                <th>HSN/SAC</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Rate</th>
                <th style={{ textAlign: "right" }}>Tax</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {printInvoice.items.map((item) => (
                <tr key={item.product_id}>
                  <td>
                    {item.product_name}
                    {item.brand && ` - ${item.brand}`}
                  </td>
                  <td>{item.hsn_sac || "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    {item.quantity}{" "}
                    {item.is_bulk === 1 && item.bulk_unit
                      ? item.bulk_unit
                      : item.unit_symbol || ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {parseFloat(String(item.unit_price)).toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {parseFloat(String(item.tax_amount)).toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {parseFloat(String(item.line_total)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <div
              style={{
                width: "250px",
                fontSize: "12px",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "4px",
                  marginBottom: "4px",
                }}
              >
                Bank Details
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>Bank Name:</div>
                  <div>
                    <b>Indian bank</b>
                  </div>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>A/c No:</div>
                  <div>
                    <b>6567639663</b>
                  </div>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>Branch & IFS Code:</div>
                  <div>
                    <b>Devershola & IDIB000D014</b>
                  </div>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>Contact No:</div>
                  <div>
                    <b>9047134906</b>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "4px",
                  }}
                >
                  <div>Company's PAN:</div>
                  <div>
                    <b>AQZPM8277B</b>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ width: "300px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 0" }}>Subtotal:</td>
                    <td style={{ textAlign: "right", padding: "4px 0" }}>
                      ₹
                      {parseFloat(
                        String(printInvoice.invoice.subtotal),
                      ).toFixed(2)}
                    </td>
                  </tr>
                  {printInvoice.invoice.discount_amount > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0" }}>Discount:</td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "4px 0",
                          color: "red",
                        }}
                      >
                        - ₹
                        {parseFloat(
                          String(printInvoice.invoice.discount_amount),
                        ).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td
                      style={{
                        padding: "4px 0",
                        fontWeight: "bold",
                        borderTop: "1px solid #ccc",
                        borderBottom: "1px solid #ccc",
                      }}
                    >
                      Grand Total:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "4px 0",
                        fontWeight: "bold",
                        borderTop: "1px solid #ccc",
                        borderBottom: "1px solid #ccc",
                      }}
                    >
                      ₹
                      {parseFloat(
                        String(printInvoice.invoice.grand_total),
                      ).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  textTransform: "capitalize",
                }}
              >
                Rupees{" "}
                {numberToWords(Math.round(printInvoice.invoice.grand_total))}{" "}
                Only
              </div>
            </div>
          </div>
          <p
            className="print-thank-you"
            style={{ marginTop: "40px", textAlign: "center" }}
          >
            Thank you for your business!
          </p>
        </div>
      )}
    </div>
  );
}
