import { useEffect, useState } from "react";
import { getSalesReport, type SalesReportRow } from "../../database/reports";
import { getInvoiceById, deleteInvoice } from "../../database/invoice";
import { getCustomerById, type Customer } from "../../database/customer";
import { confirm, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
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

  const [showEwayModal, setShowEwayModal] = useState(false);
  const [transDistance, setTransDistance] = useState("0");
  const [transMode, setTransMode] = useState("1");
  const [vehicleNo, setVehicleNo] = useState("");
  const [vehicleType, setVehicleType] = useState("R");

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

  async function handleExportEway() {
    if (!selectedInvoice) return;

    let customerGstin = "URP";
    let customerName = "Unregistered";
    let toStateCode = 33;
    let customerPincode = 643212;
    let customerAddr1 = "Tamilnadu";

    if (selectedInvoice.invoice.customer_id) {
      const cust = await getCustomerById(selectedInvoice.invoice.customer_id);
      if (cust) {
        customerName = cust.name || customerName;
        customerGstin = cust.gstin || "URP";
        if (cust.gstin && cust.gstin.length >= 2) {
          toStateCode = parseInt(cust.gstin.substring(0, 2)) || 33;
        }
      }
    }

    const itemsList = selectedInvoice.items.map((item) => ({
      productName: item.product_name,
      productDesc: item.product_name,
      hsnCode: parseInt(item.hsn_sac || "0") || 0,
      quantity: item.quantity,
      qtyUnit: "NOS",
      taxableAmount: item.line_total,
      sgstRate:
        selectedInvoice.invoice.tax_type === "IGST" ? 0 : item.tax_rate / 2,
      cgstRate:
        selectedInvoice.invoice.tax_type === "IGST" ? 0 : item.tax_rate / 2,
      igstRate: selectedInvoice.invoice.tax_type === "IGST" ? item.tax_rate : 0,
      cessRate: 0,
    }));

    const docDateArray = selectedInvoice.invoice.created_at
      .split(" ")[0]
      .split("-");
    const docDateStr = `${docDateArray[2]}/${docDateArray[1]}/${docDateArray[0]}`;

    const ewayJson = {
      version: "1.0.0321",
      billLists: [
        {
          userGstin: "33BHFPM8521H1ZE",
          supplyType: "O",
          subSupplyType: 1,
          docType: "INV",
          docNo: selectedInvoice.invoice.invoice_number,
          docDate: docDateStr,
          fromGstin: "33BHFPM8521H1ZE",
          fromTrdName: "NILGIRI PUMPS AND FITTINGS",
          fromAddr1: "11/339A3, Calicut Road",
          fromAddr2: "Gudalur, Nilgiris",
          fromPlace: "Gudalur",
          fromPincode: 643212,
          fromStateCode: 33,
          toGstin: customerGstin,
          toTrdName: customerName,
          toAddr1: customerAddr1,
          toAddr2: "",
          toPlace: "",
          toPincode: customerPincode,
          toStateCode: toStateCode,
          totalValue: Number(selectedInvoice.invoice.subtotal.toFixed(2)),
          cgstValue:
            selectedInvoice.invoice.tax_type === "IGST"
              ? 0
              : Number((selectedInvoice.invoice.tax_amount / 2).toFixed(2)),
          sgstValue:
            selectedInvoice.invoice.tax_type === "IGST"
              ? 0
              : Number((selectedInvoice.invoice.tax_amount / 2).toFixed(2)),
          igstValue:
            selectedInvoice.invoice.tax_type === "IGST"
              ? Number(selectedInvoice.invoice.tax_amount.toFixed(2))
              : 0,
          cessValue: 0.0,
          TotNonAdvolVal: 0.0,
          OthValue: 0.0,
          totInvValue: Number(selectedInvoice.invoice.grand_total.toFixed(2)),
          transMode: parseInt(transMode),
          transDistance: parseInt(transDistance),
          transporterName: "",
          transporterId: "",
          transDocNo: "",
          transDocDate: "",
          vehicleNo: vehicleNo,
          vehicleType: vehicleType,
          itemList: itemsList,
        },
      ],
    };

    try {
      const suggestedFilename = `EWAY_${selectedInvoice.invoice.invoice_number}.json`;
      const savePath = await saveDialog({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
        defaultPath: suggestedFilename,
      });

      if (savePath) {
        const content = JSON.stringify(ewayJson, null, 2);
        await invoke("save_csv_file", { path: savePath, content });
        alert("E-Way Bill JSON generated successfully!");
        setShowEwayModal(false);
      }
    } catch (err) {
      console.error("Failed to generate JSON", err);
      alert("Failed to generate E-Way bill JSON");
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
                        <td>{item.product_name}</td>
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
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "10px",
                    color: "#d1d5db",
                    marginTop: "2px",
                    userSelect: "none",
                  }}
                  title="Profit"
                >
                  p:{" "}
                  {(() => {
                    const totalCost = selectedInvoice.items.reduce(
                      (acc, item) =>
                        acc + item.quantity * (item.cost_price || 0),
                      0,
                    );
                    const netSales =
                      selectedInvoice.invoice.subtotal -
                      selectedInvoice.invoice.discount_amount;
                    const finalP = netSales - totalCost;
                    return finalP >= 0
                      ? `₹${finalP.toFixed(2)}`
                      : `-₹${Math.abs(finalP).toFixed(2)}`;
                  })()}
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
                  onClick={() => setShowEwayModal(true)}
                  style={{ color: "#0ea5e9", borderColor: "#0ea5e9" }}
                >
                  Export E-Way JSON
                </button>
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

      {showEwayModal && (
        <div className="modal-overlay" onClick={() => setShowEwayModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px" }}
          >
            <div className="modal-header">
              <div>
                <h3>E-Way Bill Details</h3>
                <p>Enter the transportation details.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowEwayModal(false)}
              >
                ×
              </button>
            </div>
            <div
              className="modal-body"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                paddingBottom: "10px",
              }}
            >
              <div className="form-group">
                <label>Mode of Transport *</label>
                <select
                  value={transMode}
                  onChange={(e) => setTransMode(e.target.value)}
                >
                  <option value="1">Road</option>
                  <option value="2">Rail</option>
                  <option value="3">Air</option>
                  <option value="4">Ship</option>
                </select>
              </div>

              <div className="form-group">
                <label>Distance (in KM) *</label>
                <input
                  type="number"
                  value={transDistance}
                  onChange={(e) => setTransDistance(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                >
                  <option value="R">Regular</option>
                  <option value="O">Over Dimensional Cargo</option>
                </select>
              </div>

              <div className="form-group">
                <label>Vehicle Number</label>
                <input
                  type="text"
                  placeholder="e.g. TN43AB1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "#666",
                    marginTop: "4px",
                    display: "inline-block",
                  }}
                >
                  No spaces or special characters.
                </span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "15px" }}>
              <button
                className="secondary-button"
                onClick={() => setShowEwayModal(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={handleExportEway}
                disabled={!transDistance}
              >
                Generate JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print templates */}
      {printInvoice && (
        <div className="print-invoice">
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
                  DUPLICATE
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
                      <b>Invoice No:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {printInvoice.invoice.invoice_number}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Date:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {new Date(
                        printInvoice.invoice.created_at.replace(" ", "T") + "Z",
                      ).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Payment Terms:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {printInvoice.invoice.payment_method}
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
              Customer Details (To)
            </h3>
            {printInvoice.customer ? (
              <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                <strong>{printInvoice.customer.name}</strong>
                {printInvoice.customer.address && (
                  <div>{printInvoice.customer.address}</div>
                )}

                <div style={{ marginTop: "2px" }}>
                  {printInvoice.customer.state_name && (
                    <span>
                      <b>State:</b> {printInvoice.customer.state_name}{" "}
                    </span>
                  )}
                  {printInvoice.customer.state_code && (
                    <span>
                      <b>Code:</b> {printInvoice.customer.state_code}
                    </span>
                  )}
                </div>
                <div>
                  <b>Phone:</b> {printInvoice.customer.phone || "-"}
                </div>
                {printInvoice.customer.gstin && (
                  <div>
                    <b>GSTIN:</b> {printInvoice.customer.gstin}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "12px" }}>Walk-in Customer</div>
            )}
          </div>

          <table className="print-items">
            <thead>
              <tr>
                <th>Sl No.</th>
                <th>Description of Goods</th>
                <th style={{ width: "70px" }}>HSN/SAC</th>
                <th style={{ width: "50px" }}>Qty</th>
                <th style={{ width: "60px" }}>Rate</th>
                {printInvoice.invoice.tax_type === "CGST_SGST" ? (
                  <>
                    <th style={{ width: "45px" }}>CGST</th>
                    <th style={{ width: "45px" }}>SGST</th>
                  </>
                ) : (
                  <th style={{ width: "45px" }}>IGST</th>
                )}
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {printInvoice.items.map((item, index) => {
                return (
                  <tr key={`${item.product_id}-${index}`}>
                    <td style={{ padding: "4px" }}>{index + 1}</td>
                    <td style={{ padding: "4px" }}>{item.product_name}</td>
                    <td style={{ padding: "4px" }}>{item.hsn_sac || "-"}</td>
                    <td style={{ padding: "4px", whiteSpace: "nowrap" }}>
                      {item.quantity}{" "}
                      {item.is_bulk === 1 && item.bulk_unit
                        ? `(${item.bulk_unit})`
                        : item.unit_symbol
                          ? `(${item.unit_symbol})`
                          : ""}
                    </td>
                    <td style={{ padding: "4px" }}>
                      ₹{item.unit_price.toFixed(2)}
                    </td>

                    {printInvoice.invoice.tax_type === "CGST_SGST" ? (
                      <>
                        <td style={{ padding: "4px" }}>
                          {item.tax_rate > 0 ? `${item.tax_rate / 2}%` : "-"}
                        </td>
                        <td style={{ padding: "4px" }}>
                          {item.tax_rate > 0 ? `${item.tax_rate / 2}%` : "-"}
                        </td>
                      </>
                    ) : (
                      <td style={{ padding: "4px" }}>
                        {item.tax_rate > 0 ? `${item.tax_rate}%` : "-"}
                      </td>
                    )}

                    <td style={{ padding: "4px" }}>
                      ₹{(item.line_total + item.tax_amount).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="print-footer-container">
            {printInvoice.invoice.tax_amount > 0 && (
              <div
                className="print-tax-summary"
                style={{ marginTop: "15px", fontSize: "12px" }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #ddd",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f9f9f9" }}>
                      <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                        HSN/SAC
                      </th>
                      <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                        Taxable Value
                      </th>
                      {printInvoice.invoice.tax_type === "CGST_SGST" ? (
                        <>
                          <th
                            style={{ border: "1px solid #ddd", padding: "4px" }}
                          >
                            CGST Amt
                          </th>
                          <th
                            style={{ border: "1px solid #ddd", padding: "4px" }}
                          >
                            SGST Amt
                          </th>
                        </>
                      ) : (
                        <th
                          style={{ border: "1px solid #ddd", padding: "4px" }}
                        >
                          IGST Amt
                        </th>
                      )}
                      <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                        Total Tax
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      printInvoice.items.reduce(
                        (acc, item) => {
                          const hsn = item.hsn_sac || "Unspecified";
                          if (!acc[hsn])
                            acc[hsn] = {
                              taxable: 0,
                              taxAmount: 0,
                              rate: item.tax_rate,
                            };
                          acc[hsn].taxable += item.line_total;
                          acc[hsn].taxAmount += item.tax_amount;
                          return acc;
                        },
                        {} as Record<
                          string,
                          { taxable: number; taxAmount: number; rate: number }
                        >,
                      ),
                    ).map(([hsn, data], i) => {
                      const taxHalf = data.taxAmount / 2;
                      return (
                        <tr key={i}>
                          <td
                            style={{ border: "1px solid #ddd", padding: "4px" }}
                          >
                            {hsn}
                          </td>
                          <td
                            style={{ border: "1px solid #ddd", padding: "4px" }}
                          >
                            ₹{data.taxable.toFixed(2)}
                          </td>
                          {printInvoice.invoice.tax_type === "CGST_SGST" ? (
                            <>
                              <td
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "4px",
                                }}
                              >
                                ₹{taxHalf.toFixed(2)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "4px",
                                }}
                              >
                                ₹{taxHalf.toFixed(2)}
                              </td>
                            </>
                          ) : (
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "4px",
                              }}
                            >
                              ₹{data.taxAmount.toFixed(2)}
                            </td>
                          )}
                          <td
                            style={{ border: "1px solid #ddd", padding: "4px" }}
                          >
                            ₹{data.taxAmount.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "15px",
              }}
            >
              <div style={{ flex: "1", paddingRight: "20px" }}>
                <div style={{ marginBottom: "15px", fontSize: "12px" }}>
                  <b>Total Amount (in words):</b>
                  <br />
                  {numberToWords(printInvoice.invoice.grand_total)}
                </div>

                <div
                  className="print-bank-details"
                  style={{
                    fontSize: "11px",
                    border: "1px solid #eee",
                    padding: "8px",
                    borderRadius: "4px",
                  }}
                >
                  <b>Company's Bank Details</b>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "4px",
                    }}
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
                        ₹{printInvoice.invoice.subtotal.toFixed(2)}
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
                          - ₹{printInvoice.invoice.discount_amount.toFixed(2)}
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
                        ₹{printInvoice.invoice.grand_total.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: "40px",
                    textAlign: "right",
                    fontSize: "11px",
                  }}
                >
                  <p>
                    For <b>NILGIRI PUMPS AND FITTINGS</b>
                  </p>
                  <div
                    style={{
                      marginTop: "40px",
                      borderTop: "1px solid #000",
                      display: "inline-block",
                      paddingTop: "5px",
                    }}
                  >
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "15px", fontSize: "10px", color: "#555" }}>
              <b>Declaration:</b> 1) Goods once sold will not be taken back. 2)
              Subject to Nilgiris Jurisdiction Only.
              <span style={{ float: "right" }}>E. & O.E</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
