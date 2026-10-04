import { useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../database/product";
import {
  createPurchase,
  updatePurchase,
  getPurchaseById,
} from "../../database/purchase";
import { getSuppliers, type Supplier } from "../../database/supplier";

type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
  isBulk: boolean;
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
        return (
          product.name.toLowerCase().includes(search) ||
          (product.barcode ?? "").toLowerCase().includes(search) ||
          (product.hsn_sac ?? "").toLowerCase().includes(search)
        );
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
          unitPrice: product.purchase_price,
          isBulk: false,
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
          const basePrice = item.isBulk
            ? item.unitPrice / oldRate
            : item.unitPrice;

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

  function updatePrice(productId: number, price: number) {
    setCart((previous) =>
      previous.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              unitPrice: Math.max(0, price),
            }
          : item,
      ),
    );
  }

  function removeFromCart(productId: number) {
    setCart((previous) =>
      previous.filter((item) => item.product.id !== productId),
    );
  }

  const subtotal = useMemo(() => {
    return cart.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );
  }, [cart]);

  const taxAmount = useMemo(() => {
    return cart.reduce((total, item) => {
      const itemSubtotal = item.unitPrice * item.quantity;

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
        const actualUnitPrice = item.unitPrice / multiplier;

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

      <div className="billing-layout">
        {/* Left Side */}
        <div className="billing-products">
          {/* Add Products */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Add Products</h3>
                <p>Search by product name, HSN or barcode.</p>
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
                      <th>Product</th>
                      <th>Purchase Price</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.product.id}>
                        <td>{item.product.name}</td>

                        <td>
                          <input
                            className="quantity-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updatePrice(
                                item.product.id,
                                Number(event.target.value),
                              )
                            }
                          />
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

                        <td>₹{(item.unitPrice * item.quantity).toFixed(2)}</td>

                        <td>
                          <button
                            className="danger-button"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
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
    </div>
  );
}

export default PurchasesPage;
