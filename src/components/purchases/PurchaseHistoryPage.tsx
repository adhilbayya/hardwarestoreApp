import { useEffect, useState } from "react";
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

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN");
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
      (p.supplier_name || "")
        .toLowerCase()
        .includes(purchaseSearch.toLowerCase()) ||
      formatDate(p.purchase_date).includes(purchaseSearch),
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
          <h3>Purchase History</h3>
          <p>
            Search, reprint, modify, or delete previously generated purchase
            records.
          </p>
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
            <label>Search Purchases (Name, PO No)</label>
            <input
              type="text"
              placeholder="e.g. John, PO-001..."
              value={purchaseSearch}
              onChange={(e) => setPurchaseSearch(e.target.value)}
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
          <p>Loading purchases...</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Purchase No</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Tax Amount</th>
                  <th>Grand Total</th>
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
                    <td>{purchase.supplier_name || "Unspecified Supplier"}</td>
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
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      No matching purchases found in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPurchaseDetails && selectedPurchase && (
        <div
          className="modal-overlay"
          onClick={() => setShowPurchaseDetails(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="modal-header">
              <h3>Purchase Details</h3>
              <button
                className="icon-button"
                onClick={() => setShowPurchaseDetails(false)}
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
                {onRedoPurchase && (
                  <>
                    <button
                      className="secondary-button"
                      style={{ color: "#d97706", borderColor: "#f59e0b" }}
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
                      Redo Purchase
                    </button>

                    <button
                      className="secondary-button"
                      style={{ color: "#ef4444", borderColor: "#ef4444" }}
                      onClick={() =>
                        handleDeletePurchase(selectedPurchase.purchase.id)
                      }
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
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
                  Print Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printPurchase && (
        <div className="print-invoice print-purchase">
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
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Date:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {new Date(
                        printPurchase.purchase.purchase_date.replace(
                          " ",
                          "T",
                        ) + "Z",
                      ).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
                <th>Sl No.</th>
                <th>Description of Goods</th>
                <th style={{ width: "50px" }}>Qty</th>
                <th style={{ width: "60px" }}>Rate</th>
                <th style={{ width: "45px" }}>Tax</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {printPurchase.items.map((item, index) => (
                <tr key={`${item.product_id}-${index}`}>
                  <td style={{ padding: "4px" }}>{index + 1}</td>
                  <td style={{ padding: "4px" }}>{item.product_name}</td>
                  <td style={{ padding: "4px", whiteSpace: "nowrap" }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: "4px" }}>
                    ₹{item.unit_price.toFixed(2)}
                  </td>
                  <td style={{ padding: "4px" }}>
                    ₹{item.tax_amount.toFixed(2)}
                  </td>
                  <td style={{ padding: "4px" }}>
                    ₹{(item.line_total + item.tax_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-footer-container">
            {printPurchase.purchase.tax_amount > 0 && (
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
                        Taxable Value
                      </th>
                      <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                        Total Tax
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                        ₹{printPurchase.purchase.subtotal.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                        ₹{printPurchase.purchase.tax_amount.toFixed(2)}
                      </td>
                    </tr>
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
                  {numberToWords(printPurchase.purchase.grand_total)}
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
                        ₹{printPurchase.purchase.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    {printPurchase.purchase.discount_amount > 0 && (
                      <tr>
                        <td style={{ padding: "4px 0" }}>Discount:</td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "4px 0",
                            color: "red",
                          }}
                        >
                          - ₹{printPurchase.purchase.discount_amount.toFixed(2)}
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
                        ₹{printPurchase.purchase.grand_total.toFixed(2)}
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
