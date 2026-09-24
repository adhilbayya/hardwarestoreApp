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
import { numberToWords } from "../../utils/numberToWords";
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
  const [taxType, setTaxType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
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
      setTaxType(invoice.tax_type);

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
          (product.barcode ?? "").toLowerCase().includes(search) ||
          (product.hsn_sac ?? "").toLowerCase().includes(search)
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
    } catch (error: any) {
      console.error("Failed to create customer:", error);
      setError(
        "Failed to create customer: " + (error?.message || String(error)),
      );
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
        try {
          await updateInvoice(redoInvoiceId, {
            customer_id: customerId,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: discount,
            grand_total: grandTotal,
            payment_method: paymentMethod,
            notes: null,
            tax_type: taxType,
            items,
          });
          resultInvoiceId = redoInvoiceId;
        } catch (updateError: any) {
          if (updateError.message === "Invoice not found.") {
            // The database record was somehow lost during a previous crash.
            // Automatically recover by saving it as a fresh bill.
            const result = await createInvoice({
              customer_id: customerId,
              subtotal,
              tax_amount: taxAmount,
              discount_amount: discount,
              grand_total: grandTotal,
              payment_method: paymentMethod,
              notes: "Recovered redone bill",
              tax_type: taxType,
              items,
            });
            resultInvoiceId = result.invoiceId;
            invoiceNumber = result.invoiceNumber;
          } else {
            throw updateError;
          }
        }
      } else {
        const result = await createInvoice({
          customer_id: customerId,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discount,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          notes: null,
          tax_type: taxType,
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
                  ORIGINAL
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
                      {printData.invoice.invoice_number}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Date:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {new Date(
                        printData.invoice.created_at.replace(" ", "T") + "Z",
                      ).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Payment Terms:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {printData.invoice.payment_method}
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
            {printData.customer ? (
              <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                <strong>{printData.customer.name}</strong>
                {printData.customer.address && (
                  <div>{printData.customer.address}</div>
                )}

                <div style={{ marginTop: "2px" }}>
                  {printData.customer.state_name && (
                    <span>
                      <b>State:</b> {printData.customer.state_name}{" "}
                    </span>
                  )}
                  {printData.customer.state_code && (
                    <span>
                      <b>Code:</b> {printData.customer.state_code}
                    </span>
                  )}
                </div>
                <div>
                  <b>Phone:</b> {printData.customer.phone || "-"}
                </div>
                {printData.customer.gstin && (
                  <div>
                    <b>GSTIN:</b> {printData.customer.gstin}
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
                {printData.invoice.tax_type === "CGST_SGST" ? (
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
              {printData.items.map((item, index) => {
                return (
                  <tr key={`${item.product_id}-${index}`}>
                    <td style={{ padding: "4px" }}>{index + 1}</td>
                    <td style={{ padding: "4px" }}>{item.product_name}</td>
                    <td style={{ padding: "4px" }}>{item.hsn_sac || "-"}</td>
                    <td style={{ padding: "4px" }}>{item.quantity}</td>
                    <td style={{ padding: "4px" }}>
                      ₹{item.unit_price.toFixed(2)}
                    </td>

                    {printData.invoice.tax_type === "CGST_SGST" ? (
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

          {printData.invoice.tax_amount > 0 && (
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
                    {printData.invoice.tax_type === "CGST_SGST" ? (
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
                    printData.items.reduce(
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
                        {printData.invoice.tax_type === "CGST_SGST" ? (
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
                            style={{ border: "1px solid #ddd", padding: "4px" }}
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
                {numberToWords(printData.invoice.grand_total)}
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
                      ₹{printData.invoice.subtotal.toFixed(2)}
                    </td>
                  </tr>
                  {printData.invoice.discount_amount > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0" }}>Discount:</td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "4px 0",
                          color: "red",
                        }}
                      >
                        - ₹{printData.invoice.discount_amount.toFixed(2)}
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
                      ₹{printData.invoice.grand_total.toFixed(2)}
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
                              ? (
                                  price * item.quantity +
                                  (price *
                                    item.quantity *
                                    item.product.tax_rate) /
                                    100
                                ).toFixed(2)
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

              <div className="payment-group" style={{ marginTop: "10px" }}>
                <label>Tax Type</label>

                <select
                  value={taxType}
                  onChange={(event) =>
                    setTaxType(event.target.value as "CGST_SGST" | "IGST")
                  }
                >
                  <option value="CGST_SGST">Intra-State (CGST / SGST)</option>
                  <option value="IGST">Inter-State (IGST)</option>
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
