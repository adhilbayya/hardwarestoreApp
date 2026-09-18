import { useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../database/product";
import { createInvoice, getInvoiceById } from "../../database/invoice";
import {
  getCustomerByPhone,
  createCustomer,
  type Customer,
} from "../../database/customer";

type CartItem = {
  product: Product;
  quantity: number;
};

function BillingPage() {
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
    loadProducts();
  }, []);

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

    setCart((previous) => {
      const existing = previous.find((item) => item.product.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          return previous;
        }

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
        },
      ];
    });

    setSearchTerm("");
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((previous) =>
      previous.map((item) => {
        if (item.product.id !== productId) {
          return item;
        }

        const maxQuantity = item.product.stock_quantity;

        return {
          ...item,
          quantity: Math.min(quantity, maxQuantity),
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
      (total, item) => total + item.product.selling_price * item.quantity,
      0,
    );
  }, [cart]);

  const taxAmount = useMemo(() => {
    return cart.reduce((total, item) => {
      const itemSubtotal = item.product.selling_price * item.quantity;

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
        const itemSubtotal = item.product.selling_price * item.quantity;

        const itemTax = itemSubtotal * (item.product.tax_rate / 100);

        return {
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.selling_price,
          tax_rate: item.product.tax_rate,
          tax_amount: itemTax,
          discount_amount: 0,
          line_total: itemSubtotal + itemTax,
        };
      });

      const result = await createInvoice({
        customer_id: customerId,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        grand_total: grandTotal,
        payment_method: paymentMethod,
        items,
      });

      const savedInvoice = await getInvoiceById(result.invoiceId);

      const invoiceCustomer = savedInvoice.invoice.customer_id
        ? await getCustomerByPhone(phone)
        : null;

      printInvoice(savedInvoice.invoice, savedInvoice.items, invoiceCustomer);

      setSuccessMessage(`Invoice ${result.invoiceNumber} saved successfully.`);
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
          <div className="print-header">
            <h1>HARDWARE STORE</h1>
            <p>Sales Invoice</p>
          </div>

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
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.product.id}>
                        <td>{item.product.name}</td>

                        <td>₹{item.product.selling_price.toFixed(2)}</td>

                        <td>
                          <input
                            className="quantity-input"
                            type="number"
                            min="1"
                            max={item.product.stock_quantity}
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
                          {(item.product.selling_price * item.quantity).toFixed(
                            2,
                          )}
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
                <h3>Bill Summary</h3>
              </div>
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
