import { useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../database/product";
import {
  createPurchase,
  getPurchaseById,
  getPurchases,
  type PurchaseWithSupplier,
} from "../../database/purchase";
import { getSuppliers, type Supplier } from "../../database/supplier";

type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
};

function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<
    PurchaseWithSupplier[]
  >([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedPurchase, setSelectedPurchase] = useState<{
    purchase: Awaited<ReturnType<typeof getPurchaseById>>["purchase"];
    items: Awaited<ReturnType<typeof getPurchaseById>>["items"];
  } | null>(null);

  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [productData, supplierData, purchaseData] = await Promise.all([
        getProducts(),
        getSuppliers(),
        getPurchases(),
      ]);

      setProducts(productData);
      setSuppliers(supplierData);
      setPurchaseHistory(purchaseData);
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
        },
      ];
    });

    setSearchTerm("");
  }

  async function handleViewPurchase(id: number) {
    try {
      const data = await getPurchaseById(id);

      setSelectedPurchase(data);
      setShowPurchaseDetails(true);
    } catch (error) {
      console.error("Failed to load purchase:", error);
      setError("Failed to load purchase details.");
    }
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
        const itemSubtotal = item.unitPrice * item.quantity;

        const itemTax = itemSubtotal * (item.product.tax_rate / 100);

        return {
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: item.product.tax_rate,
          tax_amount: itemTax,
          discount_amount: 0,
          line_total: itemSubtotal + itemTax,
        };
      });

      const result = await createPurchase({
        supplier_id: supplierId,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        grand_total: grandTotal,
        payment_method: paymentMethod,
        items,
      });

      setSuccessMessage(
        `Purchase ${result.purchaseNumber} saved successfully.`,
      );

      setCart([]);
      setSupplierId(null);
      setDiscount(0);
      setPaymentMethod("Cash");

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
      {/* Purchase History */}
      <div className="panel purchase-history-panel">
        <div className="panel-header">
          <div>
            <h3>Purchase History</h3>
            <p>View your previous purchases.</p>
          </div>
        </div>

        {purchaseHistory.length === 0 ? (
          <div className="empty-cart">
            <p>No purchases found.</p>
            <span>Saved purchases will appear here.</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Purchase No.</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Payment</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {purchaseHistory.map((purchase) => (
                  <tr
                    key={purchase.id}
                    onClick={() => handleViewPurchase(purchase.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <strong>{purchase.purchase_number}</strong>
                    </td>

                    <td>
                      {new Date(
                        purchase.created_at.replace(" ", "T") + "Z",
                      ).toLocaleDateString("en-IN")}
                    </td>

                    <td>{purchase.supplier_name || "—"}</td>

                    <td>{purchase.payment_method}</td>

                    <td>
                      <strong>₹{purchase.grand_total.toFixed(2)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showPurchaseDetails && selectedPurchase && (
        <div
          className="modal-overlay"
          onClick={() => setShowPurchaseDetails(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedPurchase.purchase.purchase_number}</h3>

                <p>Purchase details</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowPurchaseDetails(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Purchase Information */}
              <div className="purchase-detail-info">
                <div>
                  <strong>Date</strong>

                  <span>
                    {new Date(
                      selectedPurchase.purchase.created_at.replace(" ", "T") +
                        "Z",
                    ).toLocaleDateString("en-IN")}
                  </span>
                </div>

                <div>
                  <strong>Payment</strong>

                  <span>{selectedPurchase.purchase.payment_method}</span>
                </div>
              </div>

              {/* Products */}
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedPurchase.items.map((item) => (
                      <tr key={`${item.product_id}-${item.product_name}`}>
                        <td>{item.product_name}</td>

                        <td>{item.quantity}</td>

                        <td>₹{item.unit_price.toFixed(2)}</td>

                        <td>₹{item.line_total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="purchase-detail-totals">
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

                <div className="purchase-detail-grand-total">
                  <span>Grand Total</span>

                  <strong>
                    ₹{selectedPurchase.purchase.grand_total.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Notes */}
              {selectedPurchase.purchase.notes && (
                <div className="purchase-notes">
                  <strong>Notes</strong>
                  <p>{selectedPurchase.purchase.notes}</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setShowPurchaseDetails(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchasesPage;
