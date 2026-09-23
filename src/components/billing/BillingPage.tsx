import { useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../database/product";
import {
  createInvoice,
  getInvoiceById,
  updateInvoice,
} from "../../database/invoice";
import {
  getCustomerByPhone,
  createCustomer,
  getCustomerById,
  type Customer,
} from "../../database/customer";
import logo from "../../assets/logosquaregreen.jpeg";

type CartItem = {
  product: Product;
  quantity: number | "";
  isBulk: boolean;
};

function BillingPage({
  redoInvoiceId,
  onClearRedo,
}: {
  redoInvoiceId?: number | null;
  onClearRedo?: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [printData, setPrintData] = useState<{
    invoice: Awaited<ReturnType<typeof getInvoiceById>>["invoice"];
    items: Awaited<ReturnType<typeof getInvoiceById>>["items"];
    customer: Customer | null;
  } | null>(null);

  useEffect(() => {
    loadProducts().then(() => {
      if (redoInvoiceId) {
        loadInvoiceForRedo(redoInvoiceId);
      }
    });
  }, [redoInvoiceId]);

  async function loadInvoiceForRedo(invoiceId: number) {
    try {
      setLoading(true);
      const { invoice, items } = await getInvoiceById(invoiceId);

      if (invoice.customer_id) {
        const cust = await getCustomerById(invoice.customer_id);
        if (cust) {
          setCustomer(cust);
          setCustomerId(cust.id);
          setPhone(cust.phone || "");
        }
      }

      setDiscount(invoice.discount_amount);
      setPaymentMethod(invoice.payment_method);

      const allProducts = await getProducts();
      const newCart: CartItem[] = items.map((item) => {
        const prod = allProducts.find((p) => p.id === item.product_id);
        if (!prod) throw new Error("Product not found");
        return {
          product: prod,
          quantity: item.quantity,
          isBulk: item.is_bulk === 1,
        };
      });
      setCart(newCart);
    } catch (e) {
      console.error("Failed to load invoice for redo", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!printData) return;

    const handleAfterPrint = () => {
      setPrintData(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    const timer = setTimeout(() => {
      window.print();
    }, 300);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printData]);

  async function loadProducts() {
    try {
      setLoading(true);

      const data = await getProducts();

      setProducts(data);
    } catch (error) {
      console.error("Failed to load products:", error);
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
          (product.sku ?? "").toLowerCase().includes(search) ||
          (product.barcode ?? "").toLowerCase().includes(search)
        );
      })
      .slice(0, 10);
  }, [products, searchTerm]);

  function addToCart(product: Product) {
    if (product.stock_quantity <= 0) {
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === product.id && item.isBulk === false,
      );

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item.isBulk === false
            ? {
                ...item,
                quantity:
                  (typeof item.quantity === "number" ? item.quantity : 0) + 1,
              }
            : item,
        );
      }

      return [...prev, { product, quantity: 1, isBulk: false }];
    });

    setSearchTerm("");
  }

  function updateQuantity(productId: number, isBulk: boolean, rawVal: string) {
    let quantity: number | "" = "";
    if (rawVal !== "") {
      const parsed = Number(rawVal);
      quantity = isNaN(parsed) ? "" : parsed;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.isBulk === isBulk
          ? { ...item, quantity }
          : item,
      ),
    );
  }

  function updateItemUnit(
    productId: number,
    isBulk: boolean,
    newIsBulk: boolean,
  ) {
    setCart((prev) => {
      // First check if the target configuration already exists
      const targetExists = prev.find(
        (item) => item.product.id === productId && item.isBulk === newIsBulk,
      );

      if (targetExists) {
        // If it exists, merge quantities
        const sourceItem = prev.find(
          (item) => item.product.id === productId && item.isBulk === isBulk,
        );
        const qtyToAdd =
          sourceItem && typeof sourceItem.quantity === "number"
            ? sourceItem.quantity
            : 0;

        return prev
          .map((item) => {
            if (item.product.id === productId && item.isBulk === newIsBulk) {
              const currentQty =
                typeof item.quantity === "number" ? item.quantity : 0;
              return { ...item, quantity: currentQty + qtyToAdd };
            }
            return item;
          })
          .filter(
            (item) =>
              !(item.product.id === productId && item.isBulk === isBulk),
          );
      } else {
        // Otherwise just switch the flag
        return prev.map((item) =>
          item.product.id === productId && item.isBulk === isBulk
            ? { ...item, isBulk: newIsBulk }
            : item,
        );
      }
    });
  }

  function removeFromCart(productId: number, isBulk: boolean) {
    setCart((prev) =>
      prev.filter(
        (item) => !(item.product.id === productId && item.isBulk === isBulk),
      ),
    );
  }

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const price =
        item.isBulk && item.product.bulk_price
          ? item.product.bulk_price
          : item.product.selling_price;
      const qty = typeof item.quantity === "number" ? item.quantity : 0;
      return total + price * qty;
    }, 0);
  }, [cart]);

  const taxAmount = useMemo(() => {
    return cart.reduce((total, item) => {
      const price =
        item.isBulk && item.product.bulk_price
          ? item.product.bulk_price
          : item.product.selling_price;
      const qty = typeof item.quantity === "number" ? item.quantity : 0;
      const itemSubtotal = price * qty;

      const tax = itemSubtotal * (item.product.tax_rate / 100);

      return total + tax;
    }, 0);
  }, [cart]);

  const grandTotal = Math.max(0, subtotal + taxAmount - discount);

  async function handlePhoneChange(value: string) {
    const cleanedPhone = value.replace(/\D/g, "");

    setPhone(cleanedPhone);
    setCustomer(null);
    setCustomerId(null);
    setCustomerName("");
    setIsNewCustomer(false);

    if (cleanedPhone.length < 10) {
      return;
    }

    try {
      setCheckingCustomer(true);

      const existingCustomer = await getCustomerByPhone(cleanedPhone);

      if (existingCustomer) {
        setCustomer(existingCustomer);
        setCustomerId(existingCustomer.id);
      } else {
        setIsNewCustomer(true);
      }
    } catch (error) {
      console.error("Failed to find customer:", error);
      setError("Failed to check customer.");
    } finally {
      setCheckingCustomer(false);
    }
  }

  async function handleCreateCustomer() {
    if (!phone || phone.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }

    if (!customerName.trim()) {
      setError("Enter customer name.");
      return;
    }

    try {
      setError("");
      setSaving(true);

      await createCustomer({
        name: customerName.trim(),
        phone,
      });

      const newCustomer = await getCustomerByPhone(phone);

      if (newCustomer) {
        setCustomer(newCustomer);
        setCustomerId(newCustomer.id);
        setIsNewCustomer(false);
      }
    } catch (error) {
      console.error("Failed to create customer:", error);
      setError("Failed to create customer.");
    } finally {
      setSaving(false);
    }
  }

  function printInvoice(
    invoice: Awaited<ReturnType<typeof getInvoiceById>>["invoice"],
    items: Awaited<ReturnType<typeof getInvoiceById>>["items"],
    customer: Customer | null,
  ) {
    setPrintData({
      invoice,
      items,
      customer,
    });
  }

  async function handleSaveInvoice() {
    if (cart.length === 0) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      setSaving(true);

      const items = cart.map((item) => {
        const price =
          item.isBulk && item.product.bulk_price
            ? item.product.bulk_price
            : item.product.selling_price;

        const unitStr = item.isBulk
          ? item.product.bulk_unit
          : item.product.unit_symbol || item.product.unit_name;

        const appendedName = unitStr
          ? `${item.product.name} (${unitStr})`
          : item.product.name;

        const qty = typeof item.quantity === "number" ? item.quantity : 0;

        return {
          product_id: item.product.id,
          product_name: appendedName,
          quantity: qty,
          unit_price: price,
          cost_price: item.product.purchase_price,
          tax_rate: item.product.tax_rate,
          tax_amount: (price * qty * item.product.tax_rate) / 100,
          discount_amount: 0,
          line_total: price * qty,
          is_bulk: item.isBulk ? 1 : 0,
          bulk_multiplier:
            item.product.bulk_conversion_rate && item.isBulk
              ? item.product.bulk_conversion_rate
              : 1,
        };
      });

      let resultInvoiceId: number;
      let invoiceNumber: string = "";

      if (redoInvoiceId) {
        await updateInvoice(redoInvoiceId, {
          customer_id: customerId,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discount,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          items,
        });
        resultInvoiceId = redoInvoiceId;
      } else {
        const result = await createInvoice({
          customer_id: customerId,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discount,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          items,
        });
        resultInvoiceId = result.invoiceId;
        invoiceNumber = result.invoiceNumber;
      }

      const savedInvoice = await getInvoiceById(resultInvoiceId);
      if (!invoiceNumber) {
        invoiceNumber = savedInvoice.invoice.invoice_number;
      }

      const invoiceCustomer = savedInvoice.invoice.customer_id
        ? await getCustomerByPhone(phone)
        : null;

      printInvoice(savedInvoice.invoice, savedInvoice.items, invoiceCustomer);

      setSuccessMessage(`Invoice ${invoiceNumber} saved successfully.`);
      // Clear the current bill.
      setCart([]);
      setDiscount(0);

      setPhone("");
      setCustomerName("");
      setCustomer(null);
      setCustomerId(null);
      setIsNewCustomer(false);

      // Refresh products so stock values are updated.
      await loadProducts();

      if (onClearRedo) {
        onClearRedo();
      }
    } catch (error) {
      console.error("FAILED TO SAVE INVOICE:", error);

      const message = error instanceof Error ? error.message : String(error);

      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {printData && (
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
            Sales Invoice
          </h3>

          <div className="print-info">
            <div>
              <strong>Invoice:</strong> {printData.invoice.invoice_number}
            </div>

            <div>
              <strong>Date:</strong>{" "}
              {new Date(
                printData.invoice.created_at.replace(" ", "T") + "Z",
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

            {printData.customer ? (
              <>
                <div>{printData.customer.name}</div>

                {printData.customer.phone && (
                  <div>Phone: {printData.customer.phone}</div>
                )}

                {printData.customer.address && (
                  <div>{printData.customer.address}</div>
                )}

                {printData.customer.gstin && (
                  <div>GSTIN: {printData.customer.gstin}</div>
                )}
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
              {printData.items.map((item, index) => (
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
              <strong>₹{printData.invoice.subtotal.toFixed(2)}</strong>
            </div>

            <div>
              <span>Tax</span>
              <strong>₹{printData.invoice.tax_amount.toFixed(2)}</strong>
            </div>

            {printData.invoice.discount_amount > 0 && (
              <div>
                <span>Discount</span>
                <strong>
                  - ₹{printData.invoice.discount_amount.toFixed(2)}
                </strong>
              </div>
            )}

            <div className="print-grand-total">
              <span>Grand Total</span>
              <strong>₹{printData.invoice.grand_total.toFixed(2)}</strong>
            </div>
          </div>

          <div className="print-payment">
            <strong>Payment Method:</strong> {printData.invoice.payment_method}
          </div>

          <div className="print-footer">Thank you for your business!</div>
        </div>
      )}

      <div />
      {/* Your existing BillingPage content */}
      {/* Page Header */}
      <div className="welcome">
        <div>
          <h3>Billing</h3>
          <p>Create and manage customer invoices.</p>
        </div>
      </div>

      <div className="billing-layout">
        {/* Left Side */}
        <div className="billing-products">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Add Products</h3>
                <p>Search by product name, SKU or barcode.</p>
              </div>
            </div>

            <div className="billing-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search product, SKU or barcode..."
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

                        <span>
                          {product.sku ? `SKU: ${product.sku}` : "No SKU"}
                        </span>
                      </div>

                      <div className="product-result-right">
                        <div>₹{product.selling_price.toFixed(2)}</div>

                        <small>
                          Stock: {product.stock_quantity}{" "}
                          {product.unit_symbol || ""}
                        </small>

                        <button
                          className="primary-button"
                          onClick={() => addToCart(product)}
                          disabled={product.stock_quantity <= 0}
                        >
                          {product.stock_quantity <= 0 ? "Out of Stock" : "Add"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Current Bill</h3>
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
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th style={{ width: "120px" }}>Unit</th>
                      <th style={{ width: "90px" }}>Qty</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => {
                      const price =
                        item.isBulk && item.product.bulk_price
                          ? item.product.bulk_price
                          : item.product.selling_price;

                      return (
                        <tr key={`${item.product.id}-${item.isBulk}`}>
                          <td>{item.product.name}</td>

                          <td>₹{price.toFixed(2)}</td>

                          <td>
                            {item.product.has_bulk === 1 ? (
                              <select
                                className="unit-select"
                                value={item.isBulk ? "bulk" : "base"}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #d1d5db",
                                  outline: "none",
                                  background: "white",
                                }}
                                onChange={(e) =>
                                  updateItemUnit(
                                    item.product.id,
                                    item.isBulk,
                                    e.target.value === "bulk",
                                  )
                                }
                              >
                                <option value="base">
                                  {item.product.unit_symbol ||
                                    item.product.unit_name ||
                                    "Base"}
                                </option>
                                <option value="bulk">
                                  {item.product.bulk_unit || "Bulk"}
                                </option>
                              </select>
                            ) : (
                              <span className="cart-item-unit">
                                {item.product.unit_symbol ||
                                  item.product.unit_name}
                              </span>
                            )}
                          </td>

                          <td>
                            <input
                              className="quantity-input"
                              type="number"
                              min="0.01"
                              step="any"
                              style={{ width: "100%" }}
                              value={item.quantity}
                              onChange={(event) =>
                                updateQuantity(
                                  item.product.id,
                                  item.isBulk,
                                  event.target.value,
                                )
                              }
                            />
                          </td>

                          <td>
                            ₹
                            {typeof item.quantity === "number"
                              ? (price * item.quantity).toFixed(2)
                              : "0.00"}
                          </td>

                          <td>
                            <button
                              className="danger-button"
                              style={{ padding: "6px 10px", fontSize: "12px" }}
                              onClick={() =>
                                removeFromCart(item.product.id, item.isBulk)
                              }
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
            <div
              className="panel-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3>Bill Summary {redoInvoiceId ? "(Redoing Bill)" : ""}</h3>
              </div>
              {redoInvoiceId && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (onClearRedo) onClearRedo();
                    setCart([]);
                    setDiscount(0);
                    setCustomer(null);
                    setCustomerId(null);
                    setPhone("");
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="billing-summary-content">
              <div className="billing-customer">
                <div className="billing-customer-title">Customer</div>

                <div className="payment-group">
                  <label>Phone Number</label>

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Enter phone number"
                    value={phone}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                  />
                </div>

                {checkingCustomer && (
                  <div className="customer-status">Checking customer...</div>
                )}

                {customer && (
                  <div className="customer-found">
                    <span>✓</span>

                    <div>
                      <strong>{customer.name}</strong>

                      <small>{customer.phone}</small>
                    </div>
                  </div>
                )}

                {isNewCustomer && !checkingCustomer && (
                  <div className="new-customer-box">
                    <div className="customer-status">New customer</div>

                    <div className="payment-group">
                      <label>Customer Name</label>

                      <input
                        type="text"
                        placeholder="Enter customer name"
                        value={customerName}
                        onChange={(event) =>
                          setCustomerName(event.target.value)
                        }
                      />
                    </div>

                    <button
                      className="secondary-button"
                      onClick={handleCreateCustomer}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Customer"}
                    </button>
                  </div>
                )}
              </div>
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
                onClick={handleSaveInvoice}
                disabled={cart.length === 0 || saving}
              >
                {saving ? "Saving..." : "Save & Print"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
