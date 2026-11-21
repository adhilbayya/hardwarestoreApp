import React, { useEffect, useState, useMemo } from "react";
import { getSalesReport, type SalesReportRow } from "../../database/reports";
import { getInvoiceById, deleteInvoice } from "../../database/invoice";
import { getCustomerById, type Customer } from "../../database/customer";
import { confirm, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { numberToWords } from "../../utils/numberToWords";
import logo from "../../assets/logosquaregreen.jpeg";

export default function InvoicesPage({
  onRedoBill,
}: {
  onRedoBill?: (id: number) => void;
}) {
  const [sales, setSales] = useState<SalesReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activePreset, setActivePreset] = useState<
    "today" | "yesterday" | "week" | "month" | "all"
  >("month");
  const [salesSearch, setSalesSearch] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [showProfitDetails, setShowProfitDetails] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Awaited<
    ReturnType<typeof getInvoiceById>
  > | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [printInvoice, setPrintInvoice] = useState<
    | (Awaited<ReturnType<typeof getInvoiceById>> & {
        customer: Customer | null;
      })
    | null
  >(null);

  const [showEwayModal, setShowEwayModal] = useState(false);
  const [transDistance, setTransDistance] = useState("0");
  const [transMode, setTransMode] = useState("1");
  const [vehicleNo, setVehicleNo] = useState("");
  const [vehicleType, setVehicleType] = useState("R");

  const [destPincode, setDestPincode] = useState("643212");
  const [destStateCode, setDestStateCode] = useState("33");
  const [destPlace, setDestPlace] = useState("Gudalur");
  const [destAddr, setDestAddr] = useState("Tamilnadu");
  const [transporterId, setTransporterId] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [transDocNo, setTransDocNo] = useState("");
  const [transDocDate, setTransDocDate] = useState("");

  useEffect(() => {
    if (!printInvoice) return;

    const timer = setTimeout(() => {
      window.print();
    }, 300);

    const handleAfterPrint = () => {
      setPrintInvoice(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printInvoice]);

  async function loadInvoices() {
    try {
      setLoading(true);
      setError("");
      const data = await getSalesReport(fromDate, toDate);
      setSales(data);
    } catch (err) {
      console.error("Failed to load invoices:", err);
      setError("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, [fromDate, toDate]);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN");
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

  function handlePresetSelect(
    preset: "today" | "yesterday" | "week" | "month" | "all",
  ) {
    setActivePreset(preset);
    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "today") {
      const dStr = formatYMD(today);
      setFromDate(dStr);
      setToDate(dStr);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = formatYMD(y);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === "week") {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setFromDate(formatYMD(w));
      setToDate(formatYMD(today));
    } else if (preset === "month") {
      const m = new Date();
      m.setMonth(m.getMonth() - 1);
      setFromDate(formatYMD(m));
      setToDate(formatYMD(today));
    } else if (preset === "all") {
      setFromDate("2020-01-01");
      setToDate(formatYMD(today));
    }
  }

  async function handleViewInvoice(id: number) {
    try {
      const data = await getInvoiceById(id);
      let customer: Customer | null = null;
      if (data.invoice.customer_id) {
        customer = await getCustomerById(data.invoice.customer_id);
      }
      setSelectedCustomer(customer);
      setSelectedInvoice(data);
      setShowProfitDetails(false);
      setShowInvoiceDetails(true);
    } catch (error) {
      console.error("Failed to load invoice:", error);
    }
  }

  async function handleReprintInvoice() {
    if (!selectedInvoice) return;
    let customer = null;
    if (selectedInvoice.invoice.customer_id) {
      customer = await getCustomerById(selectedInvoice.invoice.customer_id);
    }
    setPrintInvoice({ ...selectedInvoice, customer });
  }

  async function handleDeleteInvoice(id: number) {
    const isConfirmed = await confirm(
      "Are you sure you want to completely delete this bill? This action cannot be undone.",
      { title: "Delete Bill", kind: "warning" },
    );
    if (!isConfirmed) return;

    try {
      await deleteInvoice(id);
      setShowInvoiceDetails(false);
      setSelectedInvoice(null);
      loadInvoices();
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      alert("Failed to delete invoice.");
    }
  }

  // Map of 2-digit PIN code prefix to GST State Code
  const getStateFromPincode = (pincode: string | number): number | null => {
    const pinStr = String(pincode).trim();
    if (pinStr.length < 2) return null;
    const prefix2 = parseInt(pinStr.substring(0, 2), 10);
    // Tamil Nadu: 60-64, Puducherry: 605xxx
    if (prefix2 >= 60 && prefix2 <= 64) {
      if (pinStr.startsWith("605")) return 34; // Puducherry
      return 33; // Tamil Nadu
    }
    // Kerala: 67-69, Lakshadweep: 682xxx
    if (prefix2 >= 67 && prefix2 <= 69) {
      if (pinStr.startsWith("682")) return 31; // Lakshadweep
      return 32; // Kerala
    }
    // Karnataka: 56-59
    if (prefix2 >= 56 && prefix2 <= 59) return 29;
    // Andhra Pradesh: 51-53
    if (prefix2 >= 51 && prefix2 <= 53) return 37;
    // Telangana: 50
    if (prefix2 === 50) return 36;
    // Maharashtra: 40-44, Goa: 403xxx
    if (prefix2 >= 40 && prefix2 <= 44) {
      if (pinStr.startsWith("403")) return 30; // Goa
      return 27; // Maharashtra
    }
    // Gujarat: 36-39
    if (prefix2 >= 36 && prefix2 <= 39) return 24;
    // Rajasthan: 30-34
    if (prefix2 >= 30 && prefix2 <= 34) return 8;
    // Punjab: 14-16, Chandigarh: 160xxx
    if (prefix2 >= 14 && prefix2 <= 16) {
      if (pinStr.startsWith("160")) return 4; // Chandigarh
      return 3; // Punjab
    }
    // Haryana: 12-13
    if (prefix2 >= 12 && prefix2 <= 13) return 6;
    // Delhi: 11
    if (prefix2 === 11) return 7;
    // UP: 20-28, Uttarakhand: 24xxxx-26xxxx
    if (prefix2 >= 20 && prefix2 <= 28) return 9;
    // West Bengal: 70-74
    if (prefix2 >= 70 && prefix2 <= 74) return 19;
    // Odisha: 75-77
    if (prefix2 >= 75 && prefix2 <= 77) return 21;
    // Bihar: 80-85
    if (prefix2 >= 80 && prefix2 <= 85) return 10;
    // Jharkhand: 81-83
    if (prefix2 >= 81 && prefix2 <= 83) return 20;
    // Madhya Pradesh: 45-48
    if (prefix2 >= 45 && prefix2 <= 48) return 23;
    // Chhattisgarh: 49
    if (prefix2 === 49) return 22;
    // Assam: 78
    if (prefix2 === 78) return 18;
    return null;
  };

  async function handleExportEway() {
    if (!selectedInvoice) return;

    let customerGstin = "URP";
    let customerName = "Unregistered";
    let toStateCode = parseInt(destStateCode) || 33;
    let toPincode = parseInt(destPincode) || 643212;
    let customerAddr1 = destAddr.trim() || "Tamilnadu";
    let customerPlace = destPlace.trim() || "Gudalur";

    if (selectedInvoice.invoice.customer_id) {
      const cust = await getCustomerById(selectedInvoice.invoice.customer_id);
      if (cust) {
        customerName = cust.name || customerName;
        customerGstin =
          cust.gstin && cust.gstin.trim() !== "" ? cust.gstin.trim().toUpperCase() : "URP";
        if (cust.gstin && cust.gstin.length >= 2 && !destStateCode) {
          toStateCode = parseInt(cust.gstin.substring(0, 2)) || 33;
        }
        if (cust.address && !destAddr) {
          customerAddr1 = cust.address.trim();
        }
        if (cust.state_name && !destPlace) {
          customerPlace = cust.state_name.trim();
        }
      }
    }

    const fromPincode = 643212;
    const distanceVal = parseInt(transDistance) || 0;

    // --- FUTURE-PROOFING SAFEGUARDS ---
    // 1. Destination Pincode Validation
    if (!toPincode || !/^\d{6}$/.test(String(toPincode))) {
      alert("Invalid Destination PIN Code. A valid 6-digit PIN code is required by the GST portal (e.g. 643212).");
      return;
    }

    // 2. Intra-city distance check
    if (fromPincode === toPincode) {
      if (distanceVal <= 0 || distanceVal > 100) {
        alert(
          "Source and destination PIN codes are both 643212 (intra-city).\nThe E-Way portal requires distance between 1 and 100 KM for identical PIN codes (e.g. 5, 10, or 20 KM)."
        );
        return;
      }
    } else {
      if (distanceVal < 0 || distanceVal > 4000) {
        alert("Please enter a valid transport distance between 0 and 4000 KM (or enter 0 to let the portal auto-calculate).");
        return;
      }
    }

    // 3. State Code Validation
    if (!toStateCode || toStateCode < 1 || toStateCode > 38) {
      alert("Invalid Destination State Code. Please enter a valid 2-digit GST state code (e.g. 33 for Tamil Nadu, 32 for Kerala).");
      return;
    }

    // 4. Vehicle Number Format Cleanup (Road transport)
    let cleanVehicleNo = vehicleNo ? vehicleNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
    if (cleanVehicleNo && cleanVehicleNo.length < 4) {
      alert("Vehicle Number seems too short. Format should resemble TN43AB1234 or DL1A1234.");
      return;
    }

    // 5. Customer Place
    if (!customerPlace || customerPlace.trim() === "") {
      customerPlace = "Gudalur";
    }

    // Official GST E-Way Bill Master UQC List
    const VALID_EWAY_UQCS = new Set([
      "BAG", "BAL", "BDL", "BKL", "BOU", "BOX", "BTL", "BUN", "CAN", "CBM",
      "CCM", "CMS", "CTN", "DOZ", "DRM", "GGK", "GMS", "GRS", "GYD", "KGS",
      "KLR", "KME", "MLT", "MTR", "MTS", "NOS", "PAC", "PCS", "PRS", "QTL",
      "ROL", "SET", "SQF", "SQM", "SQY", "TBS", "TGM", "THD", "TON", "TUB",
      "UGS", "UNT", "YDS", "OTH",
    ]);

    const UQC_LOOKUP: Record<string, string> = {
      NO: "NOS",
      NOS: "NOS",
      NUMBER: "NOS",
      NUMBERS: "NOS",
      PC: "PCS",
      PCS: "PCS",
      PIECE: "PCS",
      PIECES: "PCS",
      UNIT: "UNT",
      UNITS: "UNT",
      UNT: "UNT",
      KG: "KGS",
      KGS: "KGS",
      KILO: "KGS",
      KILOGRAM: "KGS",
      KILOGRAMS: "KGS",
      M: "MTR",
      MTR: "MTR",
      MTRS: "MTR",
      METER: "MTR",
      METERS: "MTR",
      METRE: "MTR",
      METRES: "MTR",
      BOX: "BOX",
      BOXES: "BOX",
      PAC: "PAC",
      PACK: "PAC",
      PACKET: "PAC",
      PACKETS: "PAC",
      PKT: "PAC",
      PKTS: "PAC",
      SET: "SET",
      SETS: "SET",
      ROLL: "ROL",
      ROLLS: "ROL",
      ROL: "ROL",
      BDL: "BDL",
      BUNDLE: "BDL",
      BUNDLES: "BDL",
      BNDL: "BDL",
      BTL: "BTL",
      BOTTLE: "BTL",
      BOTTLES: "BTL",
      BAG: "BAG",
      BAGS: "BAG",
      CTN: "CTN",
      CARTON: "CTN",
      CARTONS: "CTN",
      CAN: "CAN",
      CANS: "CAN",
      DOZ: "DOZ",
      DOZEN: "DOZ",
      DOZENS: "DOZ",
      GMS: "GMS",
      GRAM: "GMS",
      GRAMS: "GMS",
      LTR: "KLR",
      LITRE: "KLR",
      LITER: "KLR",
      LITRES: "KLR",
      LITERS: "KLR",
      TON: "TON",
      TONS: "TON",
      TONNE: "TON",
      TONNES: "TON",
      FT: "MTR",
      FEET: "MTR",
      FOOT: "MTR",
      RUNNINGFEET: "MTR",
      RFT: "MTR",
      SQFT: "SQF",
      SQF: "SQF",
      SQM: "SQM",
      SQMTR: "SQM",
      OTH: "OTH",
      OTHER: "OTH",
      OTHERS: "OTH",
    };

    const getGstUqc = (rawUnit?: string | null): string => {
      if (!rawUnit) return "NOS";
      const cleaned = rawUnit.trim().toUpperCase().replace(/[^A-Z]/g, "");
      if (UQC_LOOKUP[cleaned]) return UQC_LOOKUP[cleaned];
      if (VALID_EWAY_UQCS.has(cleaned)) return cleaned;
      if (cleaned.length >= 3 && VALID_EWAY_UQCS.has(cleaned.substring(0, 3))) {
        return cleaned.substring(0, 3);
      }
      return "OTH";
    };

    // Calculate invoice discount ratio if an overall discount exists
    const invSubtotal = Number(selectedInvoice.invoice.subtotal) || 0;
    const invDiscount = Number(selectedInvoice.invoice.discount_amount) || 0;
    const discountRatio =
      invDiscount > 0 && invSubtotal > 0
        ? Math.max(0, (invSubtotal - invDiscount) / invSubtotal)
        : 1;

    // 1. Format each item with strict 2-decimal numbers and net assessable value
    const itemsList = selectedInvoice.items.map((item, index) => {
      const grossAmount = Number(item.line_total) || 0;
      // Taxable amount must be assessable value after item-proportionate discount
      const taxableAmount = Number((grossAmount * discountRatio).toFixed(2));
      const isIgst = selectedInvoice.invoice.tax_type === "IGST";
      const taxRate = Number(item.tax_rate) || 0;

      const cleanHsn = item.hsn_sac ? String(item.hsn_sac).replace(/[^0-9]/g, "") : "";
      const hsnCode = cleanHsn ? parseInt(cleanHsn, 10) : 8413;

      const qty = Number(item.quantity) || 1;
      const unit = getGstUqc(item.unit_symbol);

      return {
        itemNo: index + 1,
        productName: item.product_name || "Item",
        productDesc: item.product_name || "Item",
        hsnCode: hsnCode,
        quantity: qty,
        qtyUnit: unit,
        taxableAmount: taxableAmount,
        sgstRate: isIgst ? 0 : Number((taxRate / 2).toFixed(2)),
        cgstRate: isIgst ? 0 : Number((taxRate / 2).toFixed(2)),
        igstRate: isIgst ? Number(taxRate.toFixed(2)) : 0,
        cessRate: 0,
        cessNonAdvol: 0,
      };
    });

    // 2. CRITICAL: Total Taxable Value MUST strictly equal the sum of item-wise taxableAmounts
    const totalValue = Number(
      itemsList.reduce((sum, item) => sum + item.taxableAmount, 0).toFixed(2),
    );

    const dateObj = new Date(selectedInvoice.invoice.invoice_date);
    const docYear = dateObj.getFullYear();
    const docMonth = String(dateObj.getMonth() + 1).padStart(2, "0");
    const docDay = String(dateObj.getDate()).padStart(2, "0");
    const docDateStr = `${docDay}/${docMonth}/${docYear}`;

    const totInvValue = Number(
      (Number(selectedInvoice.invoice.grand_total) || 0).toFixed(2),
    );

    // Calculate item-level taxes accurately from discounted taxable amounts
    let itemCgstSum = 0;
    let itemSgstSum = 0;
    let itemIgstSum = 0;

    itemsList.forEach((it) => {
      if (selectedInvoice.invoice.tax_type === "IGST") {
        itemIgstSum += Number(((it.taxableAmount * it.igstRate) / 100).toFixed(2));
      } else {
        itemCgstSum += Number(((it.taxableAmount * it.cgstRate) / 100).toFixed(2));
        itemSgstSum += Number(((it.taxableAmount * it.sgstRate) / 100).toFixed(2));
      }
    });

    const cgstValue = Number(itemCgstSum.toFixed(2));
    const sgstValue = Number(itemSgstSum.toFixed(2));
    const igstValue = Number(itemIgstSum.toFixed(2));

    // OthValue must never be negative on the GST e-Way Bill portal (Error 620/628/633)
    const rawOth = Number(
      (totInvValue - (totalValue + cgstValue + sgstValue + igstValue)).toFixed(2),
    );
    const OthValue = Math.max(0, rawOth);

    const mainHsnCode = itemsList.length > 0 ? itemsList[0].hsnCode : 8413;

    const ewayJson = {
      version: "1.0.0621",
      billLists: [
        {
          userGstin: "33BHFPM8521H1ZE",
          supplyType: "O",
          subSupplyType: 1,
          docType: "INV",
          docNo: selectedInvoice.invoice.invoice_number,
          docDate: docDateStr,
          transType: 1,
          transactionType: 1,
          fromGstin: "33BHFPM8521H1ZE",
          fromTrdName: "NILGIRI PUMPS AND FITTINGS",
          fromAddr1: "11/339A3, Calicut Road",
          fromAddr2: "Gudalur, Nilgiris",
          fromPlace: "Gudalur",
          fromPincode: fromPincode,
          actFromStateCode: 33,
          fromStateCode: 33,
          actualFromStateCode: 33,
          toGstin: customerGstin,
          toTrdName: customerName,
          toAddr1: customerAddr1,
          toAddr2: "",
          toPlace: customerPlace,
          toPincode: toPincode,
          actToStateCode: toStateCode,
          toStateCode: toStateCode,
          actualToStateCode: toStateCode,
          totalValue: totalValue,
          cgstValue: cgstValue,
          sgstValue: sgstValue,
          igstValue: igstValue,
          cessValue: 0.0,
          TotNonAdvolVal: 0.0,
          OthValue: OthValue,
          totInvValue: totInvValue,
          transMode: parseInt(transMode) || 1,
          transDistance: distanceVal,
          transporterName: transporterName || "",
          transporterId: transporterId || "",
          transDocNo: transDocNo || "",
          transDocDate: transDocDate || undefined,
          vehicleNo: cleanVehicleNo,
          vehicleType: vehicleType || "R",
          mainHsnCode: mainHsnCode,
          itemList: itemsList,
        },
      ],
    };

    try {
      const suggestedFilename = `EWAY_${selectedInvoice.invoice.invoice_number}.json`;
      const savePath = await saveDialog({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
        defaultPath: suggestedFilename,
      });

      if (savePath) {
        const content = JSON.stringify(ewayJson, null, 2);
        await invoke("save_csv_file", { path: savePath, content });
        alert("E-Way Bill JSON generated successfully!");
        setShowEwayModal(false);
      }
    } catch (err) {
      console.error("Failed to generate JSON", err);
      alert("Failed to generate E-Way bill JSON");
    }
  }

  const filteredSales = sales.filter(
    (s) =>
      s.invoice_number.toLowerCase().includes(salesSearch.toLowerCase()) ||
      (s.customer_name || "")
        .toLowerCase()
        .includes(salesSearch.toLowerCase()) ||
      (s.customer_phone || "").includes(salesSearch) ||
      formatDate(s.invoice_date).includes(salesSearch),
  );

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalTax = 0;
    let cashTotal = 0;
    let onlineTotal = 0;
    let creditTotal = 0;

    for (const s of filteredSales) {
      totalRevenue += s.grand_total;
      totalTax += s.tax_amount;
      const m = (s.payment_method || "").toLowerCase();

      const paid =
        s.paid_amount !== undefined && s.paid_amount !== null
          ? Number(s.paid_amount)
          : m === "credit"
            ? 0
            : s.grand_total;

      const balance =
        s.balance_amount !== undefined && s.balance_amount !== null
          ? Number(s.balance_amount)
          : m === "credit"
            ? s.grand_total
            : 0;

      creditTotal += balance;

      if (m === "cash") {
        cashTotal += paid;
      } else if (m === "credit") {
        // no paid amount
      } else if (m.startsWith("partial")) {
        // Check if paid via UPI or Card in notes, otherwise default to cash
        if (s.notes?.includes("via UPI") || s.notes?.includes("via Card")) {
          onlineTotal += paid;
        } else {
          cashTotal += paid;
        }
      } else {
        // UPI, Card, Net Banking, etc.
        onlineTotal += paid;
      }
    }

    return {
      totalRevenue,
      totalTax,
      cashTotal,
      onlineTotal,
      creditTotal,
      count: filteredSales.length,
    };
  }, [filteredSales]);

  return (
    <>
      <div className="invoices-page-container">
      {/* Header Row */}
      <div className="invoices-header-row">
        <div>
          <h3>Invoices & Billing History</h3>
          <p>
            Search, inspect, reprint, or manage all generated invoices and credit bills.
          </p>
        </div>
        <div className="invoices-summary-badge">
          <span>🧾</span>
          <span>
            {stats.count} {stats.count === 1 ? "Bill" : "Bills"} in View
          </span>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="invoices-stats-grid">
        <div className="invoice-stat-card">
          <div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">{formatCurrency(stats.totalRevenue)}</div>
            <div className="stat-sub">Across {stats.count} bills</div>
          </div>
          <div className="invoice-stat-icon stat-icon-blue">₹</div>
        </div>

        <div className="invoice-stat-card">
          <div>
            <div className="stat-label">Cash Collected</div>
            <div className="stat-value">{formatCurrency(stats.cashTotal)}</div>
            <div className="stat-sub">Cash in register</div>
          </div>
          <div className="invoice-stat-icon stat-icon-green">💵</div>
        </div>

        <div className="invoice-stat-card">
          <div>
            <div className="stat-label">UPI & Digital</div>
            <div className="stat-value">{formatCurrency(stats.onlineTotal)}</div>
            <div className="stat-sub">Bank & Online transfer</div>
          </div>
          <div className="invoice-stat-icon stat-icon-blue">📱</div>
        </div>

        <div className="invoice-stat-card">
          <div>
            <div className="stat-label">Credit / Pending</div>
            <div className="stat-value">{formatCurrency(stats.creditTotal)}</div>
            <div className="stat-sub">Unsettled accounts</div>
          </div>
          <div className="invoice-stat-icon stat-icon-amber">📝</div>
        </div>
      </div>

      {/* Filter and Date Presets Card */}
      <div className="invoices-filter-card">
        {/* Quick Date Presets */}
        <div className="invoices-presets-bar">
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748b",
              marginRight: "4px",
            }}
          >
            Period:
          </span>
          <button
            type="button"
            className={`invoices-preset-btn ${activePreset === "today" ? "active" : ""}`}
            onClick={() => handlePresetSelect("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={`invoices-preset-btn ${activePreset === "yesterday" ? "active" : ""}`}
            onClick={() => handlePresetSelect("yesterday")}
          >
            Yesterday
          </button>
          <button
            type="button"
            className={`invoices-preset-btn ${activePreset === "week" ? "active" : ""}`}
            onClick={() => handlePresetSelect("week")}
          >
            Past 7 Days
          </button>
          <button
            type="button"
            className={`invoices-preset-btn ${activePreset === "month" ? "active" : ""}`}
            onClick={() => handlePresetSelect("month")}
          >
            Past 30 Days
          </button>
          <button
            type="button"
            className={`invoices-preset-btn ${activePreset === "all" ? "active" : ""}`}
            onClick={() => handlePresetSelect("all")}
          >
            All Time
          </button>
        </div>

        {/* Search and Date Inputs */}
        <div className="invoices-filter-inputs">
          <div className="invoices-search-field">
            <label>Search Bills</label>
            <div className="invoices-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by invoice #, customer name, phone..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
              />
              {salesSearch && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => setSalesSearch("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="invoices-date-field">
            <label>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset("" as any);
              }}
            />
          </div>

          <div className="invoices-date-field">
            <label>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset("" as any);
              }}
            />
          </div>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* Invoices Table Card */}
      <div className="invoices-table-card">
        <div className="invoices-table-header">
          <h4>Generated Invoices</h4>
          <span>
            Showing {filteredSales.length}{" "}
            {filteredSales.length === 1 ? "record" : "records"}
          </span>
        </div>

        {loading ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Loading invoices...
          </div>
        ) : (
          <table className="invoices-table">
            <thead>
              <tr>
                <th style={{ width: "130px" }}>Invoice No</th>
                <th>Customer</th>
                <th style={{ width: "110px" }}>Date</th>
                <th style={{ width: "100px", textAlign: "center" }}>Payment</th>
                <th className="col-right" style={{ width: "110px" }}>
                  Tax Amount
                </th>
                <th className="col-right" style={{ width: "120px" }}>
                  Grand Total
                </th>
                <th className="col-center" style={{ width: "90px" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="invoice-row"
                  onClick={() => handleViewInvoice(sale.id)}
                >
                  <td>
                    <span className="invoice-badge-mono">
                      {sale.invoice_number}
                    </span>
                  </td>
                  <td>
                    <div className="customer-cell">
                      <span className="customer-name">
                        {sale.customer_name || "Walk-in Customer"}
                      </span>
                      {sale.customer_phone && (
                        <span className="customer-phone">
                          📞 {sale.customer_phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: "#475569" }}>
                    {formatDate(sale.invoice_date)}
                  </td>
                  <td className="col-center">
                    <span
                      className={`payment-badge ${
                        (sale.payment_method || "cash").toLowerCase()
                      }`}
                      style={{ fontSize: "11px", fontWeight: 700 }}
                    >
                      {sale.payment_method}
                    </span>
                    {sale.balance_amount !== undefined &&
                      sale.balance_amount !== null &&
                      sale.balance_amount > 0 && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#c2410c",
                            fontWeight: 700,
                            marginTop: "2px",
                          }}
                        >
                          Due: ₹{sale.balance_amount.toFixed(2)}
                        </div>
                      )}
                  </td>
                  <td className="col-right" style={{ color: "#64748b" }}>
                    {formatCurrency(sale.tax_amount)}
                  </td>
                  <td
                    className="col-right"
                    style={{ fontWeight: 700, color: "#0f172a" }}
                  >
                    {formatCurrency(sale.grand_total)}
                  </td>
                  <td className="col-center">
                    <span className="view-action-pill">👁️ View</span>
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "48px 20px",
                      color: "#94a3b8",
                      fontSize: "14px",
                    }}
                  >
                    No matching invoices found in this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoice Details Modal */}
      {showInvoiceDetails && selectedInvoice && (
        <div
          className="modal-overlay"
          onClick={() => setShowInvoiceDetails(false)}
        >
          <div
            className="modal invoice-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  className="invoice-badge-mono"
                  style={{ fontSize: "14px", padding: "4px 10px" }}
                >
                  {selectedInvoice.invoice.invoice_number}
                </span>
                <span
                  className={`payment-badge ${
                    (selectedInvoice.invoice.payment_method || "cash").toLowerCase()
                  }`}
                  style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}
                >
                  {selectedInvoice.invoice.payment_method}
                </span>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowInvoiceDetails(false)}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                maxHeight: "75vh",
                overflowY: "auto",
                padding: "20px",
              }}
            >
              {/* Customer and Logistics Info Cards */}
              <div className="invoice-detail-cards">
                <div className="invoice-info-card">
                  <div className="invoice-info-card-title">
                    Customer Information
                  </div>
                  <div className="invoice-info-item">
                    <strong>Name</strong>
                    <span>{selectedCustomer?.name || "Walk-in Customer"}</span>
                  </div>
                  <div className="invoice-info-item">
                    <strong>Phone</strong>
                    <span>{selectedCustomer?.phone || "—"}</span>
                  </div>
                  <div className="invoice-info-item">
                    <strong>GSTIN</strong>
                    <span>{selectedCustomer?.gstin || "URP (Unregistered)"}</span>
                  </div>
                  {selectedCustomer?.address && (
                    <div className="invoice-info-item">
                      <strong>Address</strong>
                      <span style={{ maxWidth: "60%", textAlign: "right" }}>
                        {selectedCustomer.address}
                      </span>
                    </div>
                  )}
                </div>

                <div className="invoice-info-card">
                  <div className="invoice-info-card-title">
                    Invoice & Logistics
                  </div>
                  <div className="invoice-info-item">
                    <strong>Invoice Date</strong>
                    <span>
                      {formatDate(selectedInvoice.invoice.invoice_date)}
                    </span>
                  </div>
                  <div className="invoice-info-item">
                    <strong>Payment Mode</strong>
                    <span>{selectedInvoice.invoice.payment_method}</span>
                  </div>
                  <div className="invoice-info-item">
                    <strong>Tax Type</strong>
                    <span>
                      {selectedInvoice.invoice.tax_type === "IGST"
                        ? "Interstate (IGST)"
                        : "Intrastate (CGST+SGST)"}
                    </span>
                  </div>
                  {selectedInvoice.invoice.vehicle_number && (
                    <div className="invoice-info-item">
                      <strong>Vehicle No</strong>
                      <span>{selectedInvoice.invoice.vehicle_number}</span>
                    </div>
                  )}
                  {selectedInvoice.invoice.driver_details && (
                    <div className="invoice-info-item">
                      <strong>Driver Details</strong>
                      <span>{selectedInvoice.invoice.driver_details}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                  padding: "0 2px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#64748b",
                  }}
                >
                  Items ({selectedInvoice.items.length})
                </span>
                {selectedInvoice.items.length > 5 && (
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Scroll to view all items ({selectedInvoice.items.length}) ↓
                  </span>
                )}
              </div>
              <div className="invoice-modal-table-card">
                <table className="invoice-modal-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>#</th>
                      <th style={{ textAlign: "left" }}>Product</th>
                      <th style={{ textAlign: "center" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Price</th>
                      <th style={{ textAlign: "right" }}>Tax</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={item.product_id + "-" + idx}>
                        <td style={{ color: "#94a3b8", width: "24px" }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {item.product_name}
                          {item.hsn_sac && (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "#94a3b8",
                                marginLeft: "6px",
                              }}
                            >
                              HSN: {item.hsn_sac}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {item.quantity}{" "}
                          {item.is_bulk === 1 && item.bulk_unit
                            ? `(${item.bulk_unit})`
                            : item.unit_symbol
                              ? `(${item.unit_symbol})`
                              : ""}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatCurrency(item.tax_amount)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {formatCurrency(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="invoice-modal-totals-card">
                <div className="invoice-modal-totals-row">
                  <span>Subtotal:</span>
                  <strong>
                    {formatCurrency(selectedInvoice.invoice.subtotal)}
                  </strong>
                </div>
                <div className="invoice-modal-totals-row">
                  <span>GST Amount:</span>
                  <strong>
                    {formatCurrency(selectedInvoice.invoice.tax_amount)}
                  </strong>
                </div>
                {selectedInvoice.invoice.discount_amount > 0 && (
                  <div
                    className="invoice-modal-totals-row"
                    style={{ color: "#16a34a" }}
                  >
                    <span>Discount:</span>
                    <strong>
                      -{formatCurrency(selectedInvoice.invoice.discount_amount)}
                    </strong>
                  </div>
                )}
                <div className="invoice-modal-totals-row grand">
                  <span>Grand Total:</span>
                  <span>
                    {formatCurrency(selectedInvoice.invoice.grand_total)}
                  </span>
                </div>
                {selectedInvoice.invoice.balance_amount !== undefined &&
                  selectedInvoice.invoice.balance_amount !== null &&
                  selectedInvoice.invoice.balance_amount > 0 && (
                    <>
                      <div className="invoice-modal-totals-row" style={{ color: "#059669", fontWeight: 600 }}>
                        <span>Amount Paid ({selectedInvoice.invoice.payment_method}):</span>
                        <span>{formatCurrency(selectedInvoice.invoice.paid_amount ?? 0)}</span>
                      </div>
                      <div className="invoice-modal-totals-row" style={{ color: "#dc2626", fontWeight: 700 }}>
                        <span>Balance Due (Credit):</span>
                        <span>{formatCurrency(selectedInvoice.invoice.balance_amount)}</span>
                      </div>
                    </>
                  )}
                {(() => {
                  // Calculate item-by-item cost:
                  // In invoice_items:
                  // item.cost_price is the cost per BASE unit (stored from product.average_cost / purchase_price).
                  // item.quantity is the sold quantity in selected unit (e.g. 5 boxes or 10 loose pieces).
                  // If item.is_bulk === 1, item.bulk_multiplier represents how many base units are in 1 bulk unit.
                  // However, if cost_price was already for the bulk item or base item, let's normalize:
                  // Specifically: if cost_price * (item.is_bulk ? item.bulk_multiplier : 1) exceeds unit_price by an order of magnitude (common if cost_price was entered as the package cost), we guard against double-multiplication.
                  const itemBreakdowns = selectedInvoice.items.map((item) => {
                    const qty = Number(item.quantity) || 0;
                    const mult = item.is_bulk === 1 ? Number(item.bulk_multiplier) || 1 : 1;
                    const recordedCost = Number(item.cost_price) || 0;
                    const unitPrice = Number(item.unit_price) || 0;
                    const liveCost = Number(item.current_average_cost ?? item.current_purchase_price ?? recordedCost) || recordedCost;

                    // Use updated live cost if it exists and is valid, or if recorded cost was improperly higher than unit_price
                    let rawCost = recordedCost;
                    if (liveCost > 0 && (recordedCost === 0 || recordedCost > unitPrice || liveCost < recordedCost)) {
                      rawCost = liveCost;
                    }

                    // Determine effective unit cost:
                    // If cost_price * mult > unitPrice * 1.5 and rawCost <= unitPrice * 1.5,
                    // rawCost was already the pack cost, so don't multiply by mult again!
                    let lineCost = 0;
                    if (item.is_bulk === 1 && mult > 1) {
                      if (rawCost * mult > unitPrice * 2 && rawCost <= unitPrice * 1.2) {
                        // rawCost was already per-bulk-pack
                        lineCost = qty * rawCost;
                      } else {
                        // rawCost is per base unit, so multiply by mult
                        lineCost = qty * mult * rawCost;
                      }
                    } else {
                      lineCost = qty * rawCost;
                    }

                    const lineRevenue = item.line_total; // taxable line total
                    const lineProfit = lineRevenue - lineCost;
                    return {
                      name: item.product_name,
                      qty,
                      unitPrice,
                      lineRevenue,
                      rawCost,
                      mult,
                      lineCost,
                      lineProfit,
                    };
                  });

                  const totalCost = itemBreakdowns.reduce((acc, i) => acc + i.lineCost, 0);
                  const netSales =
                    selectedInvoice.invoice.subtotal -
                    selectedInvoice.invoice.discount_amount;
                  const finalP = netSales - totalCost;
                  const marginPct = netSales > 0 ? (finalP / netSales) * 100 : 0;

                  return (
                    <div style={{ marginTop: "4px" }}>
                      <div
                        style={{
                          textAlign: "right",
                          fontSize: "10px",
                          color: "#94a3b8",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        onClick={() => setShowProfitDetails(!showProfitDetails)}
                        title="Click to view itemized profit & cost breakdown"
                      >
                        p:{" "}
                        <span style={{ color: finalP >= 0 ? "#16a34a" : "#ef4444", fontWeight: 600 }}>
                          {finalP >= 0
                            ? formatCurrency(finalP)
                            : `-${formatCurrency(Math.abs(finalP))}`}
                        </span>
                        <span style={{ color: "#cbd5e1", marginLeft: "4px" }}>
                          ({marginPct.toFixed(1)}%)
                        </span>
                      </div>

                      {showProfitDetails && (
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "6px 8px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            fontSize: "10px",
                            textAlign: "left",
                            maxHeight: "150px",
                            overflowY: "auto",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "#475569", marginBottom: "4px", fontSize: "10px" }}>
                            Item-wise Profit Breakdown:
                          </div>
                          {itemBreakdowns.map((ib, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "2px 0",
                                borderBottom: "1px dashed #f1f5f9",
                                color: "#64748b",
                              }}
                            >
                              <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {ib.name} (x{ib.qty})
                              </span>
                              <span>
                                Cost: ₹{ib.lineCost.toFixed(2)} →{" "}
                                <strong style={{ color: ib.lineProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                                  {ib.lineProfit >= 0 ? "+" : ""}₹{ib.lineProfit.toFixed(2)}
                                </strong>
                              </span>
                            </div>
                          ))}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: "4px",
                              paddingTop: "4px",
                              borderTop: "1px solid #e2e8f0",
                              fontWeight: 700,
                              color: "#334155",
                            }}
                          >
                            <span>Total Cost: ₹{totalCost.toFixed(2)}</span>
                            <span>Net Sales: ₹{netSales.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div
              className="modal-actions"
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                padding: "16px 20px",
                borderTop: "1px solid #e2e8f0",
                backgroundColor: "#fff",
                borderBottomLeftRadius: "16px",
                borderBottomRightRadius: "16px",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                {onRedoBill && (
                  <>
                    <button
                      className="secondary-button"
                      style={{ color: "#d97706", borderColor: "#f59e0b" }}
                      onClick={async () => {
                        const isConfirmed = await confirm(
                          "Are you sure you want to redo this bill? This will discard the current bill and let you edit it.",
                          { title: "Redo Bill", kind: "warning" },
                        );
                        if (isConfirmed) {
                          setShowInvoiceDetails(false);
                          onRedoBill(selectedInvoice.invoice.id);
                        }
                      }}
                    >
                      Redo Bill
                    </button>

                    <button
                      className="secondary-button"
                      style={{ color: "#ef4444", borderColor: "#ef4444" }}
                      onClick={() =>
                        handleDeleteInvoice(selectedInvoice.invoice.id)
                      }
                    >
                      Delete Bill
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="secondary-button"
                  onClick={async () => {
                    if (
                      selectedInvoice &&
                      selectedInvoice.invoice.customer_id
                    ) {
                      const cust = await getCustomerById(
                        selectedInvoice.invoice.customer_id,
                      );
                      if (cust) {
                        let detectedState = "";
                        let detectedPin = "";

                        if (cust.address) {
                          setDestAddr(cust.address);
                          const pinMatch = cust.address.match(/\b\d{6}\b/);
                          if (pinMatch) {
                            detectedPin = pinMatch[0];
                            setDestPincode(detectedPin);
                          }
                        }

                        if (cust.gstin && cust.gstin.length >= 2) {
                          detectedState = cust.gstin.substring(0, 2);
                        } else if (cust.state_code) {
                          detectedState = cust.state_code;
                        } else if (detectedPin) {
                          const autoState = getStateFromPincode(detectedPin);
                          if (autoState) detectedState = String(autoState);
                        } else if (cust.address && /kerala/i.test(cust.address)) {
                          detectedState = "32";
                        } else if (cust.address && /tamil\s*nadu/i.test(cust.address)) {
                          detectedState = "33";
                        } else if (cust.address && /karnataka/i.test(cust.address)) {
                          detectedState = "29";
                        }

                        // Also check invoice tax type: if IGST and no state detected yet, default to Kerala (32)
                        if (!detectedState) {
                          detectedState = selectedInvoice.invoice.tax_type === "IGST" ? "32" : "33";
                        }

                        setDestStateCode(detectedState);

                        if (cust.state_name) {
                          setDestPlace(cust.state_name);
                        } else {
                          // Try to derive place from address or default
                          if (cust.address && /nilambur/i.test(cust.address)) {
                            setDestPlace("Nilambur");
                          } else {
                            setDestPlace("Gudalur");
                          }
                        }
                      }
                    } else {
                      setDestPlace("Gudalur");
                      setDestAddr("Tamilnadu");
                      setDestPincode("643212");
                      setDestStateCode("33");
                    }
                    if (selectedInvoice?.invoice.vehicle_number) {
                      setVehicleNo(selectedInvoice.invoice.vehicle_number);
                    }
                    setShowEwayModal(true);
                  }}
                  style={{ color: "#0ea5e9", borderColor: "#0ea5e9" }}
                >
                  Export E-Way JSON
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setShowInvoiceDetails(false)}
                >
                  Close
                </button>
                <button
                  className="primary-button"
                  onClick={handleReprintInvoice}
                >
                  Print Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEwayModal && (
        <div className="modal-overlay" onClick={() => setShowEwayModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px", borderRadius: "14px" }}
          >
            <div className="modal-header">
              <div>
                <h3>E-Way Bill Details</h3>
                <p>Enter the transportation details to generate E-Way JSON.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowEwayModal(false)}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div
              className="modal-body"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "20px",
                maxHeight: "65vh",
                overflowY: "auto",
              }}
            >
              <div className="invoice-info-card">
                <div className="invoice-info-card-title">Destination Details</div>
                <div className="eway-form-grid" style={{ marginBottom: "12px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Customer Pincode *</label>
                    <input
                      type="number"
                      value={destPincode}
                      onChange={(e) => {
                        const newPin = e.target.value;
                        setDestPincode(newPin);
                        if (newPin.length >= 2) {
                          const matchedState = getStateFromPincode(newPin);
                          if (matchedState) {
                            setDestStateCode(String(matchedState));
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>State Code *</label>
                    <input
                      type="number"
                      value={destStateCode}
                      onChange={(e) => setDestStateCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="eway-form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Destination Place / City *</label>
                    <input
                      type="text"
                      placeholder="e.g. Gudalur"
                      value={destPlace}
                      onChange={(e) => setDestPlace(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Destination Address</label>
                    <input
                      type="text"
                      placeholder="e.g. Calicut Road, Gudalur"
                      value={destAddr}
                      onChange={(e) => setDestAddr(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="invoice-info-card">
                <div className="invoice-info-card-title">Transport Details</div>
                <div className="eway-form-grid" style={{ marginBottom: "12px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Distance (in KM) *</label>
                    <input
                      type="number"
                      value={transDistance}
                      onChange={(e) => setTransDistance(e.target.value)}
                    />
                    <small
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        marginTop: "5px",
                        display: "block",
                        lineHeight: 1.35,
                      }}
                    >
                      {destPincode === "643212"
                        ? "⚠️ Same PIN (643212): Enter local distance (1–100 KM, e.g. 10)."
                        : "💡 Tip: Enter 0 to let the GST portal auto-calculate exact road distance (avoids ±10% errors)."}
                    </small>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Mode of Transport *</label>
                    <select
                      value={transMode}
                      onChange={(e) => setTransMode(e.target.value)}
                    >
                      <option value="1">Road</option>
                      <option value="2">Rail</option>
                      <option value="3">Air</option>
                      <option value="4">Ship</option>
                    </select>
                  </div>
                </div>

                <div className="eway-form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Vehicle Number</label>
                    <input
                      type="text"
                      placeholder="e.g. TN43AB1234"
                      value={vehicleNo}
                      onChange={(e) =>
                        setVehicleNo(e.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Vehicle Type</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                    >
                      <option value="R">Regular</option>
                      <option value="O">ODC</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="invoice-info-card">
                <div className="invoice-info-card-title">3rd Party Transporter (Optional)</div>
                <div className="eway-form-grid" style={{ marginBottom: "12px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Transporter Name</label>
                    <input
                      type="text"
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Transporter ID</label>
                    <input
                      type="text"
                      value={transporterId}
                      onChange={(e) =>
                        setTransporterId(e.target.value.toUpperCase())
                      }
                    />
                  </div>
                </div>

                <div className="eway-form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Transport Doc No</label>
                    <input
                      type="text"
                      value={transDocNo}
                      onChange={(e) => setTransDocNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Transport Doc Date</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={transDocDate}
                      onChange={(e) => setTransDocDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ padding: "16px 20px" }}>
              <button
                className="secondary-button"
                onClick={() => setShowEwayModal(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={handleExportEway}
                disabled={!transDistance}
              >
                Generate JSON
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Hidden print templates */}
      {printInvoice && (
        <div
          className={`print-invoice ${
            printInvoice.items.length <= 10 ? "print-bottom-pinned" : ""
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
                  DUPLICATE
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
                      {printInvoice.invoice.invoice_number}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Date:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {new Date(
                        printInvoice.invoice.created_at.replace(" ", "T") + "Z",
                      ).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>
                      <b>Payment Terms:</b>
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      {printInvoice.invoice.payment_method}
                    </td>
                  </tr>
                  {printInvoice.invoice.vehicle_number ? (
                    <tr>
                      <td style={{ padding: "3px 0" }}>
                        <b>Vehicle No:</b>
                      </td>
                      <td style={{ padding: "3px 0" }}>
                        {printInvoice.invoice.vehicle_number}
                      </td>
                    </tr>
                  ) : null}
                  {printInvoice.invoice.driver_details ? (
                    <tr>
                      <td style={{ padding: "3px 0" }}>
                        <b>Driver:</b>
                      </td>
                      <td style={{ padding: "3px 0" }}>
                        {printInvoice.invoice.driver_details}
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
            {printInvoice.customer ? (
              <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                <strong>{printInvoice.customer.name}</strong>
                {printInvoice.customer.address && (
                  <div>{printInvoice.customer.address}</div>
                )}

                <div style={{ marginTop: "2px" }}>
                  {printInvoice.customer.state_name && (
                    <span>
                      <b>State:</b> {printInvoice.customer.state_name}{" "}
                    </span>
                  )}
                  {printInvoice.customer.state_code && (
                    <span>
                      <b>Code:</b> {printInvoice.customer.state_code}
                    </span>
                  )}
                </div>
                <div>
                  <b>Phone:</b> {printInvoice.customer.phone || "-"}
                </div>
                {printInvoice.customer.gstin && (
                  <div>
                    <b>GSTIN:</b> {printInvoice.customer.gstin}
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
              {printInvoice.items.map((item, index) => {
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
            {printInvoice.invoice.tax_amount > 0 && (
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
                      {printInvoice.invoice.tax_type === "CGST_SGST" ? (
                        <>
                          <th
                            style={{ border: "1px solid #ddd", padding: "2px 4px" }}
                          >
                            CGST Amt
                          </th>
                          <th
                            style={{ border: "1px solid #ddd", padding: "2px 4px" }}
                          >
                            SGST Amt
                          </th>
                        </>
                      ) : (
                        <th
                          style={{ border: "1px solid #ddd", padding: "2px 4px" }}
                        >
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
                      printInvoice.items.reduce(
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
                            style={{ border: "1px solid #ddd", padding: "2px 4px" }}
                          >
                            {hsn}
                          </td>
                          <td
                            style={{ border: "1px solid #ddd", padding: "2px 4px" }}
                          >
                            ₹{data.taxable.toFixed(2)}
                          </td>
                          {printInvoice.invoice.tax_type === "CGST_SGST" ? (
                            <>
                              <td
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "2px 4px",
                                }}
                              >
                                ₹{taxHalf.toFixed(2)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "2px 4px",
                                }}
                              >
                                ₹{taxHalf.toFixed(2)}
                              </td>
                            </>
                          ) : (
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "2px 4px",
                              }}
                            >
                              ₹{data.taxAmount.toFixed(2)}
                            </td>
                          )}
                          <td
                            style={{ border: "1px solid #ddd", padding: "2px 4px" }}
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
                marginTop: "6px",
              }}
            >
              <div style={{ flex: "1", paddingRight: "16px" }}>
                <div style={{ marginBottom: "4px", fontSize: "10.5px" }}>
                  <b>Total Amount (in words):</b>
                  <br />
                  {numberToWords(printInvoice.invoice.grand_total)}
                </div>

                <div
                  className="print-bank-details"
                  style={{
                    fontSize: "9px",
                    border: "1px solid #eee",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    lineHeight: "1.25",
                    maxWidth: "310px",
                  }}
                >
                  <b>Company's Bank Details</b>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "2px",
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
                      marginTop: "2px",
                    }}
                  >
                    <div>Company's PAN:</div>
                    <div>
                      <b>AQZPM8277B</b>
                    </div>
                  </div>
                </div>
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
                        ₹{printInvoice.invoice.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    {printInvoice.invoice.discount_amount > 0 && (
                      <tr>
                        <td style={{ padding: "2px 0" }}>Discount:</td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "2px 0",
                            color: "red",
                          }}
                        >
                          - ₹{printInvoice.invoice.discount_amount.toFixed(2)}
                        </td>
                      </tr>
                    )}
                    {/* Tax Breakdown Rows */}
                    {(() => {
                      const taxByRate: Record<number, number> = {};
                      printInvoice.items.forEach((item) => {
                        const rate = Number(item.tax_rate) || 0;
                        if (rate > 0) {
                          taxByRate[rate] = (taxByRate[rate] || 0) + item.tax_amount;
                        }
                      });

                      const sortedRates = Object.keys(taxByRate)
                        .map(Number)
                        .sort((a, b) => a - b);

                      if (sortedRates.length === 0 && printInvoice.invoice.tax_amount > 0) {
                        return (
                          <tr>
                            <td style={{ padding: "2px 0" }}>Total Tax:</td>
                            <td style={{ textAlign: "right", padding: "2px 0" }}>
                              ₹{printInvoice.invoice.tax_amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      }

                      return sortedRates.map((rate) => {
                        const totalTaxForRate = taxByRate[rate];
                        if (printInvoice.invoice.tax_type === "CGST_SGST") {
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
                    {(() => {
                      const exactPrint =
                        printInvoice.invoice.subtotal +
                        printInvoice.invoice.tax_amount -
                        printInvoice.invoice.discount_amount;
                      const printRound =
                        printInvoice.invoice.grand_total - exactPrint;
                      if (Math.abs(printRound) >= 0.01) {
                        return (
                          <tr>
                            <td style={{ padding: "2px 0" }}>Round Off:</td>
                            <td
                              style={{ textAlign: "right", padding: "2px 0" }}
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
                        ₹{printInvoice.invoice.grand_total.toFixed(2)}
                      </td>
                    </tr>
                    {printInvoice.invoice.balance_amount !== undefined &&
                      printInvoice.invoice.balance_amount !== null &&
                      printInvoice.invoice.balance_amount > 0 && (
                        <>
                          <tr>
                            <td style={{ padding: "2px 0", color: "#059669", fontWeight: 600 }}>
                              Amount Paid Now:
                            </td>
                            <td style={{ textAlign: "right", padding: "2px 0", color: "#059669", fontWeight: 600 }}>
                              ₹{(printInvoice.invoice.paid_amount ?? 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "2px 0", color: "#dc2626", fontWeight: "bold" }}>
                              Balance Due (Credit):
                            </td>
                            <td style={{ textAlign: "right", padding: "2px 0", color: "#dc2626", fontWeight: "bold" }}>
                              ₹{printInvoice.invoice.balance_amount.toFixed(2)}
                            </td>
                          </tr>
                        </>
                      )}
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: "10px",
                    textAlign: "right",
                    fontSize: "10px",
                  }}
                >
                  <p style={{ margin: "0 0 14px 0" }}>
                    For <b>NILGIRI PUMPS AND FITTINGS</b>
                  </p>
                  <div
                    style={{
                      borderTop: "1px solid #000",
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
              style={{ marginTop: "5px", fontSize: "9.5px", color: "#555" }}
            >
              <b>Declaration:</b> 1) Goods can only be returned within 7 days of
              the purchase. 2) Subject to Nilgiris Jurisdiction Only.
              <span style={{ float: "right" }}>E. & O.E</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
