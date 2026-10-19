import React, { useEffect, useState, useMemo } from "react";
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  deleteQuotation,
  type Quotation,
  type QuotationItem,
} from "../../database/quotation";
import { getProducts, type Product } from "../../database/product";
import {
  searchCustomers,
  getCustomerByPhone,
  createCustomer,
  type Customer,
} from "../../database/customer";
import { numberToWords } from "../../utils/numberToWords";
import logo from "../../assets/logosquaregreen.jpeg";

interface QuotationsPageProps {
  onConvertToBill: (quotationId: number, quotationData: any) => void;
}

type CartItem = {
  product: Product;
  quantity: number | "";
  isBulk: boolean;
  customRate?: number | "";
};

export default function QuotationsPage({ onConvertToBill }: QuotationsPageProps) {
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create Mode States
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [discount, setDiscount] = useState<number | "">(0);
  const [notes, setNotes] = useState("");
  const [taxType, setTaxType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  const [saving, setSaving] = useState(false);

  // Customer states
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [stateName, setStateName] = useState("Tamil Nadu");
  const [stateCode, setStateCode] = useState("33");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // View details modal
  const [selectedQuote, setSelectedQuote] = useState<{
    quotation: Quotation;
    items: QuotationItem[];
  } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Print mode
  const [printQuote, setPrintQuote] = useState<{
    quotation: Quotation;
    items: QuotationItem[];
  } | null>(null);

  useEffect(() => {
    loadQuotationsList();
    loadAllProducts();
  }, []);

  useEffect(() => {
    if (!printQuote) return;

    const timer = setTimeout(() => {
      window.print();
    }, 300);

    const handleAfterPrint = () => {
      setPrintQuote(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printQuote]);

  async function loadQuotationsList() {
    try {
      setLoading(true);
      setError("");
      const data = await getQuotations();
      setQuotations(data);
    } catch (err: any) {
      console.error("Failed to load quotations:", err);
      setError("Failed to load quotations.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllProducts() {
    try {
      const p = await getProducts();
      setProducts(p);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  }

  function formatCurrency(amt: number) {
    return (
      "₹" +
      (amt || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Filtered products for dropdown search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase().trim();
    return products
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku && p.sku.toLowerCase().includes(q);
        const barcodeMatch = p.barcode && p.barcode.toLowerCase().includes(q);
        const brandMatch = p.brand && p.brand.toLowerCase().includes(q);
        return nameMatch || skuMatch || barcodeMatch || brandMatch;
      })
      .slice(0, 15);
  }, [products, productSearch]);

  // Customer search suggestions
  async function handlePhoneChange(val: string) {
    setPhone(val);
    setSelectedCustomerId(null);
    if (val.trim().length >= 3) {
      try {
        const matches = await searchCustomers(val.trim());
        setCustomerSuggestions(matches);
        setShowCustomerDropdown(matches.length > 0);
      } catch (e) {
        console.error(e);
      }
    } else {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
    }
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomerId(c.id);
    setPhone(c.phone || "");
    setCustomerName(c.name);
    setAddress(c.address || "");
    setGstin(c.gstin || "");
    setStateName(c.state_name || "Tamil Nadu");
    setStateCode(c.state_code || "33");
    setShowCustomerDropdown(false);
  }

  // Cart Calculations matching standard POS Billing (Rate * Qty = Taxable Base, Tax = Base * Rate%, Total = Base + Tax)
  const calculatedItems = useMemo(() => {
    return cart.map((item) => {
      const qty = typeof item.quantity === "number" ? item.quantity : 0;
      let multiplier = 1;

      if (item.isBulk && item.product.has_bulk) {
        multiplier = item.product.bulk_conversion_rate || 1;
      }

      let effectivePrice = item.product.selling_price;
      if (item.customRate !== undefined && item.customRate !== "") {
        effectivePrice = Number(item.customRate) || 0;
      } else if (item.isBulk && item.product.has_bulk) {
        effectivePrice =
          item.product.bulk_price && item.product.bulk_price > 0
            ? item.product.bulk_price
            : item.product.selling_price * multiplier;
      }

      const itemSubtotal = effectivePrice * qty;
      const taxRate = Number(item.product.tax_rate) || 0;
      const taxAmount = (itemSubtotal * taxRate) / 100;
      const lineTotal = itemSubtotal + taxAmount;

      return {
        ...item,
        effectivePrice,
        multiplier,
        itemSubtotal,
        taxRate,
        taxAmount,
        lineTotal,
        costPrice: (item.product.average_cost || item.product.purchase_price || 0) * multiplier,
      };
    });
  }, [cart]);

  const subtotal = calculatedItems.reduce((acc, i) => acc + i.itemSubtotal, 0);
  const totalTax = calculatedItems.reduce((acc, i) => acc + i.taxAmount, 0);
  const numDiscount = typeof discount === "number" ? discount : 0;
  const exactGrandTotal = Math.max(0, subtotal + totalTax - numDiscount);
  const grandTotal = Math.round(exactGrandTotal);

  function addToCart(prod: Product) {
    const existingIndex = cart.findIndex(
      (c) => c.product.id === prod.id && !c.isBulk
    );
    if (existingIndex >= 0) {
      const copy = [...cart];
      const cur = copy[existingIndex].quantity;
      copy[existingIndex].quantity = (typeof cur === "number" ? cur : 0) + 1;
      setCart(copy);
    } else {
      setCart([...cart, { product: prod, quantity: 1, isBulk: false }]);
    }
    setProductSearch("");
  }

  function updateQuantity(index: number, val: string) {
    const copy = [...cart];
    if (val === "") {
      copy[index].quantity = "";
    } else {
      const parsed = parseFloat(val);
      copy[index].quantity = isNaN(parsed) ? 1 : Math.max(0.01, parsed);
    }
    setCart(copy);
  }

  function updateRate(index: number, val: string) {
    const copy = [...cart];
    if (val === "") {
      copy[index].customRate = "";
    } else {
      const parsed = parseFloat(val);
      copy[index].customRate = isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    setCart(copy);
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  function clearCreateForm() {
    setCart([]);
    setPhone("");
    setCustomerName("");
    setAddress("");
    setGstin("");
    setSelectedCustomerId(null);
    setDiscount(0);
    setNotes("");
    setTaxType("CGST_SGST");
  }

  async function handleSaveQuotation() {
    if (cart.length === 0) {
      alert("Please add at least one product to the estimate.");
      return;
    }

    try {
      setSaving(true);

      let custId = selectedCustomerId;
      if (!custId && customerName.trim()) {
        await createCustomer({
          name: customerName.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          gstin: gstin.trim() || undefined,
          state_name: stateName,
          state_code: stateCode,
        });
        if (phone.trim()) {
          const created = await getCustomerByPhone(phone.trim());
          if (created) custId = created.id;
        }
      }

      const quoteItems: QuotationItem[] = calculatedItems.map((ci) => ({
        product_id: ci.product.id,
        product_name: ci.product.name,
        quantity: typeof ci.quantity === "number" ? ci.quantity : 1,
        unit_price: ci.effectivePrice,
        cost_price: ci.costPrice,
        tax_rate: ci.product.tax_rate || 0,
        tax_amount: ci.taxAmount,
        discount_amount: 0,
        line_total: ci.lineTotal,
        is_bulk: ci.isBulk ? 1 : 0,
        bulk_multiplier: ci.multiplier,
      }));

      const quoteId = await createQuotation({
        customer_id: custId,
        subtotal,
        tax_amount: totalTax,
        discount_amount: numDiscount,
        grand_total: grandTotal,
        notes: notes.trim() || null,
        tax_type: taxType,
        items: quoteItems,
      });

      const fullQuote = await getQuotationById(quoteId);
      clearCreateForm();
      setActiveTab("list");
      await loadQuotationsList();
      setPrintQuote(fullQuote);
    } catch (err: any) {
      console.error("Failed to create quotation:", err);
      alert("Error saving quotation: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenDetails(id: number) {
    try {
      const data = await getQuotationById(id);
      setSelectedQuote(data);
      setShowDetailsModal(true);
    } catch (err) {
      console.error("Failed to fetch quotation details:", err);
    }
  }

  async function handlePrintFromList(id: number) {
    try {
      const data = await getQuotationById(id);
      setPrintQuote(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteQuote(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this estimate?")) {
      await deleteQuotation(id);
      await loadQuotationsList();
      if (selectedQuote?.quotation.id === id) {
        setShowDetailsModal(false);
      }
    }
  }

  function handleConvert(quoteData: { quotation: Quotation; items: QuotationItem[] }) {
    onConvertToBill(quoteData.quotation.id, quoteData);
  }

  const filteredQuotes = quotations.filter((q) => {
    const matchesStatus =
      statusFilter === "ALL" || q.status === statusFilter;
    const matchesSearch =
      q.quotation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.customer_name &&
        q.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.customer_phone && q.customer_phone.includes(searchQuery));
    return matchesStatus && matchesSearch;
  });

  return (
    <>
      <div className="quotations-page-container">
        {/* Top Header */}
        <div className="reports-header-row">
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📋</span>
              <span>Quotations & Estimates</span>
            </h3>
          <p>Create non-binding price quotes for customers with 1-click conversion to Tax Invoice.</p>
        </div>

        <div className="reports-header-actions">
          {activeTab === "list" ? (
            <button
              className="primary-button"
              onClick={() => setActiveTab("create")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create New Estimate</span>
            </button>
          ) : (
            <button
              className="secondary-button"
              onClick={() => setActiveTab("list")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>← Back to Estimates</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: "12px 0",
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

      {activeTab === "create" ? (
        /* CREATE ESTIMATE SCREEN */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", marginTop: "10px" }}>
          {/* Main Items Pane */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Customer Details Box */}
            <div className="reports-filter-card" style={{ padding: "16px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a", marginBottom: "12px" }}>
                Customer Information (Optional)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", position: "relative" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Mobile Number</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search or enter phone..."
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                  />
                  {showCustomerDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "60px",
                        left: 0,
                        width: "300px",
                        background: "#fff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        zIndex: 50,
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {customerSuggestions.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => selectCustomer(c)}
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                        >
                          <div style={{ fontWeight: 600, fontSize: "13px" }}>{c.name}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{c.phone || "No Phone"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Customer / Contractor Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Tax Type</label>
                  <select
                    className="input-field"
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as any)}
                    style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                  >
                    <option value="CGST_SGST">Intra-State (CGST + SGST)</option>
                    <option value="IGST">Inter-State (IGST)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product Search & Add */}
            <div className="reports-filter-card" style={{ padding: "16px", position: "relative" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a", marginBottom: "8px" }}>
                Add Products to Estimate
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="Search products by Name, Barcode, SKU, or Brand..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", fontSize: "14px" }}
              />

              {filteredProducts.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "85px",
                    left: "16px",
                    right: "16px",
                    background: "#fff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                    zIndex: 60,
                    maxHeight: "260px",
                    overflowY: "auto",
                  }}
                >
                  {filteredProducts.map((p) => {
                    const priceWithTax = p.mrp && p.mrp > 0 ? p.mrp : p.selling_price * (1 + (p.tax_rate || 0) / 100);
                    return (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        style={{
                          padding: "10px 14px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f1f5f9",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{p.name}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {p.brand ? `[${p.brand}] ` : ""}Stock: {p.stock_quantity} • HSN: {p.hsn_sac || "—"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#059669", fontSize: "14px" }}>
                            ₹{priceWithTax.toFixed(2)}
                          </div>
                          <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                            ₹{p.selling_price.toFixed(2)} + {p.tax_rate}% GST
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Table */}
            <div className="reports-section-card" style={{ marginTop: 0 }}>
              <div className="reports-section-header">
                <div>
                  <h4>Estimate Items ({cart.length})</h4>
                  <p>Quantities and prices to include in this quote</p>
                </div>
              </div>

              <div className="reports-table-wrapper">
                {cart.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛒</div>
                    No products added to this estimate yet. Search above to add items.
                  </div>
                ) : (
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th style={{ width: "35px" }}>#</th>
                        <th>Product Description</th>
                        <th style={{ width: "110px", textAlign: "center" }}>Unit / Type</th>
                        <th style={{ width: "90px", textAlign: "center" }}>Quantity</th>
                        <th style={{ width: "120px", textAlign: "right" }}>Rate (₹)</th>
                        <th style={{ width: "110px", textAlign: "right" }}>Tax (₹)</th>
                        <th style={{ width: "120px", textAlign: "right" }}>Total (₹)</th>
                        <th style={{ width: "45px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatedItems.map((ci, idx) => (
                        <tr key={`${ci.product.id}-${idx}`}>
                          <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>{idx + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{ci.product.name}</div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              HSN: {ci.product.hsn_sac || "—"} • GST: {ci.product.tax_rate}%
                              {ci.product.mrp ? ` • MRP: ₹${ci.product.mrp.toFixed(2)}` : ""}
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {ci.product.has_bulk === 1 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = [...cart];
                                  copy[idx].isBulk = !copy[idx].isBulk;
                                  setCart(copy);
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  cursor: "pointer",
                                  background: ci.isBulk ? "#eff6ff" : "#f8fafc",
                                  color: ci.isBulk ? "#2563eb" : "#475569",
                                  fontWeight: 600,
                                }}
                              >
                                {ci.isBulk ? ci.product.bulk_unit || "Bulk" : "Loose"}
                              </button>
                            ) : (
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Base</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={ci.quantity}
                              onChange={(e) => updateQuantity(idx, e.target.value)}
                              style={{
                                width: "65px",
                                textAlign: "center",
                                padding: "4px 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontWeight: 700,
                              }}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end" }}>
                              <span style={{ fontSize: "12px", color: "#64748b", marginRight: "3px" }}>₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={cart[idx].customRate !== undefined ? cart[idx].customRate : ci.effectivePrice}
                                onChange={(e) => updateRate(idx, e.target.value)}
                                style={{
                                  width: "80px",
                                  textAlign: "right",
                                  padding: "4px 6px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  color: "#0f172a",
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ textAlign: "right", color: "#64748b", fontSize: "12px" }}>
                            ₹{ci.taxAmount.toFixed(2)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#059669" }}>
                            ₹{ci.lineTotal.toFixed(2)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="cart-delete-btn"
                              onClick={() => removeFromCart(idx)}
                              title="Remove item"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right Summary Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="reports-section-card" style={{ padding: "20px" }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#0f172a" }}>Estimate Summary</h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                  <span>Taxable Subtotal:</span>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>₹{subtotal.toFixed(2)}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                  <span>Total GST ({taxType === "CGST_SGST" ? "CGST+SGST" : "IGST"}):</span>
                  <span style={{ fontWeight: 600, color: "#0d9488" }}>₹{totalTax.toFixed(2)}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b" }}>Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDiscount(val === "" ? "" : Math.max(0, parseFloat(val) || 0));
                    }}
                    style={{
                      width: "80px",
                      textAlign: "right",
                      padding: "4px 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div style={{ height: "1px", background: "#e2e8f0", margin: "6px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Estimate Total:</span>
                  <span style={{ fontSize: "20px", fontWeight: 800, color: "#059669" }}>
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Estimate Terms / Remarks</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="e.g. Valid for 7 days. Subject to market price change."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", fontSize: "12px" }}
                />
              </div>

              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving || cart.length === 0}
                  onClick={handleSaveQuotation}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: 700,
                    justifyContent: "center",
                    backgroundColor: "#059669",
                    borderColor: "#059669",
                  }}
                >
                  {saving ? "Saving Estimate..." : "💾 Save & Print Estimate"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearCreateForm}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Clear Form
                </button>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  fontSize: "11px",
                  lineHeight: 1.4,
                }}
              >
                💡 <b>Note:</b> Estimates do not deduct items from inventory or record GST tax liabilities until converted into a final Tax Invoice.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LIST QUOTATIONS SCREEN */
        <div>
          {/* Filter Bar */}
          <div className="reports-filter-card" style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                className="input-field"
                placeholder="Search estimate # or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "260px", padding: "8px 12px" }}
              />

              <div style={{ display: "flex", gap: "6px" }}>
                {["ALL", "PENDING", "CONVERTED", "CANCELLED"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: statusFilter === st ? "#2563eb" : "#cbd5e1",
                      background: statusFilter === st ? "#eff6ff" : "#fff",
                      color: statusFilter === st ? "#1d4ed8" : "#475569",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {st === "ALL" ? "All Statuses" : st}
                  </button>
                ))}
              </div>

              <div style={{ marginLeft: "auto", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                Total: {filteredQuotes.length} Estimates
              </div>
            </div>
          </div>

          {/* Quotations Table */}
          <div className="reports-section-card">
            <div className="reports-table-wrapper">
              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  Loading estimates...
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
                  No estimates found. Click "Create New Estimate" to issue one!
                </div>
              ) : (
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th style={{ width: "120px" }}>Estimate #</th>
                      <th style={{ width: "110px" }}>Date</th>
                      <th>Customer</th>
                      <th style={{ width: "110px" }}>Status</th>
                      <th style={{ width: "130px", textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ width: "230px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map((q) => {
                      const isConverted = q.status === "CONVERTED";
                      return (
                        <tr
                          key={q.id}
                          onClick={() => handleOpenDetails(q.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <span style={{ fontWeight: 700, color: "#2563eb" }}>
                              {q.quotation_number}
                            </span>
                          </td>
                          <td style={{ color: "#475569", fontSize: "12px" }}>
                            {formatDate(q.quotation_date)}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>
                              {q.customer_name || "Walk-in Customer"}
                            </div>
                            {q.customer_phone && (
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                {q.customer_phone}
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background:
                                  q.status === "CONVERTED"
                                    ? "#dcfce7"
                                    : q.status === "CANCELLED"
                                    ? "#fee2e2"
                                    : "#fef3c7",
                                color:
                                  q.status === "CONVERTED"
                                    ? "#15803d"
                                    : q.status === "CANCELLED"
                                    ? "#b91c1c"
                                    : "#b45309",
                              }}
                            >
                              {q.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                            {formatCurrency(q.grand_total)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
                              {!isConverted && (
                                <button
                                  type="button"
                                  className="primary-button"
                                  style={{
                                    fontSize: "11px",
                                    padding: "4px 8px",
                                    backgroundColor: "#059669",
                                    borderColor: "#059669",
                                  }}
                                  onClick={async () => {
                                    const full = await getQuotationById(q.id);
                                    handleConvert(full);
                                  }}
                                  title="Convert to final Tax Invoice"
                                >
                                  ⚡ Convert to Bill
                                </button>
                              )}

                              <button
                                type="button"
                                className="secondary-button"
                                style={{ fontSize: "11px", padding: "4px 8px" }}
                                onClick={() => handlePrintFromList(q.id)}
                                title="Print Estimate PDF"
                              >
                                🖨️ Print
                              </button>

                              <button
                                type="button"
                                className="cart-delete-btn"
                                onClick={(e) => handleDeleteQuote(q.id, e)}
                                title="Delete Estimate"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW ESTIMATE DETAILS MODAL */}
      {showDetailsModal && selectedQuote && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: "720px", width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Estimate Details: {selectedQuote.quotation.quotation_number}</h3>
                <p>Created on {formatDate(selectedQuote.quotation.quotation_date)}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowDetailsModal(false)}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {/* Customer Box */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <div style={{ color: "#64748b", fontSize: "11px", fontWeight: 700 }}>CUSTOMER</div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                    {selectedQuote.quotation.customer_name || "Walk-in Customer"}
                  </div>
                  {selectedQuote.quotation.customer_phone && (
                    <div style={{ color: "#64748b" }}>Phone: {selectedQuote.quotation.customer_phone}</div>
                  )}
                  {selectedQuote.quotation.customer_address && (
                    <div style={{ color: "#64748b" }}>{selectedQuote.quotation.customer_address}</div>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#64748b", fontSize: "11px", fontWeight: 700 }}>STATUS</div>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "4px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background:
                        selectedQuote.quotation.status === "CONVERTED" ? "#dcfce7" : "#fef3c7",
                      color:
                        selectedQuote.quotation.status === "CONVERTED" ? "#15803d" : "#b45309",
                    }}
                  >
                    {selectedQuote.quotation.status}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <table className="reports-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: "35px" }}>#</th>
                    <th>Product</th>
                    <th style={{ width: "80px", textAlign: "center" }}>Qty</th>
                    <th style={{ width: "100px", textAlign: "right" }}>Rate (₹)</th>
                    <th style={{ width: "110px", textAlign: "right" }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQuote.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "#94a3b8" }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          HSN: {item.hsn_sac || "—"} • GST: {item.tax_rate}%
                        </div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ textAlign: "right" }}>₹{item.unit_price.toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>₹{item.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Calculation */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Taxable Subtotal:</span>
                  <span>₹{selectedQuote.quotation.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>GST Tax:</span>
                  <span>₹{selectedQuote.quotation.tax_amount.toFixed(2)}</span>
                </div>
                {selectedQuote.quotation.discount_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                    <span>Discount:</span>
                    <span>-₹{selectedQuote.quotation.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 800,
                    fontSize: "16px",
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: "6px",
                  }}
                >
                  <span>Grand Total:</span>
                  <span style={{ color: "#059669" }}>
                    ₹{selectedQuote.quotation.grand_total.toFixed(2)}
                  </span>
                </div>
              </div>

              {selectedQuote.quotation.notes && (
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#475569" }}>
                  <b>Notes:</b> {selectedQuote.quotation.notes}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPrintQuote(selectedQuote);
                  setShowDetailsModal(false);
                }}
              >
                🖨️ Print Estimate
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                {selectedQuote.quotation.status !== "CONVERTED" && (
                  <button
                    type="button"
                    className="primary-button"
                    style={{ backgroundColor: "#059669", borderColor: "#059669" }}
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleConvert(selectedQuote);
                    }}
                  >
                    ⚡ Convert to Tax Invoice
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* PRINT TEMPLATE FOR QUOTATION */}
      {printQuote && (
        <div
          className={`print-invoice ${
            printQuote.items.length <= 14
              ? "print-single-page"
              : "print-multi-page"
          }`}
        >
          {/* Header Grid matching Tax Invoice style */}
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
                <span>ESTIMATE / QUOTATION</span>
                <span style={{ fontSize: "10px", color: "#555" }}>
                  NON-TAX BILL
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
                      <b>Estimate No:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {printQuote.quotation.quotation_number}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Date:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {new Date(
                        printQuote.quotation.created_at.replace(" ", "T") + "Z",
                      ).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Validity:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>7 Days</td>
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
            {printQuote.quotation.customer_name ? (
              <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                <strong>{printQuote.quotation.customer_name}</strong>
                {printQuote.quotation.customer_address && (
                  <div>{printQuote.quotation.customer_address}</div>
                )}
                <div>
                  <b>Phone:</b> {printQuote.quotation.customer_phone || "-"}
                </div>
                {printQuote.quotation.customer_gstin && (
                  <div>
                    <b>GSTIN:</b> {printQuote.quotation.customer_gstin}
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
                <th style={{ width: "35px" }}>Sl No.</th>
                <th>Description of Goods</th>
                <th style={{ width: "80px" }}>HSN/SAC</th>
                <th style={{ width: "65px", textAlign: "center" }}>Qty</th>
                <th style={{ width: "75px", textAlign: "right" }}>Rate</th>
                <th style={{ width: "85px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {printQuote.items.map((item, index) => {
                return (
                  <tr key={`${item.product_id}-${index}`}>
                    <td style={{ padding: "4px" }}>{index + 1}</td>
                    <td style={{ padding: "4px" }}>{item.product_name}</td>
                    <td style={{ padding: "4px" }}>{item.hsn_sac || "-"}</td>
                    <td style={{ padding: "4px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {item.quantity}{" "}
                      {item.is_bulk === 1 && item.bulk_unit
                        ? `(${item.bulk_unit})`
                        : item.unit_symbol
                          ? `(${item.unit_symbol})`
                          : ""}
                    </td>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      ₹{item.unit_price.toFixed(2)}
                    </td>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      ₹{item.line_total.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="print-spacer" />

          <div className="print-footer-container">
            {printQuote.quotation.tax_amount > 0 && (
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
                      {printQuote.quotation.tax_type === "CGST_SGST" ? (
                        <>
                          <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                            CGST Amt
                          </th>
                          <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                            SGST Amt
                          </th>
                        </>
                      ) : (
                        <th style={{ border: "1px solid #ddd", padding: "4px" }}>
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
                      printQuote.items.reduce(
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
                          <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                            {hsn}
                          </td>
                          <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                            ₹{data.taxable.toFixed(2)}
                          </td>
                          {printQuote.quotation.tax_type === "CGST_SGST" ? (
                            <>
                              <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                                ₹{taxHalf.toFixed(2)}
                              </td>
                              <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                                ₹{taxHalf.toFixed(2)}
                              </td>
                            </>
                          ) : (
                            <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                              ₹{data.taxAmount.toFixed(2)}
                            </td>
                          )}
                          <td style={{ border: "1px solid #ddd", padding: "4px" }}>
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
              className="print-footer-bottom"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "12px",
              }}
            >
              <div style={{ flex: "1", paddingRight: "20px" }}>
                <div style={{ marginBottom: "15px", fontSize: "12px" }}>
                  <b>Total Amount (in words):</b>
                  <br />
                  {numberToWords(printQuote.quotation.grand_total)}
                </div>

                {printQuote.quotation.notes && (
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#333" }}>
                    <b>Estimate Terms:</b> {printQuote.quotation.notes}
                  </div>
                )}
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
                        ₹{printQuote.quotation.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    {printQuote.quotation.discount_amount > 0 && (
                      <tr>
                        <td style={{ padding: "4px 0" }}>Discount:</td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "4px 0",
                            color: "red",
                          }}
                        >
                          - ₹{printQuote.quotation.discount_amount.toFixed(2)}
                        </td>
                      </tr>
                    )}
                    {/* Tax Breakdown Rows */}
                    {(() => {
                      const taxByRate: Record<number, number> = {};
                      printQuote.items.forEach((item) => {
                        const rate = Number(item.tax_rate) || 0;
                        if (rate > 0) {
                          taxByRate[rate] = (taxByRate[rate] || 0) + item.tax_amount;
                        }
                      });

                      const sortedRates = Object.keys(taxByRate)
                        .map(Number)
                        .sort((a, b) => a - b);

                      if (sortedRates.length === 0 && printQuote.quotation.tax_amount > 0) {
                        return (
                          <tr>
                            <td style={{ padding: "4px 0" }}>Total Tax:</td>
                            <td style={{ textAlign: "right", padding: "4px 0" }}>
                              ₹{printQuote.quotation.tax_amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      }

                      return sortedRates.map((rate) => {
                        const totalTaxForRate = taxByRate[rate];
                        if (printQuote.quotation.tax_type === "CGST_SGST") {
                          const halfRate = rate / 2;
                          const halfTax = totalTaxForRate / 2;
                          return (
                            <React.Fragment key={rate}>
                              <tr>
                                <td style={{ padding: "3px 0", color: "#475569" }}>
                                  CGST ({halfRate}%):
                                </td>
                                <td style={{ textAlign: "right", padding: "3px 0" }}>
                                  ₹{halfTax.toFixed(2)}
                                </td>
                              </tr>
                              <tr>
                                <td style={{ padding: "3px 0", color: "#475569" }}>
                                  SGST ({halfRate}%):
                                </td>
                                <td style={{ textAlign: "right", padding: "3px 0" }}>
                                  ₹{halfTax.toFixed(2)}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        } else {
                          return (
                            <tr key={rate}>
                              <td style={{ padding: "3px 0", color: "#475569" }}>
                                IGST ({rate}%):
                              </td>
                              <td style={{ textAlign: "right", padding: "3px 0" }}>
                                ₹{totalTaxForRate.toFixed(2)}
                              </td>
                            </tr>
                          );
                        }
                      });
                    })()}
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
                        ₹{printQuote.quotation.grand_total.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div
                  style={{
                    textAlign: "right",
                    marginTop: "30px",
                    fontSize: "12px",
                  }}
                >
                  <p style={{ margin: "0 0 40px 0" }}>
                    For <b>NILGIRI PUMPS AND FITTINGS</b>
                  </p>
                  <div
                    style={{
                      borderTop: "1px solid #000",
                      width: "150px",
                      display: "inline-block",
                      paddingTop: "5px",
                    }}
                  >
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "15px", fontSize: "10px", color: "#555", textAlign: "center" }}>
              <b>*** THIS IS A PRICE ESTIMATE / QUOTATION AND NOT A TAX INVOICE ***</b>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
