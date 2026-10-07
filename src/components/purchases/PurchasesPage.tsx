import { useEffect, useMemo, useState, useRef } from "react";
import { getProducts, type Product } from "../../database/product";
import {
  createPurchase,
  updatePurchase,
  getPurchaseById,
} from "../../database/purchase";
import { getSuppliers, type Supplier } from "../../database/supplier";
import AddProductModal from "../products/AddProductModal";

type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number | "";
  isBulk: boolean;
  newMRP?: number | "";
  newBulkMRP?: number | null | "";
};

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

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const isReadyToSave = useRef(false);

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

  const searchResults = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return [];
    }

    return products
      .filter((product) => {
        if (!search) return true;
        return search.split(/\s+/).every((token) => {
          const cleanedToken = token.replace(/\s+/g, "");
          const cleanedName = product.name.toLowerCase().replace(/\s+/g, "");
          return (
            cleanedName.includes(cleanedToken) ||
            (product.barcode ?? "").toLowerCase().includes(cleanedToken) ||
            (product.hsn_sac ?? "").toLowerCase().includes(cleanedToken)
          );
        });
      })
      .slice(0, 10);
  }, [products, searchTerm]);

  function addToCart(product: Product) {
    setCart((previous) => {
      const existing = previous.find((item) => item.product.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
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

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
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

  function updatePrice(productId: number, val: string) {
    const price = val === "" ? "" : Number(val);
    setCart((previous) =>
      previous.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              unitPrice: price === "" ? "" : Math.max(0, price as number),
            }
          : item,
      ),
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
      (total, item) => total + (Number(item.unitPrice) || 0) * item.quantity,
      0,
    );
  }, [cart]);

  const taxAmount = useMemo(() => {
    return cart.reduce((total, item) => {
      const itemSubtotal = (Number(item.unitPrice) || 0) * item.quantity;

      const tax = itemSubtotal * (item.product.tax_rate / 100);

      return total + tax;
    }, 0);
  }, [cart]);

  const grandTotal = Math.max(0, subtotal + taxAmount - discount);

  async function handleSavePurchase() {
    if (cart.length === 0) {
      setError("Add at least one product.");
      return;
    }

    if (!supplierId) {
      setError("Select a supplier.");
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
        const actualQuantity = item.quantity * multiplier;
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
    <div>
      {/* Page Header */}
      <div className="welcome">
        <div>
          <h3>Purchases</h3>
          <p>Record purchases and update your stock.</p>
        </div>
      </div>
      <div className="billing-layout purchase-theme">
        {/* Left Side */}
        <div className="billing-products">
          {/* Add Products */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Add Products</h3>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <p>Search by product name, HSN or barcode.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowAddProduct(true)}
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                  >
                    + Add New Product
                  </button>
                </div>
              </div>
            </div>

            <div className="billing-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search product, HSN or barcode..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            {searchTerm && (
              <div className="search-results">
                {loading ? (
                  <div className="search-result-message">
                    Loading products...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="search-result-message">
                    No products found.
                  </div>
                ) : (
                  searchResults.map((product) => (
                    <div className="product-search-result" key={product.id}>
                      <div>
                        <strong>{product.name}</strong>

                        <div style={{ fontSize: "12px", color: "#666" }}>
                          {product.hsn_sac
                            ? `HSN: ${product.hsn_sac}`
                            : "No HSN"}
                        </div>
                      </div>

                      <div className="product-result-right">
                        <div>₹{product.purchase_price.toFixed(2)}</div>

                        <small>
                          Current Stock: {product.stock_quantity}{" "}
                          {product.unit_symbol || ""}
                        </small>

                        <button
                          className="primary-button"
                          onClick={() => addToCart(product)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Current Purchase */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Current Purchase</h3>

                <p>
                  {cart.length} product
                  {cart.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <p>No products added yet.</p>

                <span>Search for a product above to begin.</span>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Product / Stock</th>
                      <th>Purchase Price</th>
                      <th>Sale Price</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {cart.map((item) => {
                      const multiplier = item.isBulk
                        ? item.product.bulk_conversion_rate || 1
                        : 1;
                      const actualQuantityAdded = item.quantity * multiplier;
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

                      return (
                        <tr key={item.product.id}>
                          <td>
                            {item.product.name}
                            {/* 2. Live Stock Projection Indicator */}
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                marginTop: "4px",
                              }}
                            >
                              Stock: {item.product.stock_quantity ?? 0}{" "}
                              {item.product.unit_symbol || ""}
                              {item.quantity > 0 && (
                                <>
                                  <span style={{ margin: "0 4px" }}>→</span>
                                  <span
                                    style={{
                                      color: "#10b981",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {(item.product.stock_quantity ?? 0) +
                                      actualQuantityAdded}{" "}
                                    {item.product.unit_symbol || ""}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              className="quantity-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) =>
                                updatePrice(item.product.id, event.target.value)
                              }
                            />
                            {/* 1. Cost Volatility indicator */}
                            {item.product.average_cost > 0 &&
                              basePurchasePrice !==
                                item.product.average_cost && (
                                <div
                                  style={{
                                    fontSize: "10px",
                                    marginTop: "4px",
                                    color:
                                      basePurchasePrice >
                                      item.product.average_cost
                                        ? "#ef4444"
                                        : "#10b981",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {basePurchasePrice > item.product.average_cost
                                    ? "↑ "
                                    : "↓ "}
                                  {Math.abs(
                                    ((basePurchasePrice -
                                      item.product.average_cost) /
                                      item.product.average_cost) *
                                      100,
                                  ).toFixed(1)}
                                  % vs Avg
                                </div>
                              )}
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={`Update ${item.product.unit_symbol || "Base"} Sale Price`}
                              >
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "#333",
                                    width: "35px",
                                    textAlign: "right",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {item.product.unit_symbol || "Base"}
                                </span>
                                <input
                                  className="quantity-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={baseSalePriceVal}
                                  onChange={(event) =>
                                    updateSellingPrice(
                                      item.product.id,
                                      event.target.value,
                                      false,
                                    )
                                  }
                                  style={{
                                    height: "28px",
                                  }}
                                />
                              </div>
                              {item.product.has_bulk === 1 && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title={`Update ${item.product.bulk_unit} Sale Price`}
                                >
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "#333",
                                      width: "35px",
                                      textAlign: "right",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {item.product.bulk_unit || "Bulk"}
                                  </span>
                                  <input
                                    className="quantity-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={bulkSalePriceVal}
                                    onChange={(event) =>
                                      updateSellingPrice(
                                        item.product.id,
                                        event.target.value,
                                        true,
                                      )
                                    }
                                    style={{
                                      height: "28px",
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            {item.product.has_bulk === 1 ? (
                              <select
                                className="unit-select"
                                value={item.isBulk ? "bulk" : "base"}
                                onChange={(event) =>
                                  updateItemUnit(
                                    item.product.id,
                                    event.target.value === "bulk",
                                  )
                                }
                                style={{ width: "90px", padding: "4px" }}
                              >
                                <option value="base">
                                  {item.product.unit_symbol || "Base"}
                                </option>
                                {item.product.bulk_unit && (
                                  <option value="bulk">
                                    {item.product.bulk_unit}
                                  </option>
                                )}
                              </select>
                            ) : (
                              <span style={{ fontSize: "14px", color: "#666" }}>
                                {item.product.unit_symbol || "-"}
                              </span>
                            )}
                          </td>
                          <td>
                            <input
                              className="quantity-input"
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateQuantity(
                                  item.product.id,
                                  Number(event.target.value),
                                )
                              }
                            />
                          </td>

                          <td>
                            ₹
                            {(
                              (Number(item.unitPrice) || 0) * item.quantity
                            ).toFixed(2)}
                          </td>

                          <td>
                            <button
                              className="danger-button"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              Remove
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

        {/* Right Side */}
        <div className="billing-summary">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Purchase Summary</h3>
              </div>
            </div>

            <div className="billing-summary-content">
              {/* Supplier */}
              <div className="billing-customer">
                <div className="billing-customer-title">Supplier</div>

                <div className="payment-group">
                  <label>Select Supplier</label>

                  <select
                    value={supplierId ?? ""}
                    onChange={(event) =>
                      setSupplierId(
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  >
                    <option value="">Select supplier</option>

                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                        {supplier.phone ? ` - ${supplier.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {suppliers.length === 0 && (
                  <div className="customer-status">
                    No suppliers found. Add a supplier first.
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>₹{subtotal.toFixed(2)}</strong>
              </div>

              <div className="summary-row">
                <span>Tax</span>
                <strong>₹{taxAmount.toFixed(2)}</strong>
              </div>

              <div className="discount-row">
                <label>Discount</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(event) =>
                    setDiscount(Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </div>

              <div className="summary-divider"></div>

              <div className="grand-total">
                <span>Grand Total</span>

                <strong>₹{grandTotal.toFixed(2)}</strong>
              </div>

              {/* Payment */}
              <div className="payment-group">
                <label>Payment Method</label>

                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>

              {error && <div className="form-error">{error}</div>}

              {successMessage && (
                <div className="form-success">{successMessage}</div>
              )}

              <button
                className="primary-button billing-save-button"
                onClick={handleSavePurchase}
                disabled={cart.length === 0 || saving || suppliers.length === 0}
              >
                {saving ? "Saving..." : "Save Purchase"}
              </button>
            </div>
          </div>
        </div>
      </div>
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
      \n
    </div>
  );
}

export default PurchasesPage;
