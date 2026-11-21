import { useEffect, useMemo, useState, useRef } from "react";
import { getProducts, type Product } from "../../database/product";
import {
  createPurchase,
  updatePurchase,
  getPurchaseById,
} from "../../database/purchase";
import {
  getSuppliers,
  createSupplier,
  type Supplier,
} from "../../database/supplier";
import AddProductModal from "../products/AddProductModal";
import { numberToWords } from "../../utils/numberToWords";
import { formatDbUtcToLocalDate } from "../../database/dateUtils";

type CartItem = {
  product: Product;
  quantity: number | "";
  unitPrice: number | "";
  isBulk: boolean;
  newMRP?: number | "";
  newBulkMRP?: number | null | "";
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function PurchasesPage({
  redoPurchaseId,
  onClearRedo,
}: {
  redoPurchaseId?: number | null;
  onClearRedo?: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBrand, setSearchBrand] = useState("");
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  // Supplier state
  const today = new Date().toISOString().split("T")[0];
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [billNumber, setBillNumber] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierGstin, setNewSupplierGstin] = useState("");
  const [registeringSupplier, setRegisteringSupplier] = useState(false);

  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const isReadyToSave = useRef(false);

  // Sync cart to local storage when not editing past purchase
  useEffect(() => {
    if (!redoPurchaseId) {
      if (!isReadyToSave.current) return;
      if (cart.length > 0) {
        localStorage.setItem("purchases_cart", JSON.stringify(cart));
      } else {
        localStorage.removeItem("purchases_cart");
      }
    }
  }, [cart, redoPurchaseId]);

  useEffect(() => {
    if (!redoPurchaseId) {
      const savedCart = localStorage.getItem("purchases_cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {}
      }
      setTimeout(() => {
        isReadyToSave.current = true;
      }, 100);
    }
  }, []);

  useEffect(() => {
    loadData().then(() => {
      if (redoPurchaseId) {
        loadPurchaseForRedo(redoPurchaseId);
      }
    });
  }, [redoPurchaseId]);

  async function loadPurchaseForRedo(purchaseId: number) {
    try {
      setLoading(true);
      const { purchase, items } = await getPurchaseById(purchaseId);

      setSupplierId(purchase.supplier_id);
      setBillNumber(purchase.bill_number || "");
      if (purchase.purchase_date) {
        setPurchaseDate(formatDbUtcToLocalDate(purchase.purchase_date));
      }
      setDiscount(purchase.discount_amount);
      setPaymentMethod(purchase.payment_method);

      const allProducts = await getProducts();
      const newCart: CartItem[] = items.map((item) => {
        const prod = allProducts.find((p) => p.id === item.product_id);
        if (!prod) throw new Error("Product not found");
        return {
          product: prod,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          isBulk: false,
          newMRP: prod.mrp,
          newBulkMRP:
            prod.bulk_price !== null
              ? prod.bulk_price * (1 + prod.tax_rate / 100)
              : null,
        };
      });
      setCart(newCart);
    } catch (e) {
      console.error("Failed to load purchase for redo", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [productData, supplierData] = await Promise.all([
        getProducts(),
        getSuppliers(),
      ]);

      setProducts(productData);
      setSuppliers(supplierData);
    } catch (error) {
      console.error("Failed to load purchase data:", error);
      setError("Failed to load products or suppliers.");
    } finally {
      setLoading(false);
    }
  }

  // Selected supplier object
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId) || null;
  }, [suppliers, supplierId]);

  // Filtered suppliers for dropdown
  const supplierSearchResults = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          (s.gstin && s.gstin.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [suppliers, supplierSearch]);

  async function handleQuickCreateSupplier() {
    if (!newSupplierName.trim()) return;
    try {
      setRegisteringSupplier(true);
      await createSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || null,
        gstin: newSupplierGstin.trim() || null,
      });

      const updated = await getSuppliers();
      setSuppliers(updated);
      const created = updated.find(
        (s) => s.name.toLowerCase() === newSupplierName.trim().toLowerCase()
      );
      if (created) {
        setSupplierId(created.id);
      }
      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierGstin("");
      setSupplierSearch("");
      setShowSupplierDropdown(false);
      setShowNewSupplierForm(false);
    } catch (err) {
      console.error("Failed to register supplier:", err);
      setError("Failed to register supplier.");
    } finally {
      setRegisteringSupplier(false);
    }
  }

  // Derived unique brands for brand filter
  const brandDropdownOptions = useMemo(() => {
    const brandSet = new Set<string>();
    products.forEach((p) => {
      const b = p.brand;
      if (b && b.trim() !== "") {
        brandSet.add(b.trim());
      }
    });
    const uniqueBrands = Array.from(brandSet);
    const q = searchBrand.trim().toLowerCase();
    return uniqueBrands.filter((b) => b.toLowerCase().includes(q)).sort();
  }, [products, searchBrand]);

  // Product search results
  const searchResults = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const brandQ = searchBrand.trim().toLowerCase();

    if (!search && !brandQ) {
      return [];
    }

    return products
      .filter((product) => {
        // 1. Brand filter
        if (brandQ) {
          const pBrand = (product.brand || "").toLowerCase();
          if (!pBrand.includes(brandQ)) return false;
        }

        // 2. Search query filter
        if (!search) return true;
        return search.split(/\s+/).every((token) => {
          const cleanedToken = token.replace(/\s+/g, "");
          const cleanedName = product.name.toLowerCase().replace(/\s+/g, "");
          const cleanedHsn = (product.hsn_sac ?? "").toLowerCase().replace(/\s+/g, "");
          const cleanedBarcode = (product.barcode ?? "").toLowerCase().replace(/\s+/g, "");
          return (
            cleanedName.includes(cleanedToken) ||
            cleanedBarcode.includes(cleanedToken) ||
            cleanedHsn.includes(cleanedToken)
          );
        });
      })
      .slice(0, 10);
  }, [products, searchTerm, searchBrand]);

  function addToCart(product: Product) {
    setCart((previous) => {
      const existing = previous.find((item) => item.product.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: (Number(item.quantity) || 0) + 1,
              }
            : item,
        );
      }

      return [
        ...previous,
        {
          product,
          quantity: 1,
          unitPrice:
            product.purchase_price > 0
              ? product.purchase_price
              : product.average_cost,
          isBulk: false,
          newMRP: product.mrp,
          newBulkMRP:
            product.bulk_price !== null
              ? product.bulk_price * (1 + product.tax_rate / 100)
              : null,
        },
      ];
    });

    setSearchTerm("");
  }

  function updateItemUnit(productId: number, newIsBulk: boolean) {
    setCart((previous) =>
      previous.map((item) => {
        if (item.product.id === productId) {
          const oldRate = item.isBulk
            ? item.product.bulk_conversion_rate || 1
            : 1;
          const newRate = newIsBulk
            ? item.product.bulk_conversion_rate || 1
            : 1;

          // Switch the price cleanly by normalizing to base and multiplying to new
          const safePrice = Number(item.unitPrice) || 0;
          const basePrice = item.isBulk ? safePrice / oldRate : safePrice;
          const newPrice = newIsBulk ? basePrice * newRate : basePrice;

          return {
            ...item,
            isBulk: newIsBulk,
            unitPrice: newPrice,
          };
        }
        return item;
      }),
    );
  }

  function updateQuantity(productId: number, val: string) {
    let quantity: number | "" = "";
    if (val !== "") {
      const parsed = Number(val);
      quantity = isNaN(parsed) ? "" : parsed;
    }

    setCart((previous) =>
      previous.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
            }
          : item,
      ),
    );
  }

  function updatePrice(productId: number, val: string, isBulk: boolean = false) {
    const price = val === "" ? "" : Number(val);
    setCart((previous) =>
      previous.map((item) => {
        if (item.product.id !== productId) return item;
        const rate = item.product.has_bulk === 1
          ? (item.product.bulk_conversion_rate || 1)
          : 1;

        if (price === "") {
          return { ...item, unitPrice: "" };
        }

        const safePrice = Math.max(0, price as number);
        // If editing the bulk box, set unitPrice depending on whether the cart item row itself is currently bulk or base
        if (isBulk) {
          const calculatedBasePrice = safePrice / rate;
          const newUnitPrice = item.isBulk ? safePrice : calculatedBasePrice;
          return { ...item, unitPrice: newUnitPrice };
        } else {
          const calculatedBulkPrice = safePrice * rate;
          const newUnitPrice = item.isBulk ? calculatedBulkPrice : safePrice;
          return { ...item, unitPrice: newUnitPrice };
        }
      }),
    );
  }

  function updateSellingPrice(productId: number, val: string, isBulk: boolean) {
    const price = val === "" ? "" : Number(val);
    setCart((previous) =>
      previous.map((item) => {
        if (item.product.id !== productId) return item;
        if (isBulk) {
          return {
            ...item,
            newBulkMRP: price === "" ? "" : Math.max(0, price as number),
          };
        }
        return {
          ...item,
          newMRP: price === "" ? "" : Math.max(0, price as number),
        };
      }),
    );
  }

  function removeFromCart(productId: number) {
    setCart((previous) =>
      previous.filter((item) => item.product.id !== productId),
    );
  }

  const subtotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + (Number(item.unitPrice) || 0) * Number(item.quantity || 0),
      0,
    );
  }, [cart]);

  const taxAmount = useMemo(() => {
    return cart.reduce((total, item) => {
      const itemSubtotal =
        (Number(item.unitPrice) || 0) * Number(item.quantity || 0);
      const tax = itemSubtotal * (item.product.tax_rate / 100);
      return total + tax;
    }, 0);
  }, [cart]);

  const grandTotal = Math.max(0, subtotal + taxAmount - discount);

  async function handleSavePurchase() {
    if (cart.length === 0) {
      setError("Please add at least one product to the purchase.");
      return;
    }

    if (!supplierId) {
      setError("Please select a supplier for this purchase.");
      return;
    }

    const trimmedBill = billNumber.trim();
    if (!trimmedBill) {
      setError("Supplier Bill No. is compulsory. Please enter the bill number.");
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      setSaving(true);

      const items = cart.map((item) => {
        // Translate visual bulk into actual physical base stock for the system
        const multiplier = item.isBulk
          ? item.product.bulk_conversion_rate || 1
          : 1;
        const actualQuantity = Number(item.quantity || 0) * multiplier;
        const actualUnitPrice = (Number(item.unitPrice) || 0) / multiplier;

        const itemSubtotal = actualUnitPrice * actualQuantity;
        const itemTax = itemSubtotal * (item.product.tax_rate / 100);

        return {
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: actualQuantity,
          unit_price: actualUnitPrice,
          tax_rate: item.product.tax_rate,
          tax_amount: itemTax,
          discount_amount: 0,
          line_total: itemSubtotal + itemTax,
          new_mrp: item.newMRP === "" ? undefined : item.newMRP,
          new_bulk_mrp:
            item.newBulkMRP === "" ? undefined : (item.newBulkMRP ?? undefined),
        };
      });

      let purchaseNumber: string = "";

      if (redoPurchaseId) {
        await updatePurchase(redoPurchaseId, {
          bill_number: trimmedBill,
          purchase_date: purchaseDate,
          supplier_id: supplierId,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discount,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          items,
        });
      } else {
        const result = await createPurchase({
          bill_number: trimmedBill,
          purchase_date: purchaseDate,
          supplier_id: supplierId,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discount,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          items,
        });
        purchaseNumber = result.purchaseNumber;
      }

      setSuccessMessage(
        redoPurchaseId
          ? `Purchase successfully updated.`
          : `Purchase ${purchaseNumber} saved successfully.`,
      );

      setCart([]);
      setSupplierId(null);
      setBillNumber("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      setSupplierSearch("");
      setDiscount(0);
      setPaymentMethod("Cash");

      if (onClearRedo) onClearRedo();

      await loadData();
    } catch (error) {
      console.error("FAILED TO SAVE PURCHASE:", error);
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="purchases-page-container">
      {/* Redo Purchase Alert Banner */}
      {redoPurchaseId && (
        <div className="redo-bill-banner">
          <div>
            <div className="redo-title">
              ⚠️ Editing Purchase #{redoPurchaseId}
            </div>
            <div className="redo-sub">
              You are currently modifying a previously saved purchase. Saving will overwrite the record and readjust inventory.
            </div>
          </div>
          <button
            type="button"
            className="secondary-button"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            onClick={() => {
              if (onClearRedo) onClearRedo();
              setCart([]);
              setSupplierId(null);
            }}
          >
            ✕ Cancel & Clear
          </button>
        </div>
      )}

      {/* Header Row */}
      <div className="billing-header-row">
        <div>
          <h3>Purchases & Inward Stock</h3>
          <p>Record stock purchases, update supplier invoices, and adjust retail pricing.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="invoices-summary-badge">
            <span>📥</span>
            <span>
              {cart.length} {cart.length === 1 ? "Product" : "Products"} in Entry
            </span>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: "12px", color: "#ef4444", borderColor: "#fca5a5" }}
              onClick={() => setCart([])}
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="billing-layout-grid">
        {/* Left Column: Product Search & Purchase Cart */}
        <div className="billing-left-column">
          {/* Product Search Card */}
          <div className="billing-search-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Add Products to Inward
              </h4>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: "5px 10px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                onClick={() => setShowAddProduct(true)}
              >
                <span>+</span>
                <span>Create New Product</span>
              </button>
            </div>

            <div className="billing-search-inputs-grid">
              {/* Main Search Input */}
              <div className="billing-search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search product name, HSN code, or barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => setSearchTerm("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Brand Filter Box */}
              <div className="billing-search-box" style={{ flex: "0 0 200px" }}>
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
                        🏷️ {brand}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Instant Search Results Dropdown List */}
            {(searchTerm || searchBrand) && (
              <div className="billing-search-results-list">
                {loading ? (
                  <div style={{ padding: "14px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                    Searching products...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                    No matching products found. Click <b>"+ Create New Product"</b> above to add it to catalog.
                  </div>
                ) : (
                  searchResults.map((product) => (
                    <div key={product.id} className="billing-search-item">
                      <div className="billing-item-left">
                        <div className="billing-item-title">{product.name}</div>
                        <div className="billing-item-meta">
                          {product.hsn_sac && (
                            <span className="hsn-tag">HSN: {product.hsn_sac}</span>
                          )}
                          {product.brand && (
                            <span className="brand-tag">🏷️ {product.brand}</span>
                          )}
                          <span style={{ color: "#64748b" }}>
                            Stock: {product.stock_quantity} {product.unit_symbol || ""}
                          </span>
                        </div>
                      </div>

                      <div className="billing-item-right">
                        <div className="billing-item-pricing">
                          <div className="billing-item-price">
                            ₹{(product.purchase_price > 0 ? product.purchase_price : product.average_cost).toFixed(2)}
                          </div>
                          <span className="billing-item-tax-note">
                            Last Cost ({product.tax_rate}% GST)
                          </span>
                        </div>

                        <button
                          type="button"
                          className="add-item-btn"
                          onClick={() => addToCart(product)}
                        >
                          + Inward
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Purchased Items Table Card */}
          <div className="billing-cart-card">
            <div className="billing-cart-card-header">
              <h4>
                <span>Inward Items List</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#2563eb",
                    background: "#eff6ff",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {cart.length} {cart.length === 1 ? "Product" : "Products"}
                </span>
              </h4>

              {cart.length > 0 && (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                  onClick={() => setCart([])}
                >
                  Clear All
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart-state">
                <div className="empty-cart-icon">📥</div>
                <h5>Purchase entry is empty</h5>
                <p>Search products or scan barcodes above to record incoming inventory.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto", padding: "12px 16px 16px 16px" }}>
                <table className="billing-cart-table inward-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: "30px", textAlign: "center" }}>#</th>
                      <th>Product & Projected Stock</th>
                      <th style={{ width: "120px" }}>Unit / Pack</th>
                      <th style={{ width: "170px" }}>Purchase Rate</th>
                      <th style={{ width: "170px" }}>Update Sale MRP</th>
                      <th style={{ width: "90px", textAlign: "center" }}>Qty</th>
                      <th style={{ width: "110px", textAlign: "right" }}>Total</th>
                      <th style={{ width: "40px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, index) => {
                      const multiplier = item.isBulk
                        ? item.product.bulk_conversion_rate || 1
                        : 1;
                      const actualQuantityAdded =
                        Number(item.quantity || 0) * multiplier;
                      const safeUnitPrice = Number(item.unitPrice) || 0;
                      const basePurchasePrice = safeUnitPrice / multiplier;
                      const baseSalePriceVal =
                        item.newMRP === undefined
                          ? item.product.mrp
                          : item.newMRP;
                      const bulkSalePriceVal =
                        item.newBulkMRP === undefined
                          ? (item.product.bulk_price ?? 0) *
                            (1 + item.product.tax_rate / 100)
                          : (item.newBulkMRP ?? 0);

                      const lineTotal =
                        safeUnitPrice * Number(item.quantity || 0);

                      return (
                        <tr key={`${item.product.id}-${item.isBulk}`}>
                          <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                            {index + 1}
                          </td>

                          <td>
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "13px" }}>
                              {item.product.name}
                            </div>
                            <div className="stock-projection-pill">
                              <span>Stock: {item.product.stock_quantity ?? 0} {item.product.unit_symbol || ""}</span>
                              {Number(item.quantity || 0) > 0 && (
                                <>
                                  <span className="arrow">→</span>
                                  <span className="new-stock">
                                    {(item.product.stock_quantity ?? 0) + actualQuantityAdded}{" "}
                                    {item.product.unit_symbol || ""}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            {item.product.has_bulk === 1 ? (
                              <select
                                className="unit-select"
                                value={item.isBulk ? "bulk" : "base"}
                                onChange={(e) =>
                                  updateItemUnit(
                                    item.product.id,
                                    e.target.value === "bulk",
                                  )
                                }
                                style={{
                                  width: "100%",
                                  height: "32px",
                                  padding: "0 6px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                }}
                              >
                                <option value="base">
                                  {item.product.unit_symbol || "Base Unit"}
                                </option>
                                {item.product.bulk_unit && (
                                  <option value="bulk">
                                    {item.product.bulk_unit} (Pack)
                                  </option>
                                )}
                              </select>
                            ) : (
                              <span style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>
                                {item.product.unit_symbol || item.product.uom || "Unit"}
                              </span>
                            )}
                          </td>

                          <td style={{ textAlign: "right" }}>
                            {item.product.has_bulk === 1 ? (
                              <div className="sale-mrp-group">
                                <div className="sale-mrp-row" title={`Purchase Rate per ${item.product.unit_symbol || "Base"}`}>
                                  <span className="sale-mrp-label">
                                    {item.product.unit_symbol || "Base"}:
                                  </span>
                                  <input
                                    className="sale-mrp-input"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={
                                      item.unitPrice === ""
                                        ? ""
                                        : item.isBulk
                                          ? (Number(item.unitPrice) / multiplier)
                                          : item.unitPrice
                                    }
                                    onChange={(e) =>
                                      updatePrice(item.product.id, e.target.value, false)
                                    }
                                  />
                                </div>

                                <div className="sale-mrp-row" title={`Purchase Rate per ${item.product.bulk_unit || "Bulk"}`}>
                                  <span className="sale-mrp-label">
                                    {item.product.bulk_unit || "Bulk"}:
                                  </span>
                                  <input
                                    className="sale-mrp-input"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={
                                      item.unitPrice === ""
                                        ? ""
                                        : item.isBulk
                                          ? item.unitPrice
                                          : (Number(item.unitPrice) * (item.product.bulk_conversion_rate || 1))
                                    }
                                    onChange={(e) =>
                                      updatePrice(item.product.id, e.target.value, true)
                                    }
                                  />
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                <input
                                  className="purchase-price-input-box"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updatePrice(item.product.id, e.target.value, false)
                                  }
                                />

                                {/* Cost Volatility Indicator */}
                                {item.product.average_cost > 0 &&
                                  basePurchasePrice !== item.product.average_cost && (
                                    <span
                                      className={`cost-volatility-pill ${
                                        basePurchasePrice > item.product.average_cost
                                          ? "up"
                                          : "down"
                                      }`}
                                      title="Price compared to current inventory average cost"
                                    >
                                      {basePurchasePrice > item.product.average_cost ? "↑ " : "↓ "}
                                      {Math.abs(
                                        ((basePurchasePrice - item.product.average_cost) /
                                          item.product.average_cost) *
                                          100,
                                      ).toFixed(1)}
                                      % vs Avg
                                    </span>
                                  )}
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="sale-mrp-group">
                              <div className="sale-mrp-row" title={`Update ${item.product.unit_symbol || "Base"} Sale MRP`}>
                                <span className="sale-mrp-label">
                                  {item.product.unit_symbol || "Base"}:
                                </span>
                                <input
                                  className="sale-mrp-input"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={baseSalePriceVal}
                                  onChange={(e) =>
                                    updateSellingPrice(
                                      item.product.id,
                                      e.target.value,
                                      false,
                                    )
                                  }
                                />
                              </div>

                              {item.product.has_bulk === 1 && (
                                <div className="sale-mrp-row" title={`Update ${item.product.bulk_unit || "Bulk"} Sale MRP`}>
                                  <span className="sale-mrp-label">
                                    {item.product.bulk_unit || "Bulk"}:
                                  </span>
                                  <input
                                    className="sale-mrp-input"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={bulkSalePriceVal}
                                    onChange={(e) =>
                                      updateSellingPrice(
                                        item.product.id,
                                        e.target.value,
                                        true,
                                      )
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: "center" }}>
                            <input
                              className="qty-input-box"
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantity(item.product.id, e.target.value)
                              }
                            />
                          </td>

                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#0f172a",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatCurrency(lineTotal)}
                          </td>

                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="cart-delete-btn"
                              title="Remove item"
                              onClick={() => removeFromCart(item.product.id)}
                            >
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
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Sticky Checkout & Supplier Sidebar */}
        <div className="billing-sidebar-sticky">
          <div className="billing-summary-panel">
            <div className="billing-sidebar-title">
              <span>Purchase Summary</span>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "normal" }}>
                {cart.length} {cart.length === 1 ? "item" : "items"}
              </span>
            </div>

            {/* Supplier Details Card */}
            <div className="customer-search-wrap">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Supplier Details</label>
                {!selectedSupplier && (
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#2563eb",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                    onClick={() => setShowNewSupplierForm(!showNewSupplierForm)}
                  >
                    {showNewSupplierForm ? "✕ Close" : "+ New Supplier"}
                  </button>
                )}
              </div>

              {!selectedSupplier ? (
                <>
                  <input
                    type="text"
                    className="customer-search-input-box"
                    placeholder="Search supplier by name or phone..."
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                  />

                  {showSupplierDropdown && (
                    <div className="customer-dropdown-menu">
                      {supplierSearchResults.map((sup) => (
                        <div
                          key={sup.id}
                          className="customer-dropdown-item"
                          onClick={() => {
                            setSupplierId(sup.id);
                            setSupplierSearch("");
                            setShowSupplierDropdown(false);
                            setShowNewSupplierForm(false);
                          }}
                        >
                          <div>
                            <div className="c-name">{sup.name}</div>
                            {sup.gstin && (
                              <div style={{ fontSize: "10px", color: "#64748b" }}>
                                GSTIN: {sup.gstin}
                              </div>
                            )}
                          </div>
                          <span className="c-phone">📞 {sup.phone || "—"}</span>
                        </div>
                      ))}
                      {supplierSearchResults.length === 0 && (
                        <div style={{ padding: "10px", fontSize: "12px", color: "#94a3b8" }}>
                          No supplier found. Enter details below to register.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick New Supplier Registration Form */}
                  {(showNewSupplierForm || (supplierSearch.length > 0 && supplierSearchResults.length === 0)) && (
                    <div className="new-customer-quick-card">
                      <label>New Supplier Registration</label>
                      <input
                        type="text"
                        placeholder="Supplier / Company Name *"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={newSupplierPhone}
                        onChange={(e) => setNewSupplierPhone(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="GSTIN (Optional)"
                        value={newSupplierGstin}
                        onChange={(e) => setNewSupplierGstin(e.target.value)}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ padding: "6px 12px", fontSize: "12px", background: "#2563eb", color: "#ffffff", borderColor: "#2563eb" }}
                        onClick={handleQuickCreateSupplier}
                        disabled={registeringSupplier || !newSupplierName.trim()}
                      >
                        {registeringSupplier ? "Saving..." : "+ Register Supplier"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="customer-card-selected">
                  <div>
                    <div className="c-info-name">✓ {selectedSupplier.name}</div>
                    <div className="c-info-sub">📞 {selectedSupplier.phone || "No phone recorded"}</div>
                    {selectedSupplier.gstin && (
                      <div style={{ fontSize: "10px", color: "#166534", marginTop: "2px" }}>
                        GSTIN: {selectedSupplier.gstin}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="c-clear-btn"
                    onClick={() => setSupplierId(null)}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Supplier Bill Number & Bill Date (Side by Side) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {/* Supplier Bill / Invoice Number (Mandatory) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b" }}>
                    Supplier Bill No. <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  {billNumber.trim() ? (
                    <span style={{ fontSize: "10px", color: "#166534", fontWeight: 600 }}>✓ Entered</span>
                  ) : (
                    <span style={{ fontSize: "10px", color: "#ef4444", fontWeight: 600 }}>Required</span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. INV-9842"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  style={{
                    width: "100%",
                    height: "38px",
                    padding: "0 10px",
                    borderRadius: "8px",
                    border: billNumber.trim() ? "1px solid #cbd5e1" : "1.5px solid #f87171",
                    backgroundColor: billNumber.trim() ? "#ffffff" : "#fef2f2",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0f172a",
                    outline: "none",
                    transition: "all 0.15s ease",
                  }}
                />
              </div>

              {/* Purchase Bill Date (Editable) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b" }}>
                    Bill Date
                  </label>
                  {purchaseDate !== new Date().toISOString().split("T")[0] && (
                    <button
                      type="button"
                      onClick={() => setPurchaseDate(new Date().toISOString().split("T")[0])}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#2563eb",
                        fontSize: "10px",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                      title="Reset to today's date"
                    >
                      Reset Today
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: "38px",
                    padding: "0 8px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Payment Method Segmented Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b" }}>
                Payment Method
              </label>
              <div className="payment-tabs-grid">
                {["Cash", "UPI", "Card", "Credit"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`payment-tab-btn ${paymentMethod === method ? "active" : ""}`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    <span>
                      {method === "Cash" && "💵"}
                      {method === "UPI" && "📱"}
                      {method === "Card" && "💳"}
                      {method === "Credit" && "⏱"}
                    </span>
                    <span>{method}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Financial Summary Breakdown */}
            <div className="billing-totals-group">
              <div className="billing-totals-row">
                <span>Subtotal (Net Items):</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>

              <div className="billing-totals-row">
                <span>Input Tax (GST):</span>
                <strong>+{formatCurrency(taxAmount)}</strong>
              </div>

              <div className="billing-totals-row">
                <span>Supplier Discount:</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="billing-discount-input"
                  value={discount === 0 ? "" : discount}
                  placeholder="₹ 0.00"
                  onChange={(e) =>
                    setDiscount(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </div>
            </div>

            {/* Grand Total Hero Box */}
            <div className="grand-total-hero-box">
              <span className="hero-label">Net Payable (Incl. Tax)</span>
              <span className="hero-amount">{formatCurrency(grandTotal)}</span>
              {grandTotal > 0 && (
                <div className="hero-words">{numberToWords(grandTotal)}</div>
              )}
            </div>

            {error && <div className="form-error">{error}</div>}
            {successMessage && <div className="form-success">{successMessage}</div>}

            {/* Save Purchase Action Button */}
            <button
              type="button"
              className="billing-submit-action-btn"
              onClick={handleSavePurchase}
              disabled={cart.length === 0 || saving || !supplierId || !billNumber.trim()}
            >
              <span>📥</span>
              <span>
                {saving
                  ? "Saving Purchase Record..."
                  : redoPurchaseId
                    ? "Update Purchase Record"
                    : "Save Purchase Record"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          existingProducts={products}
          onProductAdded={async () => {
            setShowAddProduct(false);
            await loadData();
          }}
        />
      )}
    </div>
  );
}

export default PurchasesPage;
