import React, { useEffect, useState, useMemo } from "react";
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
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

interface QuotationDraft {
  activeTab: "list" | "create";
  cart: CartItem[];
  discount: number | "";
  notes: string;
  taxType: "CGST_SGST" | "IGST";
  phone: string;
  customerName: string;
  address: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  selectedCustomerId: number | null;
}

const QUOTATION_DRAFT_KEY = "quotation_draft";

function getInitialQuotationDraft(): QuotationDraft | null {
  try {
    const saved = localStorage.getItem(QUOTATION_DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load quotation draft:", e);
  }
  return null;
}

function saveQuotationDraft(draft: QuotationDraft) {
  try {
    const hasContent =
      (draft.cart && draft.cart.length > 0) ||
      draft.customerName?.trim() ||
      draft.phone?.trim() ||
      draft.notes?.trim() ||
      (typeof draft.discount === "number" && draft.discount > 0);

    if (hasContent || draft.activeTab === "create") {
      localStorage.setItem(QUOTATION_DRAFT_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(QUOTATION_DRAFT_KEY);
    }
  } catch (e) {
    console.error("Failed to save quotation draft:", e);
  }
}

function clearQuotationDraft() {
  try {
    localStorage.removeItem(QUOTATION_DRAFT_KEY);
  } catch (e) {
    console.error("Failed to clear quotation draft:", e);
  }
}

export default function QuotationsPage({ onConvertToBill }: QuotationsPageProps) {
  const initialDraft = useMemo(() => getInitialQuotationDraft(), []);

  const [activeTab, setActiveTab] = useState<"list" | "create">(() => {
    return initialDraft?.activeTab || "list";
  });
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create Mode States
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [editingQuotationNumber, setEditingQuotationNumber] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => initialDraft?.cart || []);
  const [productSearch, setProductSearch] = useState("");
  const [searchBrand, setSearchBrand] = useState("");
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [discount, setDiscount] = useState<number | "">(() => initialDraft?.discount ?? 0);
  const [notes, setNotes] = useState(() => initialDraft?.notes || "");
  const [taxType, setTaxType] = useState<"CGST_SGST" | "IGST">(() => initialDraft?.taxType || "CGST_SGST");
  const [saving, setSaving] = useState(false);

  // Customer states
  const [phone, setPhone] = useState(() => initialDraft?.phone || "");
  const [customerName, setCustomerName] = useState(() => initialDraft?.customerName || "");
  const [address, setAddress] = useState(() => initialDraft?.address || "");
  const [gstin, setGstin] = useState(() => initialDraft?.gstin || "");
  const [stateName, setStateName] = useState(() => initialDraft?.stateName || "Tamil Nadu");
  const [stateCode, setStateCode] = useState(() => initialDraft?.stateCode || "33");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(() => initialDraft?.selectedCustomerId ?? null);
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

  // Sync draft to localStorage so state is preserved when switching pages
  useEffect(() => {
    saveQuotationDraft({
      activeTab,
      cart,
      discount,
      notes,
      taxType,
      phone,
      customerName,
      address,
      gstin,
      stateName,
      stateCode,
      selectedCustomerId,
    });
  }, [
    activeTab,
    cart,
    discount,
    notes,
    taxType,
    phone,
    customerName,
    address,
    gstin,
    stateName,
    stateCode,
    selectedCustomerId,
  ]);

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

  const brandDropdownOptions = useMemo(() => {
    const brands = new Set<string>();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) {
        brands.add(p.brand.trim());
      }
    });
    const allBrands = Array.from(brands).sort();
    const query = searchBrand.trim().toLowerCase();
    if (!query) return allBrands;
    return allBrands.filter((b) => b.toLowerCase().includes(query));
  }, [products, searchBrand]);

  // Filtered products for dropdown search using multi-token space-insensitive matching
  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    const brandQ = searchBrand.trim().toLowerCase();

    if (!search && !brandQ) return [];

    return products
      .filter((product) => {
        const matchesBrand = brandQ
          ? (product.brand ?? "").toLowerCase().includes(brandQ)
          : true;

        if (!matchesBrand) return false;
        if (!search) return true;

        return search.split(/\s+/).every((token) => {
          const cleanedToken = token.replace(/\s+/g, "");
          const cleanedName = product.name.toLowerCase().replace(/\s+/g, "");
          const cleanedHsn = (product.hsn_sac ?? "").toLowerCase().replace(/\s+/g, "");
          const cleanedBarcode = (product.barcode ?? "").toLowerCase().replace(/\s+/g, "");
          const cleanedSku = (product.sku ?? "").toLowerCase().replace(/\s+/g, "");
          const cleanedBrand = (product.brand ?? "").toLowerCase().replace(/\s+/g, "");

          return (
            cleanedName.includes(cleanedToken) ||
            cleanedBarcode.includes(cleanedToken) ||
            cleanedHsn.includes(cleanedToken) ||
            cleanedSku.includes(cleanedToken) ||
            cleanedBrand.includes(cleanedToken)
          );
        });
      })
      .slice(0, 15);
  }, [products, productSearch, searchBrand]);

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
    setProductSearch("");
    setSearchBrand("");
    setPhone("");
    setCustomerName("");
    setAddress("");
    setGstin("");
    setSelectedCustomerId(null);
    setDiscount(0);
    setNotes("");
    setTaxType("CGST_SGST");
    setEditingQuotationId(null);
    setEditingQuotationNumber("");
    clearQuotationDraft();
  }

  async function handleEditQuotation(quotationId: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    try {
      setLoading(true);
      const { quotation, items } = await getQuotationById(quotationId);

      // Check if quotation is already converted
      if (quotation.status === "CONVERTED") {
        alert("This quotation has already been converted to a Tax Invoice and cannot be edited.");
        return;
      }

      setEditingQuotationId(quotation.id);
      setEditingQuotationNumber(quotation.quotation_number);

      // Customer fields
      setSelectedCustomerId(quotation.customer_id);
      setPhone(quotation.customer_phone || "");
      setCustomerName(quotation.customer_name || "");
      setAddress(quotation.customer_address || "");
      setGstin(quotation.customer_gstin || "");
      setDiscount(quotation.discount_amount || 0);
      setNotes(quotation.notes || "");
      setTaxType(quotation.tax_type || "CGST_SGST");

      // Load products for cart matching
      const allProducts = await getProducts();
      const newCart: CartItem[] = items.map((item) => {
        const prod = allProducts.find((p) => p.id === item.product_id);
        const isBulk = item.is_bulk === 1;

        if (prod) {
          // If the unit_price matches the standard pricing for that packaging mode, do not freeze as customRate
          const standardBulkPrice =
            prod.bulk_price && prod.bulk_price > 0
              ? prod.bulk_price
              : prod.selling_price * (prod.bulk_conversion_rate || 1);
          const standardPrice = isBulk ? standardBulkPrice : prod.selling_price;
          const isCustom = Math.abs(item.unit_price - standardPrice) > 0.001;

          return {
            product: prod,
            quantity: item.quantity,
            isBulk,
            customRate: isCustom ? item.unit_price : undefined,
          };
        }

        // Fallback product structure if product was modified or deactivated
        const fallbackProd: Product = {
          id: item.product_id,
          name: item.product_name,
          selling_price: item.unit_price,
          purchase_price: item.cost_price || 0,
          wholesale_price: item.unit_price,
          average_cost: item.cost_price || 0,
          mrp: item.unit_price,
          stock_quantity: 999,
          minimum_stock: 0,
          tax_rate: item.tax_rate || 0,
          barcode: null,
          sku: item.sku || null,
          brand: item.brand || null,
          hsn_sac: item.hsn_sac || null,
          category_id: null,
          category_name: null,
          unit_id: null,
          unit_name: null,
          unit_symbol: item.unit_symbol || null,
          uom: null,
          has_bulk: isBulk ? 1 : 0,
          bulk_unit: item.bulk_unit || null,
          bulk_conversion_rate: item.bulk_multiplier || 1,
          bulk_price: isBulk ? item.unit_price : null,
          is_active: 1,
          created_at: "",
          updated_at: "",
        };

        return {
          product: fallbackProd,
          quantity: item.quantity,
          isBulk,
          customRate: item.unit_price,
        };
      });

      setCart(newCart);
      setShowDetailsModal(false);
      setActiveTab("create");
    } catch (err: any) {
      console.error("Failed to load quotation for editing:", err);
      alert("Error loading quotation for editing: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
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

      let savedId: number;
      if (editingQuotationId) {
        await updateQuotation(editingQuotationId, {
          customer_id: custId,
          subtotal,
          tax_amount: totalTax,
          discount_amount: numDiscount,
          grand_total: grandTotal,
          notes: notes.trim() || null,
          tax_type: taxType,
          items: quoteItems,
        });
        savedId = editingQuotationId;
      } else {
        savedId = await createQuotation({
          customer_id: custId,
          subtotal,
          tax_amount: totalTax,
          discount_amount: numDiscount,
          grand_total: grandTotal,
          notes: notes.trim() || null,
          tax_type: taxType,
          items: quoteItems,
        });
      }

      const fullQuote = await getQuotationById(savedId);
      clearCreateForm();
      setActiveTab("list");
      await loadQuotationsList();
      setPrintQuote(fullQuote);
    } catch (err: any) {
      console.error("Failed to save quotation:", err);
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
              onClick={() => {
                clearCreateForm();
                setActiveTab("create");
              }}
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
              onClick={() => {
                clearCreateForm();
                setActiveTab("list");
              }}
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
        /* CREATE / EDIT ESTIMATE SCREEN */
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
          {editingQuotationId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                color: "#1e40af",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>✏️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>
                    Updating Quotation: {editingQuotationNumber}
                  </div>
                  <div style={{ fontSize: "12px", color: "#3b82f6" }}>
                    Modifying items, rates, customer details, or terms will update this existing estimate.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "12px", padding: "4px 10px", borderColor: "#93c5fd", background: "#fff" }}
                onClick={clearCreateForm}
              >
                Cancel Edit (Switch to New)
              </button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
          {/* Main Items Pane */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Customer Details Box */}
            <div className="reports-filter-card" style={{ padding: "16px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a", marginBottom: "4px" }}>
                Customer Information (Optional)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", position: "relative" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                    Mobile Number
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      className="customer-search-input-box"
                      placeholder="Search or enter phone..."
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                    />
                    {phone && (
                      <button
                        type="button"
                        onClick={() => handlePhoneChange("")}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: "2px",
                          lineHeight: 1,
                        }}
                        title="Clear phone"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {showCustomerDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        width: "320px",
                        marginTop: "6px",
                        background: "#fff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        boxShadow: "0 10px 20px -5px rgba(0,0,0,0.12)",
                        zIndex: 50,
                        maxHeight: "220px",
                        overflowY: "auto",
                      }}
                    >
                      {customerSuggestions.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => selectCustomer(c)}
                          style={{
                            padding: "9px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f1f5f9",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{c.name}</div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>{c.phone || "No Phone"}</div>
                          </div>
                          <span style={{ fontSize: "10px", color: "#2563eb", fontWeight: 600 }}>Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                    Customer / Contractor Name
                  </label>
                  <input
                    type="text"
                    className="customer-search-input-box"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                    Tax Type
                  </label>
                  <select
                    className="customer-search-input-box"
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as any)}
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

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {/* Main Search Input */}
                <div className="billing-search-box" style={{ flex: 1 }}>
                  <span className="search-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search products by Name, Barcode, HSN, SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoFocus
                  />
                  {productSearch && (
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={() => setProductSearch("")}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Brand Filter Input */}
                <div className="billing-search-box" style={{ flex: "0 0 210px" }}>
                  <span className="search-icon">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Filter brand..."
                    value={searchBrand}
                    onChange={(e) => {
                      setSearchBrand(e.target.value);
                      setShowBrandDropdown(true);
                    }}
                    onFocus={() => setShowBrandDropdown(true)}
                    onBlur={() => setTimeout(() => setShowBrandDropdown(false), 200)}
                  />
                  {searchBrand && (
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={() => setSearchBrand("")}
                      title="Clear brand"
                    >
                      ✕
                    </button>
                  )}

                  {showBrandDropdown && brandDropdownOptions.length > 0 && (
                    <div className="brand-dropdown-menu">
                      {brandDropdownOptions.map((brand, idx) => (
                        <div
                          key={idx}
                          className="brand-dropdown-item"
                          onMouseDown={() => {
                            setSearchBrand(brand);
                            setShowBrandDropdown(false);
                          }}
                        >
                          <span>{brand}</span>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {filteredProducts.map((p) => {
                    const priceWithTax = p.mrp && p.mrp > 0 ? p.mrp : p.selling_price * (1 + (p.tax_rate || 0) / 100);
                    const isAdded = cart.some((c) => c.product.id === p.id);
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
                          gap: "12px",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{p.name}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {p.brand ? `[${p.brand}] ` : ""}Stock: {p.stock_quantity} • HSN: {p.hsn_sac || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, color: "#059669", fontSize: "14px" }}>
                              ₹{priceWithTax.toFixed(2)}
                            </div>
                            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                              ₹{p.selling_price.toFixed(2)} + {p.tax_rate}% GST
                            </div>
                          </div>

                          {isAdded && (
                            <span
                              style={{
                                backgroundColor: "#dcfce7",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              ✓ Added
                            </span>
                          )}

                          <button
                            type="button"
                            className="add-item-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(p);
                            }}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#2563eb",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            + Add
                          </button>
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
                                  const newIsBulk = !copy[idx].isBulk;
                                  copy[idx].isBulk = newIsBulk;
                                  // Clear customRate so rate recalculates dynamically to the selected unit's price
                                  delete copy[idx].customRate;
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
                                title="Click to toggle Loose / Bulk unit"
                              >
                                {ci.isBulk
                                  ? ci.product.bulk_unit || "Bulk"
                                  : ci.product.unit_symbol || ci.product.unit_name || ci.product.uom || "Loose"}
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#475569",
                                  background: "#f1f5f9",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                  display: "inline-block",
                                }}
                              >
                                {ci.product.unit_symbol || ci.product.unit_name || ci.product.uom || "NOS"}
                              </span>
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
                    backgroundColor: editingQuotationId ? "#2563eb" : "#059669",
                    borderColor: editingQuotationId ? "#2563eb" : "#059669",
                  }}
                >
                  {saving
                    ? editingQuotationId
                      ? "Updating Estimate..."
                      : "Saving Estimate..."
                    : editingQuotationId
                    ? "💾 Update & Print Estimate"
                    : "💾 Save & Print Estimate"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearCreateForm}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {editingQuotationId ? "Cancel Edit" : "Clear Form"}
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
        </div>
      ) : (
        /* LIST QUOTATIONS SCREEN */
        <div>
          {/* Filter Bar */}
          <div className="reports-filter-card" style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <div className="invoices-search-box" style={{ width: "300px" }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search estimate # or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => setSearchQuery("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

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

                              {!isConverted && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{
                                    fontSize: "11px",
                                    padding: "4px 8px",
                                    color: "#2563eb",
                                    borderColor: "#bfdbfe",
                                    backgroundColor: "#eff6ff",
                                  }}
                                  onClick={(e) => handleEditQuotation(q.id, e)}
                                  title="Edit / Redo this quotation"
                                >
                                  ✏️ Edit
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
                      <td style={{ textAlign: "center", fontWeight: 600 }}>
                        {item.quantity}{" "}
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                          {item.is_bulk === 1 && item.bulk_unit
                            ? item.bulk_unit
                            : item.unit_symbol || "NOS"}
                        </span>
                      </td>
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
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ color: "#2563eb", borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }}
                      onClick={() => handleEditQuotation(selectedQuote.quotation.id)}
                    >
                      ✏️ Edit Estimate
                    </button>
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
                  </>
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
            printQuote.items.length <= 10 ? "print-bottom-pinned" : ""
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
                style={{ marginTop: "5px", fontSize: "10px" }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #ccc",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                        HSN/SAC
                      </th>
                      <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                        Taxable Value
                      </th>
                      {printQuote.quotation.tax_type === "CGST_SGST" ? (
                        <>
                          <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                            CGST Amt
                          </th>
                          <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                            SGST Amt
                          </th>
                        </>
                      ) : (
                        <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                          IGST Amt
                        </th>
                      )}
                      <th style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
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
                          <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                            {hsn}
                          </td>
                          <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                            ₹{data.taxable.toFixed(2)}
                          </td>
                          {printQuote.quotation.tax_type === "CGST_SGST" ? (
                            <>
                              <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                                ₹{taxHalf.toFixed(2)}
                              </td>
                              <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                                ₹{taxHalf.toFixed(2)}
                              </td>
                            </>
                          ) : (
                            <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                              ₹{data.taxAmount.toFixed(2)}
                            </td>
                          )}
                          <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
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
                marginTop: "6px",
              }}
            >
              <div style={{ flex: "1", paddingRight: "16px" }}>
                <div style={{ marginBottom: "6px", fontSize: "10.5px" }}>
                  <b>Total Amount (in words):</b>
                  <br />
                  {numberToWords(printQuote.quotation.grand_total)}
                </div>

                {printQuote.quotation.notes && (
                  <div style={{ marginTop: "6px", fontSize: "10px", color: "#333" }}>
                    <b>Estimate Terms:</b> {printQuote.quotation.notes}
                  </div>
                )}
              </div>

              <div style={{ width: "270px" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "11px",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "2px 0" }}>Subtotal:</td>
                      <td style={{ textAlign: "right", padding: "2px 0" }}>
                        ₹{printQuote.quotation.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    {printQuote.quotation.discount_amount > 0 && (
                      <tr>
                        <td style={{ padding: "2px 0" }}>Discount:</td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "2px 0",
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
                            <td style={{ padding: "2px 0" }}>Total Tax:</td>
                            <td style={{ textAlign: "right", padding: "2px 0" }}>
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
                                <td style={{ padding: "2px 0", color: "#475569" }}>
                                  CGST ({halfRate}%):
                                </td>
                                <td style={{ textAlign: "right", padding: "2px 0" }}>
                                  ₹{halfTax.toFixed(2)}
                                </td>
                              </tr>
                              <tr>
                                <td style={{ padding: "2px 0", color: "#475569" }}>
                                  SGST ({halfRate}%):
                                </td>
                                <td style={{ textAlign: "right", padding: "2px 0" }}>
                                  ₹{halfTax.toFixed(2)}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        } else {
                          return (
                            <tr key={rate}>
                              <td style={{ padding: "2px 0", color: "#475569" }}>
                                IGST ({rate}%):
                              </td>
                              <td style={{ textAlign: "right", padding: "2px 0" }}>
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
                          padding: "3px 0",
                          fontWeight: "bold",
                          fontSize: "12px",
                          borderTop: "1px solid #ccc",
                          borderBottom: "1px solid #ccc",
                        }}
                      >
                        Grand Total:
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "3px 0",
                          fontWeight: "bold",
                          fontSize: "12px",
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
                    marginTop: "10px",
                    fontSize: "10px",
                  }}
                >
                  <p style={{ margin: "0 0 14px 0" }}>
                    For <b>NILGIRI PUMPS AND FITTINGS</b>
                  </p>
                  <div
                    style={{
                      borderTop: "1px solid #000",
                      width: "150px",
                      display: "inline-block",
                      paddingTop: "3px",
                    }}
                  >
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </div>

            <div
              className="print-declaration"
              style={{ marginTop: "5px", fontSize: "9.5px", color: "#555", textAlign: "center" }}
            >
              <b>*** THIS IS A PRICE ESTIMATE / QUOTATION AND NOT A TAX INVOICE ***</b>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
