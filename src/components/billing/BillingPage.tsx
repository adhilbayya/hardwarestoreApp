import React, { useEffect, useMemo, useState, useRef } from "react";
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
  searchCustomers,
  type Customer,
} from "../../database/customer";
import { updateQuotationStatus } from "../../database/quotation";
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
  convertFromQuotation,
  onClearQuotation,
}: {
  redoInvoiceId?: number | null;
  onClearRedo?: () => void;
  convertFromQuotation?: { quotationId: number; quotationData: any } | null;
  onClearQuotation?: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBrand, setSearchBrand] = useState("");
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [discount, setDiscount] = useState<number | "">(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [taxType, setTaxType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverDetails, setDriverDetails] = useState("");
  const [showTransportDetails, setShowTransportDetails] = useState(false);
  const [redoInvoiceNumber, setRedoInvoiceNumber] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function formatCurrency(amt: number) {
    return (
      "₹" +
      (amt || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<
    Customer[]
  >([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [printData, setPrintData] = useState<{
    invoice: Awaited<ReturnType<typeof getInvoiceById>>["invoice"];
    items: Awaited<ReturnType<typeof getInvoiceById>>["items"];
    customer: Customer | null;
  } | null>(null);

  const isReadyToSave = useRef(false);

  useEffect(() => {
    if (!isReadyToSave.current) return;
    if (!redoInvoiceId) {
      if (cart.length > 0) {
        const draft = {
          cart,
          customerId,
          discount,
          paymentMethod,
          taxType,
        };
        localStorage.setItem("billing_draft", JSON.stringify(draft));
      } else {
        localStorage.removeItem("billing_draft");
      }
    }
  }, [cart, customerId, discount, paymentMethod, taxType, redoInvoiceId]);

  useEffect(() => {
    if (!redoInvoiceId) {
      const saved = localStorage.getItem("billing_draft");
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.cart) setCart(draft.cart);
          if (draft.customerId !== undefined) setCustomerId(draft.customerId);
          if (draft.discount !== undefined) setDiscount(draft.discount);
          if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
          if (draft.taxType) setTaxType(draft.taxType);
        } catch (e) {}
      }
    }
    // Allow saving after initial hydration finishes
    setTimeout(() => {
      isReadyToSave.current = true;
    }, 100);
  }, []);

  useEffect(() => {
    loadProducts().then(() => {
      if (redoInvoiceId) {
        loadInvoiceForRedo(redoInvoiceId);
      }
    });
  }, [redoInvoiceId]);

  useEffect(() => {
    if (!convertFromQuotation) return;

    async function loadQuotationIntoCart() {
      if (!convertFromQuotation) return;
      try {
        setLoading(true);
        const { quotation, items } = convertFromQuotation.quotationData;

        if (quotation.customer_id) {
          const cust = await getCustomerById(quotation.customer_id);
          if (cust) {
            setCustomer(cust);
            setCustomerId(cust.id);
            setPhone(cust.phone || "");
            setCustomerName(cust.name);
          }
        } else if (quotation.customer_name) {
          setCustomerName(quotation.customer_name);
          setPhone(quotation.customer_phone || "");
        }

        setDiscount(quotation.discount_amount || 0);
        setTaxType(quotation.tax_type || "CGST_SGST");

        const allProducts = await getProducts();
        const newCart: CartItem[] = items.map((item: any) => {
          const prod = allProducts.find((p) => p.id === item.product_id);
          if (prod) {
            return {
              product: prod,
              quantity: item.quantity,
              isBulk: item.is_bulk === 1,
            };
          }
          return {
            product: {
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
              sku: null,
              brand: null,
              hsn_sac: null,
              category_id: null,
              category_name: null,
              unit_id: null,
              unit_name: null,
              unit_symbol: null,
              uom: null,
              has_bulk: 0,
              bulk_unit: null,
              bulk_conversion_rate: null,
              bulk_price: null,
              is_active: 1,
              created_at: "",
              updated_at: "",
            } as Product,
            quantity: item.quantity,
            isBulk: item.is_bulk === 1,
          };
        });
        setCart(newCart);
        setSuccessMessage(`Loaded Estimate #${quotation.quotation_number} into cart for billing.`);
      } catch (err) {
        console.error("Failed to load quotation into billing:", err);
      } finally {
        setLoading(false);
      }
    }

    loadQuotationIntoCart();
  }, [convertFromQuotation]);

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
      setVehicleNumber(invoice.vehicle_number || "");
      setDriverDetails(invoice.driver_details || "");
      setRedoInvoiceNumber(invoice.invoice_number);
      if (invoice.vehicle_number || invoice.driver_details) {
        setShowTransportDetails(true);
      }

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

  const searchResults = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const brandQ = searchBrand.trim().toLowerCase();

    if (!search && !brandQ) {
      return [];
    }

    return products
      .filter((product) => {
        const matchesSearch = search
          ? search.split(/\s+/).every((token) => {
              const cleanedToken = token.replace(/\s+/g, "");
              const cleanedName = product.name
                .toLowerCase()
                .replace(/\s+/g, "");
              return (
                cleanedName.includes(cleanedToken) ||
                (product.barcode ?? "").toLowerCase().includes(cleanedToken) ||
                (product.hsn_sac ?? "").toLowerCase().includes(cleanedToken)
              );
            })
          : true;

        const matchesBrand = brandQ
          ? (product.brand ?? "").toLowerCase().includes(brandQ)
          : true;

        return matchesSearch && matchesBrand;
      })
      .slice(0, 10);
  }, [products, searchTerm, searchBrand]);

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

  const exactTotal = Math.max(0, subtotal + taxAmount - Number(discount || 0));
  const grandTotal = Math.round(exactTotal);
  const roundOffAmount = grandTotal - exactTotal;

  async function handleCustomerSearchChange(value: string) {
    setPhone(value);
    setCustomer(null);
    setCustomerId(null);
    setCustomerName("");

    if (value.trim().length === 0) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    if (/^\d{10}$/.test(value.trim())) {
      try {
        setCheckingCustomer(true);
        const existingCustomer = await getCustomerByPhone(value.trim());
        if (existingCustomer) {
          setCustomer(existingCustomer);
          setCustomerId(existingCustomer.id);
          setShowCustomerDropdown(false);
        } else {
          setShowCustomerDropdown(false);
        }
      } catch (error) {
        console.error("Failed to find customer:", error);
      } finally {
        setCheckingCustomer(false);
      }
      return;
    }

    if (value.trim().length >= 2) {
      try {
        const results = await searchCustomers(value.trim());
        setCustomerSearchResults(results);
        setShowCustomerDropdown(true);
      } catch (err) {
        console.error("Search err", err);
      }
    } else {
      setShowCustomerDropdown(false);
    }
  }

  function selectCustomerFromDropdown(cust: Customer) {
    setPhone(cust.phone || cust.name);
    setCustomer(cust);
    setCustomerId(cust.id);
    setShowCustomerDropdown(false);
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

        const qty = typeof item.quantity === "number" ? item.quantity : 0;

        return {
          product_id: item.product.id,
          product_name: item.product.name,
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
            discount_amount: Number(discount) || 0,
            grand_total: grandTotal,
            payment_method: paymentMethod,
            notes: null,
            tax_type: taxType,
            vehicle_number: vehicleNumber || null,
            driver_details: driverDetails || null,
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
              discount_amount: Number(discount) || 0,
              grand_total: grandTotal,
              payment_method: paymentMethod,
              notes: "Recovered redone bill",
              tax_type: taxType,
              vehicle_number: vehicleNumber || null,
              driver_details: driverDetails || null,
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
          discount_amount: Number(discount) || 0,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          notes: null,
          tax_type: taxType,
          vehicle_number: vehicleNumber || null,
          driver_details: driverDetails || null,
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

      // Refresh products so stock values are updated.
      await loadProducts();

      if (convertFromQuotation) {
        try {
          await updateQuotationStatus(
            convertFromQuotation.quotationId,
            "CONVERTED",
            resultInvoiceId,
          );
        } catch (qErr) {
          console.warn("Could not mark quotation as CONVERTED:", qErr);
        }
        if (onClearQuotation) {
          onClearQuotation();
        }
      }

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

  const isSinglePagePrint = Boolean(printData && printData.items.length <= 14);

  return (
    <div>
      {printData && (
        <div
          className={`print-invoice ${
            isSinglePagePrint ? "print-single-page" : "print-multi-page"
          }`}
        >
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
                  {printData.invoice.vehicle_number ? (
                    <tr>
                      <td style={{ padding: "3px 0" }}>
                        <b>Vehicle No:</b>
                      </td>
                      <td style={{ padding: "3px 0" }}>
                        {printData.invoice.vehicle_number}
                      </td>
                    </tr>
                  ) : null}
                  {printData.invoice.driver_details ? (
                    <tr>
                      <td style={{ padding: "3px 0" }}>
                        <b>Driver:</b>
                      </td>
                      <td style={{ padding: "3px 0" }}>
                        {printData.invoice.driver_details}
                      </td>
                    </tr>
                  ) : null}
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
                <th style={{ width: "35px" }}>Sl No.</th>
                <th>Description of Goods</th>
                <th style={{ width: "80px" }}>HSN/SAC</th>
                <th style={{ width: "65px", textAlign: "center" }}>Qty</th>
                <th style={{ width: "75px", textAlign: "right" }}>Rate</th>
                <th style={{ width: "85px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, index) => {
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
                        <th
                          style={{ border: "1px solid #ddd", padding: "4px" }}
                        >
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
                              style={{
                                border: "1px solid #ddd",
                                padding: "4px",
                              }}
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
                      <b>HDFC Bank</b>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <div>A/c No:</div>
                    <div>
                      <b>50200114844792</b>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <div>Branch & IFS Code:</div>
                    <div>
                      <b>Gudalur & HDFC0006684</b>
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
                    {/* Tax Breakdown Rows */}
                    {(() => {
                      // Group taxes by tax rate
                      const taxByRate: Record<number, number> = {};
                      printData.items.forEach((item) => {
                        const rate = Number(item.tax_rate) || 0;
                        if (rate > 0) {
                          taxByRate[rate] = (taxByRate[rate] || 0) + item.tax_amount;
                        }
                      });

                      const sortedRates = Object.keys(taxByRate)
                        .map(Number)
                        .sort((a, b) => a - b);

                      if (sortedRates.length === 0 && printData.invoice.tax_amount > 0) {
                        return (
                          <tr>
                            <td style={{ padding: "4px 0" }}>Total Tax:</td>
                            <td style={{ textAlign: "right", padding: "4px 0" }}>
                              ₹{printData.invoice.tax_amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      }

                      return sortedRates.map((rate) => {
                        const totalTaxForRate = taxByRate[rate];
                        if (printData.invoice.tax_type === "CGST_SGST") {
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
                    {(() => {
                      const exactPrint =
                        printData.invoice.subtotal +
                        printData.invoice.tax_amount -
                        printData.invoice.discount_amount;
                      const printRound =
                        printData.invoice.grand_total - exactPrint;
                      if (Math.abs(printRound) >= 0.01) {
                        return (
                          <tr>
                            <td style={{ padding: "4px 0" }}>Round Off:</td>
                            <td
                              style={{ textAlign: "right", padding: "4px 0" }}
                            >
                              {printRound > 0 ? "+" : "-"} ₹
                              {Math.abs(printRound).toFixed(2)}
                            </td>
                          </tr>
                        );
                      }
                      return null;
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
              <b>Declaration:</b> 1) Goods can only be returned within 7 days of
              the purchase. 2) Subject to Nilgiris Jurisdiction Only.
              <span style={{ float: "right" }}>E. & O.E</span>
            </div>
          </div>
        </div>
      )}

      <div className="billing-page-container">
        {/* Redo Bill Alert Banner */}
        {redoInvoiceId && (
          <div className="redo-bill-banner">
            <div>
              <div className="redo-title">
                ⚠️ Redoing Invoice {redoInvoiceNumber ? `#${redoInvoiceNumber}` : `#${redoInvoiceId}`}
              </div>
              <div className="redo-sub">
                You are modifying a previously generated bill. Saving will update this invoice.
              </div>
            </div>
            <button
              type="button"
              className="secondary-button"
              style={{
                color: "#d97706",
                borderColor: "#f59e0b",
                backgroundColor: "#fff",
              }}
              onClick={() => {
                if (onClearRedo) onClearRedo();
                setCart([]);
                setDiscount(0);
                setCustomer(null);
                setCustomerId(null);
                setPhone("");
                setRedoInvoiceNumber("");
              }}
            >
              Cancel Redo
            </button>
          </div>
        )}

        {/* Header Row */}
        <div className="billing-header-row">
          <div>
            <h3>Point of Sale & Billing</h3>
            <p>Scan or search products, manage customer details, and generate tax invoices.</p>
          </div>
          <div className="invoices-summary-badge">
            <span>🛒</span>
            <span>
              {cart.length} {cart.length === 1 ? "Item" : "Items"} in Cart
            </span>
          </div>
        </div>

        <div className="billing-layout-grid">
          {/* Left Side: Products Search & Cart */}
          <div className="billing-left-column">
            {/* Search Card */}
            <div className="billing-search-card">
              <div className="billing-search-inputs-grid">
                {/* Product search box */}
                <div className="billing-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search product by name, barcode, or HSN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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

                {/* Brand filter box */}
                <div className="billing-search-box" style={{ flex: "0 0 240px" }}>
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
                    placeholder="Filter by brand..."
                    value={searchBrand}
                    onChange={(e) => {
                      setSearchBrand(e.target.value);
                      setShowBrandDropdown(true);
                    }}
                    onFocus={() => setShowBrandDropdown(true)}
                    onBlur={() => setTimeout(() => setShowBrandDropdown(false), 250)}
                  />
                  {searchBrand && (
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={() => setSearchBrand("")}
                      title="Clear brand filter"
                    >
                      ✕
                    </button>
                  )}

                  {showBrandDropdown && brandDropdownOptions.length > 0 && (
                    <div className="brand-dropdown-menu">
                      {brandDropdownOptions.map((brand, i) => (
                        <div
                          key={i}
                          className="brand-dropdown-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
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

              {/* Live Search Results */}
              {(searchTerm || searchBrand) && (
                <div className="billing-search-results-list">
                  {loading ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                      Searching products...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                      No matching products found.
                    </div>
                  ) : (
                    searchResults.map((product) => {
                      const cartItem = cart.find((c) => c.product.id === product.id);
                      const isAdded = !!cartItem;
                      const stock = product.stock_quantity;
                      const isOutOfStock = stock <= 0;
                      const isLowStock = stock > 0 && stock <= 10;
                      const priceWithTax = product.selling_price * (1 + product.tax_rate / 100);

                      return (
                        <div key={product.id} className="billing-search-item">
                          <div className="billing-item-left">
                            <div className="billing-item-title">{product.name}</div>
                            <div className="billing-item-meta">
                              {product.hsn_sac ? (
                                <span className="hsn-tag">HSN: {product.hsn_sac}</span>
                              ) : null}
                              {product.brand ? (
                                <span className="brand-tag">{product.brand}</span>
                              ) : null}
                              <span
                                className={`stock-badge-pill ${
                                  isOutOfStock
                                    ? "stock-out"
                                    : isLowStock
                                      ? "stock-low"
                                      : "stock-in"
                                }`}
                              >
                                ● {isOutOfStock ? "Out of Stock" : `${stock} ${product.unit_symbol || "Units"}`}
                              </span>
                            </div>
                          </div>

                          <div className="billing-item-right">
                            <div className="billing-item-pricing">
                              <span className="billing-item-price">
                                {formatCurrency(priceWithTax)}
                              </span>
                              <span className="billing-item-tax-note">
                                Incl. {product.tax_rate}% GST
                              </span>
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
                                ✓ In Bill
                              </span>
                            )}

                            <button
                              type="button"
                              className="add-item-btn"
                              onClick={() => addToCart(product)}
                              disabled={isOutOfStock}
                            >
                              {isOutOfStock ? "No Stock" : "+ Add"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Cart Table Card */}
            <div className="billing-cart-card">
              <div className="billing-cart-header">
                <h4>
                  <span>🛒 Current Bill</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: "#f1f5f9",
                      color: "#475569",
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
                  <div className="empty-cart-icon">🛒</div>
                  <h5>Bill is empty</h5>
                  <p>Search products or scan barcodes from the search bar above to begin billing.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="billing-cart-table">
                    <thead>
                      <tr>
                        <th style={{ width: "32px" }}>#</th>
                        <th>Product</th>
                        <th style={{ width: "100px", textAlign: "right" }}>Price</th>
                        <th style={{ width: "130px" }}>Unit / Pack</th>
                        <th style={{ width: "95px", textAlign: "center" }}>Qty</th>
                        <th style={{ width: "70px", textAlign: "center" }}>GST</th>
                        <th style={{ width: "110px", textAlign: "right" }}>Total</th>
                        <th style={{ width: "40px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => {
                        const price =
                          item.isBulk && item.product.bulk_price
                            ? item.product.bulk_price
                            : item.product.selling_price;
                        const qty = typeof item.quantity === "number" ? item.quantity : 0;
                        const lineTotal = price * qty + (price * qty * item.product.tax_rate) / 100;

                        return (
                          <tr key={`${item.product.id}-${item.isBulk}`}>
                            <td style={{ color: "#94a3b8", fontSize: "11px" }}>{index + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>
                                {item.product.name}
                              </div>
                              {item.product.hsn_sac && (
                                <div style={{ fontSize: "11px", color: "#64748b" }}>
                                  HSN: {item.product.hsn_sac}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {formatCurrency(price)}
                            </td>
                            <td>
                              {item.product.has_bulk === 1 ? (
                                <select
                                  className="unit-select-box"
                                  value={item.isBulk ? "bulk" : "base"}
                                  onChange={(e) =>
                                    updateItemUnit(
                                      item.product.id,
                                      item.isBulk,
                                      e.target.value === "bulk",
                                    )
                                  }
                                >
                                  <option value="base">
                                    {item.product.unit_symbol || item.product.unit_name || "Base"}
                                  </option>
                                  <option value="bulk">
                                    {item.product.bulk_unit || "Bulk"}
                                  </option>
                                </select>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "#475569",
                                    background: "#f1f5f9",
                                    padding: "3px 8px",
                                    borderRadius: "4px",
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.product.unit_symbol || item.product.unit_name || "NOS"}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <input
                                className="qty-input-box"
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateQuantity(item.product.id, item.isBulk, e.target.value)
                                }
                              />
                            </td>
                            <td style={{ textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                              {item.product.tax_rate}%
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
                                onClick={() => removeFromCart(item.product.id, item.isBulk)}
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

          {/* Right Side: Checkout Sidebar */}
          <div className="billing-sidebar-sticky">
            <div className="billing-summary-panel">
              <div className="billing-sidebar-title">
                <span>Checkout & Summary</span>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "normal" }}>
                  {cart.length} {cart.length === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Customer Information Card */}
              <div className="customer-search-wrap">
                <label>Customer Details</label>
                {!customer ? (
                  <>
                    <input
                      type="text"
                      className="customer-search-input-box"
                      placeholder="Search by customer phone or name..."
                      value={phone}
                      onChange={(e) => handleCustomerSearchChange(e.target.value)}
                    />

                    {showCustomerDropdown && (
                      <div className="customer-dropdown-menu">
                        {customerSearchResults.map((cust) => (
                          <div
                            key={cust.id}
                            className="customer-dropdown-item"
                            onClick={() => selectCustomerFromDropdown(cust)}
                          >
                            <span className="c-name">{cust.name}</span>
                            <span className="c-phone">📞 {cust.phone || "—"}</span>
                          </div>
                        ))}
                        {customerSearchResults.length === 0 && !checkingCustomer && (
                          <div style={{ padding: "10px", fontSize: "12px", color: "#94a3b8" }}>
                            No customer found. Enter details below to add.
                          </div>
                        )}
                      </div>
                    )}

                    {checkingCustomer && (
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Checking customer...</div>
                    )}

                    {phone.length > 0 && !checkingCustomer && (
                      <div className="new-customer-quick-card">
                        <label>New Customer Registration</label>
                        <input
                          type="text"
                          placeholder="Customer Full Name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          onClick={handleCreateCustomer}
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "+ Register Customer"}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="customer-card-selected">
                    <div>
                      <div className="c-info-name">✓ {customer.name}</div>
                      <div className="c-info-sub">📞 {customer.phone || "No phone"}</div>
                      {customer.gstin && (
                        <div style={{ fontSize: "10px", color: "#166534", marginTop: "2px" }}>
                          GSTIN: {customer.gstin}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="c-clear-btn"
                      onClick={() => {
                        setCustomer(null);
                        setCustomerId(null);
                        setPhone("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Method Segmented Tabs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.5px" }}>
                  Payment Method
                </label>
                <div className="payment-tabs-grid">
                  {[
                    { id: "Cash", label: "Cash", icon: "💵" },
                    { id: "UPI", label: "UPI", icon: "📱" },
                    { id: "Card", label: "Card", icon: "💳" },
                    { id: "Credit", label: "Credit", icon: "📝" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      className={`payment-tab-btn ${paymentMethod === pm.id ? (pm.id === "Cash" ? "active-cash" : pm.id === "Credit" ? "active-credit" : "active") : ""}`}
                      onClick={() => setPaymentMethod(pm.id)}
                    >
                      <span style={{ fontSize: "15px" }}>{pm.icon}</span>
                      <span>{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax Type Selection */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.5px" }}>
                  GST Tax Jurisdiction
                </label>
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as "CGST_SGST" | "IGST")}
                  style={{
                    height: "38px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    padding: "0 10px",
                    fontSize: "13px",
                    outline: "none",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  <option value="CGST_SGST">Intra-State (CGST 50% + SGST 50%)</option>
                  <option value="IGST">Inter-State (Full IGST)</option>
                </select>
              </div>

              {/* Financial Breakdown */}
              <div className="billing-totals-group">
                <div className="billing-totals-row">
                  <span>Taxable Subtotal:</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>
                <div className="billing-totals-row">
                  <span>GST Tax:</span>
                  <strong>{formatCurrency(taxAmount)}</strong>
                </div>
                <div className="billing-totals-row">
                  <span>Discount:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="billing-discount-input"
                      value={discount}
                      onChange={(e) =>
                        setDiscount(e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>

                {Math.abs(roundOffAmount) > 0.001 && (
                  <div className="billing-totals-row" style={{ fontSize: "12px", color: "#64748b" }}>
                    <span>Round Off:</span>
                    <span>
                      {roundOffAmount > 0 ? "+" : "-"}₹{Math.abs(roundOffAmount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Grand Total Hero Box */}
              <div className="grand-total-hero-box">
                <div className="hero-label">Total Amount Payable</div>
                <div className="hero-amount">{formatCurrency(grandTotal)}</div>
                {grandTotal > 0 && (
                  <div className="hero-words">{numberToWords(grandTotal)}</div>
                )}
              </div>

              {/* Delivery & Transport Collapsible */}
              <div>
                <button
                  type="button"
                  className="collapsible-trigger-btn"
                  onClick={() => setShowTransportDetails(!showTransportDetails)}
                >
                  <span>🚚 Transport Details (Optional)</span>
                  <span>{showTransportDetails ? "▲" : "▼"}</span>
                </button>

                {showTransportDetails && (
                  <div className="collapsible-content-box" style={{ marginTop: "8px" }}>
                    <div>
                      <label>Vehicle Number</label>
                      <input
                        type="text"
                        placeholder="e.g. TN 43 AB 1234"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label>Driver Details</label>
                      <input
                        type="text"
                        placeholder="Driver Name / Phone"
                        value={driverDetails}
                        onChange={(e) => setDriverDetails(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && <div className="form-error">{error}</div>}
              {successMessage && <div className="form-success">{successMessage}</div>}

              {/* Submit Action Button */}
              <button
                type="button"
                className="billing-submit-action-btn"
                onClick={handleSaveInvoice}
                disabled={cart.length === 0 || saving}
              >
                <span>🖨️</span>
                <span>{saving ? "Generating Bill..." : redoInvoiceId ? "Update & Print Bill" : "Save & Print Invoice"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
