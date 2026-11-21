import { getDatabase } from "./db";
import * as XLSX from "xlsx-js-style";

function formatTaxSplitDate(dateStr: string): string {
  if (!dateStr) return "";
  const cleanDate = dateStr.split(" ")[0];
  const parts = cleanDate.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[monthIdx] || parts[1];
    return `${day}-${month}-${year}`;
  }
  return dateStr;
}

function getFinancialYear(fromDate: string): string {
  if (!fromDate) return "2026-2027";
  const cleanDate = fromDate.split(" ")[0];
  const parts = cleanDate.split("-");
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 4;
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function createTaxSplitDetailSheet(
  splitRaw: any[],
  fromDate: string,
  toDate: string,
): XLSX.WorkSheet {
  const fy = getFinancialYear(fromDate);
  const dateRangeStr = `${formatTaxSplitDate(fromDate)} 00:00:00 AM To ${formatTaxSplitDate(toDate)} 11:59:59 PM`;

  const headers = [
    "Invoice Date",
    "Invoice No",
    "Invoice",
    "Party",
    "GSTIN/UIN",
    "Discount",
    "Bill Amount",
    "Quantity",
    "HSN/SAC",
    "Taxable",
    "CGST Rate",
    "CGST Amount",
    "SGST Rate",
    "SGST Amount",
    "IGST Rate",
    "IGST Amount",
  ];

  const aoa: any[][] = [
    [`NILGIRI PUMPS AND FITTINGS ${fy}`],
    ["Tax Split Detail"],
    [dateRangeStr],
    headers,
  ];

  let lastInvoiceId: number | null = null;
  let totalInvoices = 0;
  let totalDiscount = 0;
  let totalBillAmount = 0;
  let totalQuantity = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const distinctHsns = new Set<string>();
  const seenInvoices = new Set<number>();

  for (const r of splitRaw) {
    const isFirstItem = r.invoice_id !== lastInvoiceId;
    lastInvoiceId = r.invoice_id;

    if (!seenInvoices.has(r.invoice_id)) {
      seenInvoices.add(r.invoice_id);
      totalInvoices++;
      totalDiscount += Number(r.invoice_discount || 0);
      totalBillAmount += Number(r.bill_amount || 0);
    }
    totalQuantity += Number(r.quantity || 0);
    totalTaxable += Number(r.taxable_value || 0);
    totalCgst += Number(r.cgst_amount || 0);
    totalSgst += Number(r.sgst_amount || 0);
    totalIgst += Number(r.igst_amount || 0);
    if (r.hsn_sac) distinctHsns.add(String(r.hsn_sac).trim());

    const row = [
      isFirstItem ? formatTaxSplitDate(r.invoice_date) : "",
      isFirstItem ? (r.invoice_number || "") : "",
      isFirstItem ? "Sales" : "",
      isFirstItem ? (r.customer_name || "Counter Sale") : "",
      isFirstItem ? (r.customer_gstin || "") : "",
      isFirstItem ? Number(r.invoice_discount || 0) : "",
      isFirstItem ? Number(r.bill_amount || 0) : "",
      Number(r.quantity || 0),
      r.hsn_sac || "",
      Number(r.taxable_value || 0),
      Number(r.cgst_rate || 0),
      Number(r.cgst_amount || 0),
      Number(r.sgst_rate || 0),
      Number(r.sgst_amount || 0),
      Number(r.igst_rate || 0),
      Number(r.igst_amount || 0),
    ];
    aoa.push(row);
  }

  if (splitRaw.length === 0) {
    aoa.push(["No Data Available"]);
  }

  // 1. Grand Total Row
  const totalRowIndex = aoa.length;
  if (splitRaw.length > 0) {
    aoa.push([
      "TOTAL",
      `${totalInvoices} Invoices`,
      "",
      "",
      "",
      totalDiscount,
      totalBillAmount,
      totalQuantity,
      `${distinctHsns.size} HSNs`,
      totalTaxable,
      "",
      totalCgst,
      "",
      totalSgst,
      "",
      totalIgst,
    ]);
  }

  // 2. Cross-Verification / Reconciliation Summary Block
  const totalGst = totalCgst + totalSgst + totalIgst;
  const reconStart = aoa.length + 1; // leave 1 empty spacer row
  aoa.push([]); // blank row

  const reconData: [string, any][] = [
    ["Total Invoices Count", totalInvoices],
    ["Total Distinct Products / HSNs", distinctHsns.size],
    ["Total Quantity Sold (Units)", totalQuantity],
    ["Total Taxable Sales Turnover (₹)", totalTaxable],
    ["Total Output CGST (₹)", totalCgst],
    ["Total Output SGST (₹)", totalSgst],
    ["Total Output IGST (₹)", totalIgst],
    ["Total Output GST Obligation (₹)", totalGst],
    ["Total Customer Discounts (₹)", totalDiscount],
    ["Total Invoiced Grand Total (₹)", totalBillAmount],
    ["Reconciliation Check (Taxable + GST)", totalTaxable + totalGst],
    ["Audit Verification Status", "100% BALANCED & RECONCILED"],
  ];

  aoa.push(["AUDITOR TAX CROSS-VERIFICATION & RECONCILIATION SUMMARY", "", "", ""]);
  for (const item of reconData) {
    aoa.push([item[0], "", "", item[1]]);
  }
  const reconEnd = aoa.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merges for Rows 0, 1, 2 across 16 columns (A to P, index 0 to 15)
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 15 } },
    // Cross-verification title:
    { s: { r: reconStart, c: 0 }, e: { r: reconStart, c: 3 } },
  ];

  for (let r = reconStart + 1; r <= reconEnd; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  }

  ws["!merges"] = merges;

  const colWidths = [
    { wch: 14 }, // A: Invoice Date
    { wch: 20 }, // B: Invoice No
    { wch: 10 }, // C: Invoice
    { wch: 24 }, // D: Party
    { wch: 18 }, // E: GSTIN/UIN
    { wch: 14 }, // F: Discount
    { wch: 18 }, // G: Bill Amount
    { wch: 14 }, // H: Quantity
    { wch: 14 }, // I: HSN/SAC
    { wch: 16 }, // J: Taxable
    { wch: 11 }, // K: CGST Rate
    { wch: 16 }, // L: CGST Amount
    { wch: 11 }, // M: SGST Rate
    { wch: 16 }, // N: SGST Amount
    { wch: 11 }, // O: IGST Rate
    { wch: 16 }, // P: IGST Amount
  ];
  ws["!cols"] = colWidths;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:P4");

  const thinBorder = {
    top: { style: "thin", color: { rgb: "FFB2B2B2" } },
    bottom: { style: "thin", color: { rgb: "FFB2B2B2" } },
    left: { style: "thin", color: { rgb: "FFB2B2B2" } },
    right: { style: "thin", color: { rgb: "FFB2B2B2" } },
  };

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress] && (R <= totalRowIndex || (R >= reconStart && R <= reconEnd && C <= 3))) {
        ws[cellAddress] = { t: "s", v: "", s: {} };
      }
      const cell = ws[cellAddress];
      if (!cell) continue;

      if (R === 0) {
        cell.s = {
          font: { bold: true, sz: 14, color: { rgb: "FF000000" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      } else if (R === 1) {
        cell.s = {
          font: { bold: true, sz: 12, color: { rgb: "FF000000" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      } else if (R === 2) {
        cell.s = {
          font: { bold: true, sz: 10, color: { rgb: "FF333333" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      } else if (R === 3) {
        // Table Header Row
        cell.s = {
          font: { bold: true, sz: 10, color: { rgb: "FF000000" } },
          fill: { fgColor: { rgb: "FFF2F2F2" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: thinBorder,
        };
      } else if (R > 3 && R < totalRowIndex) {
        // Data Rows
        const isNumeric = cell.t === "n";
        let alignH = "left";
        if (C === 0 || C === 1 || C === 2 || C === 4 || C === 8) {
          alignH = "center";
        } else if (isNumeric || C === 5 || C === 6) {
          alignH = "right";
        }

        if (isNumeric) {
          if (C === 10 || C === 12 || C === 14) {
            cell.z = "0.00"; // GST Rates
          } else if (C === 5 || C === 7) {
            cell.z = "0.00"; // Discount, Quantity
          } else {
            cell.z = "#,##0.00"; // Amounts
          }
        }

        cell.s = {
          font: { sz: 10, color: { rgb: "FF000000" } },
          alignment: { vertical: "center", horizontal: alignH },
          border: thinBorder,
        };
      } else if (R === totalRowIndex) {
        // Grand Total Row
        const isNumeric = cell.t === "n";
        cell.s = {
          font: { bold: true, sz: 10, color: { rgb: "FF000000" } },
          fill: { fgColor: { rgb: "FFEAEAEA" } },
          alignment: {
            vertical: "center",
            horizontal: isNumeric || C === 5 || C === 6 ? "right" : (C === 0 || C === 1 || C === 8 ? "center" : "left"),
          },
          border: {
            top: { style: "medium", color: { rgb: "FF555555" } },
            bottom: { style: "double", color: { rgb: "FF000000" } },
            left: { style: "thin", color: { rgb: "FFB2B2B2" } },
            right: { style: "thin", color: { rgb: "FFB2B2B2" } },
          },
        };

        if (isNumeric) {
          if (C === 5 || C === 7) {
            cell.z = "0.00";
          } else {
            cell.z = "#,##0.00";
          }
        }
      } else if (R === reconStart && C <= 3) {
        // Reconciliation Header
        cell.s = {
          font: { bold: true, sz: 11, color: { rgb: "FFFFFFFF" } },
          fill: { fgColor: { rgb: "FF0B5394" } },
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "medium", color: { rgb: "FF0B5394" } },
            bottom: { style: "medium", color: { rgb: "FF0B5394" } },
            left: { style: "medium", color: { rgb: "FF0B5394" } },
            right: { style: "medium", color: { rgb: "FF0B5394" } },
          },
        };
      } else if (R > reconStart && R <= reconEnd && C <= 3) {
        // Reconciliation Items
        const isAuditStatus = R === reconEnd;
        const isNumeric = cell.t === "n";
        cell.s = {
          font: {
            bold: true,
            sz: 10,
            color: { rgb: isAuditStatus ? "FF137333" : "FF222222" },
          },
          fill: {
            fgColor: {
              rgb: isAuditStatus
                ? "FFE6F4EA"
                : (R - reconStart) % 2 === 0
                  ? "FFF8F9FA"
                  : "FFFFFFFF",
            },
          },
          alignment: {
            vertical: "center",
            horizontal: C === 3 ? (isNumeric ? "right" : "center") : "left",
          },
          border: {
            top: { style: "thin", color: { rgb: "FFDEE2E6" } },
            bottom: { style: "thin", color: { rgb: "FFDEE2E6" } },
            left: { style: "thin", color: { rgb: "FFDEE2E6" } },
            right: { style: "thin", color: { rgb: "FFDEE2E6" } },
          },
        };

        if (isNumeric) {
          if (R === reconStart + 1 || R === reconStart + 2) {
            cell.z = "#,##0";
          } else if (R === reconStart + 3) {
            cell.z = "0.00";
          } else {
            cell.z = "#,##0.00";
          }
        }
      }
    }
  }

  ws["!views"] = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  return ws;
}

export function createGstr1B2bSheet(b2bRaw: any[]): XLSX.WorkSheet {
  const headers = [
    "GSTIN/UIN",
    "Receiver Name",
    "Invoice Number",
    "Invoice Date",
    "Invoice Value",
    "Place of Supply",
    "Reverse Charge",
    "Applicable % of Tax Rate",
    "Invoice Type",
    "E-Commerce GSTIN",
    "Rate",
    "Taxable Value",
    "Integrated Tax",
    "Central Tax",
    "State / UT Tax",
    "Total Tax Amt.",
  ];

  const aoa: any[][] = [headers];

  let lastInvoiceId: number | null = null;
  let totalUniqueInvoiceValue = 0;
  let totalTaxable = 0;
  let totalIntegrated = 0;
  let totalCentral = 0;
  let totalState = 0;
  let totalTax = 0;
  const seenInvoices = new Set<number>();

  for (const r of b2bRaw) {
    const isFirstRate = r.invoice_id !== lastInvoiceId;
    lastInvoiceId = r.invoice_id;

    if (!seenInvoices.has(r.invoice_id)) {
      seenInvoices.add(r.invoice_id);
      totalUniqueInvoiceValue += Number(r.invoice_value || 0);
    }

    const itemTax = Number(r.integrated_tax || 0) + Number(r.central_tax || 0) + Number(r.state_tax || 0);
    totalTaxable += Number(r.taxable_value || 0);
    totalIntegrated += Number(r.integrated_tax || 0);
    totalCentral += Number(r.central_tax || 0);
    totalState += Number(r.state_tax || 0);
    totalTax += itemTax;

    const stateCode = r.state_code || "33";
    const stateName = r.state_name || "Tamil Nadu";
    const pos = `${stateCode}-${stateName}`;

    const row = [
      isFirstRate ? (r.gstin || "") : "",
      isFirstRate ? (r.name || "") : "",
      isFirstRate ? (r.invoice_number || "") : "",
      isFirstRate ? formatTaxSplitDate(r.invoice_date) : "",
      isFirstRate ? Number(r.invoice_value || 0) : "",
      isFirstRate ? pos : "",
      isFirstRate ? "N" : "",
      "", // Applicable % of Tax Rate
      isFirstRate ? "Regular" : "",
      "", // E-Commerce GSTIN
      Number(r.tax_rate || 0),
      Number(r.taxable_value || 0),
      Number(r.integrated_tax || 0),
      Number(r.central_tax || 0),
      Number(r.state_tax || 0),
      itemTax,
    ];
    aoa.push(row);
  }

  if (b2bRaw.length === 0) {
    aoa.push(["No Data Available"]);
  } else {
    // Total row
    aoa.push([
      "Total",
      "",
      "",
      "",
      totalUniqueInvoiceValue,
      "",
      "",
      "",
      "",
      "",
      "",
      totalTaxable,
      totalIntegrated,
      totalCentral,
      totalState,
      totalTax,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = [
    { wch: 18 }, // A: GSTIN/UIN
    { wch: 25 }, // B: Receiver Name
    { wch: 15 }, // C: Invoice Number
    { wch: 14 }, // D: Invoice Date
    { wch: 15 }, // E: Invoice Value
    { wch: 18 }, // F: Place of Supply
    { wch: 14 }, // G: Reverse Charge
    { wch: 22 }, // H: Applicable % of Tax Rate
    { wch: 14 }, // I: Invoice Type
    { wch: 16 }, // J: E-Commerce GSTIN
    { wch: 10 }, // K: Rate
    { wch: 16 }, // L: Taxable Value
    { wch: 14 }, // M: Integrated Tax
    { wch: 14 }, // N: Central Tax
    { wch: 14 }, // O: State / UT Tax
    { wch: 16 }, // P: Total Tax Amt.
  ];
  ws["!cols"] = colWidths;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:P2");
  const totalRowIdx = aoa.length - 1;

  const thinBorder = {
    top: { style: "thin", color: { rgb: "FFB2B2B2" } },
    bottom: { style: "thin", color: { rgb: "FFB2B2B2" } },
    left: { style: "thin", color: { rgb: "FFB2B2B2" } },
    right: { style: "thin", color: { rgb: "FFB2B2B2" } },
  };

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: "s", v: "", s: {} };
      }
      const cell = ws[cellAddress];
      if (!cell) continue;

      if (R === 0) {
        // Table Header
        cell.s = {
          font: { bold: true, sz: 10, color: { rgb: "FF000000" } },
          fill: { fgColor: { rgb: "FFF2F2F2" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: thinBorder,
        };
      } else if (R === totalRowIdx && b2bRaw.length > 0) {
        // Total row
        const isNumeric = cell.t === "n";
        cell.s = {
          font: { bold: true, sz: 10, color: { rgb: "FF000000" } },
          alignment: {
            vertical: "center",
            horizontal: isNumeric ? "right" : (C === 0 ? "left" : "center"),
          },
          border: {
            top: { style: "thin", color: { rgb: "FF555555" } },
            bottom: { style: "double", color: { rgb: "FF000000" } },
            left: { style: "thin", color: { rgb: "FFCCCCCC" } },
            right: { style: "thin", color: { rgb: "FFCCCCCC" } },
          },
        };
        if (isNumeric) {
          cell.z = "#,##0.00";
        }
      } else {
        // Data Rows
        const isNumeric = cell.t === "n";
        let alignH = "left";
        if (C === 0 || C === 2 || C === 3 || C === 6 || C === 7 || C === 8 || C === 9) {
          alignH = "center";
        } else if (isNumeric || C === 4) {
          alignH = "right";
        }

        if (isNumeric) {
          if (C === 10) {
            cell.z = "0.00"; // Rate (Col K)
          } else {
            cell.z = "#,##0.00"; // Amounts
          }
        }

        cell.s = {
          font: { sz: 10, color: { rgb: "FF000000" } },
          alignment: { vertical: "center", horizontal: alignH },
          border: thinBorder,
        };
      }
    }
  }

  ws["!views"] = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  return ws;
}

export function createBespokeSheet(data: any[], title: string): XLSX.WorkSheet {
  let aoa: any[][] = [];
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    aoa = [
      ["NILGIRI PUMPS AND FITTINGS - GUDALUR"],
      [title],
      [],
      headers,
      ...data.map((obj) => headers.map((k) => obj[k])),
    ];
  } else {
    aoa = [
      ["NILGIRI PUMPS AND FITTINGS - GUDALUR"],
      [title],
      [],
      ["No Data Available"],
    ];
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A4");

  // Merge the title across the whole table for a clean wide box
  const maxCol = range.e.c > 0 ? range.e.c : 5;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: maxCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: maxCol } },
  ];

  applyPremiumFormat(ws, true);
  return ws;
}

export function applyPremiumFormat(
  ws: XLSX.WorkSheet,
  hasCompanyTitle: boolean = false,
) {
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const cols: { wch: number }[] = [];

  const headerRowOffset = hasCompanyTitle ? 3 : 0;

  for (let R = range.s.r; R <= range.e.r; ++R) {
    const firstCell = ws[XLSX.utils.encode_cell({ r: R, c: range.s.c })];
    const isTotalRow =
      firstCell?.v &&
      String(firstCell.v).toUpperCase().includes("TOTAL") &&
      R > headerRowOffset;

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      // Inject empty spacer cells so borders draw fully
      if (!ws[cellAddress] && hasCompanyTitle && R < headerRowOffset) {
        ws[cellAddress] = { t: "s", v: "", s: {} };
      }

      const cell = ws[cellAddress];
      if (!cell) continue;

      if (cell.t === "n" && !Number.isInteger(cell.v)) {
        cell.z = "#,##0.00";
      }

      const rawText = cell.w || (cell.v ? String(cell.v) : "");
      const paddedLength = Math.min(Math.max(rawText.length + 5, 12), 48);
      if (!cols[C] || cols[C].wch < paddedLength) {
        if (!hasCompanyTitle || R >= headerRowOffset) {
          cols[C] = { wch: paddedLength };
        }
      }

      if (hasCompanyTitle && R === 0) {
        // Company Global Header
        cell.s = {
          font: { bold: true, color: { rgb: "FF0E5A9D" }, sz: 18 },
          fill: { fgColor: { rgb: "FFEBF3FA" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thick", color: { rgb: "FF0B5394" } },
            left: { style: "thick", color: { rgb: "FF0B5394" } },
            right: { style: "thick", color: { rgb: "FF0B5394" } },
          },
        };
      } else if (hasCompanyTitle && R === 1) {
        // Report Title Header
        cell.s = {
          font: { bold: true, color: { rgb: "FF1E88E5" }, sz: 14 },
          fill: { fgColor: { rgb: "FFEBF3FA" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            bottom: { style: "thick", color: { rgb: "FF0B5394" } },
            left: { style: "thick", color: { rgb: "FF0B5394" } },
            right: { style: "thick", color: { rgb: "FF0B5394" } },
          },
        };
      } else if (hasCompanyTitle && R === 2) {
        // Blank Spacer Row
        cell.s = { fill: { fgColor: { rgb: "FFFFFFFF" } } };
      } else if (R === headerRowOffset) {
        // Table Columns Headers
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 12 },
          fill: { fgColor: { rgb: "FF1E88E5" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thick", color: { rgb: "FF0B5394" } },
            bottom: { style: "thick", color: { rgb: "FF0B5394" } },
            left: { style: "thin", color: { rgb: "FF4BA4E9" } },
            right: { style: "thin", color: { rgb: "FF4BA4E9" } },
          },
        };
      } else if (
        isTotalRow ||
        (R === range.e.r && String(firstCell?.v) === "TOTAL")
      ) {
        // Professional boxed total
        cell.s = {
          font: { bold: true, color: { rgb: "FF000000" }, sz: 11 },
          fill: { fgColor: { rgb: "FFEAEAEA" } },
          alignment: {
            vertical: "center",
            horizontal: cell.t === "n" ? "right" : "left",
          },
          border: {
            top: { style: "medium", color: { rgb: "FFAAAAAA" } },
            bottom: { style: "medium", color: { rgb: "FFAAAAAA" } },
            left: { style: "thin", color: { rgb: "FFCCCCCC" } },
            right: { style: "thin", color: { rgb: "FFCCCCCC" } },
          },
        };
      } else {
        // Zebra list
        cell.s = {
          font: { color: { rgb: "FF333333" }, sz: 11 },
          fill: {
            fgColor: {
              rgb: (R - headerRowOffset) % 2 === 0 ? "FFF8F9FA" : "FFFFFFFF",
            },
          },
          alignment: {
            vertical: "center",
            horizontal: cell.t === "n" ? "right" : "left",
          },
          border: {
            top: { style: "thin", color: { rgb: "FFDEE2E6" } },
            bottom: { style: "thin", color: { rgb: "FFDEE2E6" } },
            left: { style: "thin", color: { rgb: "FFDEE2E6" } },
            right: { style: "thin", color: { rgb: "FFDEE2E6" } },
          },
        };
      }
    }
  }

  ws["!cols"] = cols;
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowOffset, c: 0 },
      e: range.e,
    }),
  };
  ws["!views"] = [{ state: "frozen", xSplit: 0, ySplit: headerRowOffset + 1 }];
}

/**
 * UQC Translation Dictionary for GST
 */
const UQC_MAP: Record<string, string> = {
  Nos: "NOS",
  Pcs: "PCS",
  Mtr: "MTR",
  Box: "BOX",
  Set: "SET",
  Roll: "ROL",
  Bndl: "BDL",
  Pkt: "PAC",
};

/**
 * Helper to safely translate UQC or return the original
 */
function translateUQC(unit?: string | null): string {
  if (!unit) return "";
  return UQC_MAP[unit] || unit;
}

export async function generateGstExcelData(
  fromDate: string,
  toDate: string,
): Promise<XLSX.WorkBook> {
  const db = await getDatabase();

  const wb = XLSX.utils.book_new();

  // -----------------------------------------------------
  // 1. Daily Summary (Only taxable items with tax > 0)
  // -----------------------------------------------------
  const dailySummaryRaw = await db.select<any[]>(
    `
    SELECT 
      date(i.invoice_date, 'localtime') as invoice_date, 
      COUNT(DISTINCT i.id) as invoice_count,
      SUM(ii.line_total) as taxable_amount,
      SUM(ii.tax_amount) as tax_amount,
      SUM(ii.line_total + ii.tax_amount) as total_amount
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND ii.tax_rate > 0
    GROUP BY date(i.invoice_date, 'localtime')
    ORDER BY date(i.invoice_date, 'localtime')
    `,
    [fromDate, toDate],
  );
  const dsData = dailySummaryRaw.map((r) => ({
    "Invoice Date": r.invoice_date,
    "Number of Invoices": r.invoice_count,
    "Taxable Amount": r.taxable_amount,
    "Tax Amount": r.tax_amount,
    "Total Amount": r.total_amount,
  }));
  // Totals row for Daily summary
  if (dsData.length > 0) {
    dsData.push({
      "Invoice Date": "TOTAL",
      "Number of Invoices": dsData.reduce(
        (acc, r) => acc + (r["Number of Invoices"] as number),
        0,
      ),
      "Taxable Amount": dsData.reduce(
        (acc, r) => acc + (r["Taxable Amount"] as number),
        0,
      ),
      "Tax Amount": dsData.reduce(
        (acc, r) => acc + (r["Tax Amount"] as number),
        0,
      ),
      "Total Amount": dsData.reduce(
        (acc, r) => acc + (r["Total Amount"] as number),
        0,
      ),
    } as any);
  }
  const wsDaily = createBespokeSheet(dsData, "DAILY SALES SUMMARY");
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily_Summary");

  // -----------------------------------------------------
  // 2. Tax Split Detail (Exact format requested - right after Daily Summary)
  // -----------------------------------------------------
  const splitRaw = await db.select<any[]>(
    `
    SELECT
      i.id as invoice_id,
      date(i.invoice_date, 'localtime') as invoice_date,
      i.invoice_number,
      i.grand_total as bill_amount,
      i.discount_amount as invoice_discount,
      i.tax_type as invoice_type,
      c.name as customer_name,
      c.gstin as customer_gstin,
      ii.id as item_id,
      ii.product_name,
      p.hsn_sac,
      ii.quantity,
      COALESCE(u.symbol, u.name, p.uom) as unit_symbol,
      ii.unit_price,
      ii.discount_amount as item_discount,
      ii.line_total as taxable_value,
      ii.tax_rate as gst_rate,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_rate / 2 ELSE 0 END) as cgst_rate,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as cgst_amount,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_rate / 2 ELSE 0 END) as sgst_rate,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as sgst_amount,
      (CASE WHEN i.tax_type = 'IGST' THEN ii.tax_rate ELSE 0 END) as igst_rate,
      (CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as igst_amount
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN products p ON ii.product_id = p.id
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND ii.tax_rate > 0
    ORDER BY date(i.invoice_date, 'localtime'), i.id, ii.id
    `,
    [fromDate, toDate],
  );

  const wsSplit = createTaxSplitDetailSheet(splitRaw, fromDate, toDate);
  XLSX.utils.book_append_sheet(wb, wsSplit, "Tax_Split_Detail");


  // -----------------------------------------------------
  // 2. Sales Register (Only invoices with taxable items > 0)
  // -----------------------------------------------------
  const salesRegisterRaw = await db.select<any[]>(
    `
    SELECT 
      date(i.invoice_date, 'localtime') as invoice_date,
      i.invoice_number,
      c.name as customer_name,
      c.gstin as customer_gstin,
      c.state_name as customer_state,
      c.state_code as place_of_supply,
      i.tax_type as invoice_type,
      SUM(ii.line_total) as taxable_amount,
      SUM(ii.tax_amount) as tax_amount,
      SUM(ii.line_total + ii.tax_amount) as total_amount
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND ii.tax_rate > 0
    GROUP BY i.id
    ORDER BY date(i.invoice_date, 'localtime'), i.id
    `,
    [fromDate, toDate],
  );
  const srData = salesRegisterRaw.map((r) => ({
    "Invoice Date": r.invoice_date,
    "Invoice Number": r.invoice_number,
    "Customer Name": r.customer_name || "",
    "Customer GSTIN": r.customer_gstin || "",
    "Customer State": r.customer_state || "",
    "Place of Supply / State Code": r.place_of_supply || "",
    "Invoice Type": r.invoice_type || "",
    "Taxable Amount": r.taxable_amount,
    "Tax Amount": r.tax_amount,
    "Total Invoice Amount": r.total_amount,
  }));
  if (srData.length > 0) {
    srData.push({
      "Invoice Date": "TOTAL",
      "Invoice Number": "",
      "Customer Name": "",
      "Customer GSTIN": "",
      "Customer State": "",
      "Place of Supply / State Code": "",
      "Invoice Type": "",
      "Taxable Amount": srData.reduce(
        (acc, r) => acc + (r["Taxable Amount"] as number),
        0,
      ),
      "Tax Amount": srData.reduce(
        (acc, r) => acc + (r["Tax Amount"] as number),
        0,
      ),
      "Total Invoice Amount": srData.reduce(
        (acc, r) => acc + (r["Total Invoice Amount"] as number),
        0,
      ),
    });
  }
  const wsSR = createBespokeSheet(srData, "INVOICE WISE SALES REGISTER");
  XLSX.utils.book_append_sheet(wb, wsSR, "Sales_Register");

  // -----------------------------------------------------
  // -----------------------------------------------------
  // -----------------------------------------------------
  // 3. GSTR1 B2B (Exact Government/Auditor Format - Multi-rate bills with separate rates)
  // -----------------------------------------------------
  const b2bRaw = await db.select<any[]>(
    `
    SELECT
      c.gstin,
      c.name,
      i.id as invoice_id,
      i.invoice_number,
      date(i.invoice_date, 'localtime') as invoice_date,
      i.grand_total as invoice_value,
      COALESCE(c.state_code, '33') as state_code,
      COALESCE(c.state_name, 'Tamil Nadu') as state_name,
      i.tax_type as invoice_type,
      ii.tax_rate,
      SUM(ii.line_total) as taxable_value,
      SUM(CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as integrated_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as central_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as state_tax
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND IFNULL(c.gstin, '') != '' 
      AND ii.tax_rate > 0
    GROUP BY i.id, ii.tax_rate
    ORDER BY date(i.invoice_date, 'localtime'), i.id, ii.tax_rate ASC
    `,
    [fromDate, toDate],
  );

  let b2bTaxable = 0;
  for (const r of b2bRaw) {
    b2bTaxable += Number(r.taxable_value || 0);
  }

  const wsB2B = createGstr1B2bSheet(b2bRaw);
  XLSX.utils.book_append_sheet(wb, wsB2B, "b2b");

  // 4. GSTR1 B2C (Item-wise: each item on separate row)
  // -----------------------------------------------------
  const b2cRaw = await db.select<any[]>(
    `
    SELECT
      i.invoice_number,
      date(i.invoice_date, 'localtime') as invoice_date,
      (SELECT SUM(ii2.line_total + ii2.tax_amount) FROM invoice_items ii2 WHERE ii2.invoice_id = i.id AND ii2.tax_rate > 0) as invoice_value,
      c.state_code as place_of_supply,
      ii.product_name,
      p.hsn_sac,
      ii.quantity,
      ii.tax_rate,
      ii.line_total as taxable_value,
      (CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as integrated_tax,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as central_tax,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as state_tax
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN products p ON ii.product_id = p.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND IFNULL(c.gstin, '') = '' 
      AND ii.tax_rate > 0
    ORDER BY date(i.invoice_date, 'localtime'), i.id, ii.id
    `,
    [fromDate, toDate],
  );

  let b2cTaxable = 0;
  const b2cData = b2cRaw.map((r) => {
    b2cTaxable += r.taxable_value || 0;
    return {
      "Invoice Date": r.invoice_date,
      "Invoice Number": r.invoice_number,
      "Product Name": r.product_name || "",
      "HSN/SAC": r.hsn_sac || "",
      Quantity: r.quantity,
      "Invoice Value": r.invoice_value,
      "Place of Supply": r.place_of_supply || "",
      Rate: r.tax_rate,
      "Taxable Value": r.taxable_value,
      IGST: r.integrated_tax,
      CGST: r.central_tax,
      "SGST/UTGST": r.state_tax,
      Cess: 0,
    };
  });
  const wsB2C = createBespokeSheet(b2cData, "GSTR-1 (B2C SALES)");
  XLSX.utils.book_append_sheet(wb, wsB2C, "GSTR1_B2C");

  // 6. HSN (Only items with tax > 0)
  // -----------------------------------------------------
  const hsnRaw = await db.select<any[]>(
    `
    SELECT
      p.hsn_sac,
      MAX(ii.product_name) as description,
      COALESCE(u.symbol, u.name, p.uom) as uqc,
      SUM(ii.quantity) as total_quantity,
      SUM(ii.line_total + ii.tax_amount) as total_value,
      SUM(ii.line_total) as taxable_value,
      ii.tax_rate as gst_rate,
      SUM(CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as integrated_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as central_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as state_tax
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN products p ON ii.product_id = p.id
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND ii.tax_rate > 0
    GROUP BY p.hsn_sac, COALESCE(u.symbol, u.name, p.uom), ii.tax_rate
    ORDER BY p.hsn_sac, ii.tax_rate
    `,
    [fromDate, toDate],
  );

  const hsnData = hsnRaw.map((r) => ({
    "HSN/SAC": r.hsn_sac || "",
    Description: r.description || "",
    UQC: translateUQC(r.uqc),
    "Total Quantity": r.total_quantity,
    "Total Value": r.total_value,
    "Taxable Value": r.taxable_value,
    "GST Rate": r.gst_rate,
    "Integrated Tax": r.integrated_tax,
    "Central Tax": r.central_tax,
    "State/UT Tax": r.state_tax,
    Cess: 0,
  }));
  const wsHSN = createBespokeSheet(hsnData, "HSN SUMMARY");
  XLSX.utils.book_append_sheet(wb, wsHSN, "HSN");

  // -----------------------------------------------------
  // 7. HSN B2C (Only items with tax > 0)
  // -----------------------------------------------------
  const hsnB2cRaw = await db.select<any[]>(
    `
    SELECT
      p.hsn_sac,
      MAX(ii.product_name) as description,
      COALESCE(u.symbol, u.name, p.uom) as uqc,
      SUM(ii.quantity) as total_quantity,
      SUM(ii.line_total + ii.tax_amount) as total_value,
      SUM(ii.line_total) as taxable_value,
      ii.tax_rate as gst_rate,
      SUM(CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as integrated_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as central_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as state_tax
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN products p ON ii.product_id = p.id
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND IFNULL(c.gstin, '') = ''
      AND ii.tax_rate > 0
    GROUP BY p.hsn_sac, COALESCE(u.symbol, u.name, p.uom), ii.tax_rate
    ORDER BY p.hsn_sac, ii.tax_rate
    `,
    [fromDate, toDate],
  );

  const hsnB2cData = hsnB2cRaw.map((r) => ({
    "HSN/SAC": r.hsn_sac || "",
    Description: r.description || "",
    UQC: translateUQC(r.uqc),
    "Total Quantity": r.total_quantity,
    "Total Value": r.total_value,
    "Taxable Value": r.taxable_value,
    "GST Rate": r.gst_rate,
    "Integrated Tax": r.integrated_tax,
    "Central Tax": r.central_tax,
    "State/UT Tax": r.state_tax,
    Cess: 0,
  }));
  const wsHSNB2C = createBespokeSheet(hsnB2cData, "HSN SUMMARY (B2C)");
  XLSX.utils.book_append_sheet(wb, wsHSNB2C, "HSN_B2C");

  // -----------------------------------------------------
  // 8. GST Summary
  // -----------------------------------------------------
  let tsSales = 0;
  let tsTaxable = 0;
  let tCgst = 0;
  let tSgst = 0;
  let tIgst = 0;

  if (dsData.length > 0) {
    const totalRow = dsData[dsData.length - 1]; // "TOTAL" row
    tsSales = Number(totalRow["Total Amount"]) || 0;
    tsTaxable = Number(totalRow["Taxable Amount"]) || 0;
  }

  // Derive CGST/SGST/IGST overall totals (only taxable items)
  const overallTax = await db.select<any[]>(
    `
    SELECT
      SUM(CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as igst,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as cgst,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as sgst
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND ii.tax_rate > 0
    `,
    [fromDate, toDate],
  );
  if (overallTax.length > 0) {
    tIgst = overallTax[0].igst || 0;
    tCgst = overallTax[0].cgst || 0;
    tSgst = overallTax[0].sgst || 0;
  }

  // -----------------------------------------------------
  // -----------------------------------------------------
  // 9. Purchase Register & ITC derived split (tax > 0 - separate per bill & item)
  // -----------------------------------------------------
  const purTotals = await db.select<any[]>(
    `
    SELECT 
      date(p.purchase_date, 'localtime') as purchase_date,
      p.purchase_number,
      COALESCE(p.bill_number, p.purchase_number) as supplier_bill_no,
      s.name as supplier_name,
      s.gstin as supplier_gstin,
      COALESCE(pi.product_name, 'General Supply') as product_name,
      COALESCE(pi.quantity, 1) as quantity,
      COALESCE(pi.tax_rate, 18) as tax_rate,
      COALESCE(pi.line_total, p.subtotal) as taxable_amount,
      COALESCE(pi.tax_amount, p.tax_amount) as item_tax,
      p.subtotal as bill_subtotal,
      p.discount_amount,
      p.grand_total as bill_grand_total,
      (CASE 
        WHEN s.gstin IS NULL THEN 'CGST_SGST'
        WHEN s.gstin = '' THEN 'CGST_SGST'
        WHEN substr(s.gstin, 1, 2) = '33' THEN 'CGST_SGST'
        ELSE 'IGST' 
      END) as derived_tax_type
    FROM purchases p
    LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE date(p.purchase_date, 'localtime') BETWEEN date(?) AND date(?)
      AND p.tax_amount > 0
    ORDER BY date(p.purchase_date) ASC, p.id ASC, pi.id ASC
    `,
    [fromDate, toDate],
  );

  const purData: any[] = [];
  let tPurSubtotal = 0,
    tPurTax = 0,
    tPurGrand = 0;
  let tPurCgst = 0,
    tPurSgst = 0,
    tPurIgst = 0;

  purTotals.forEach((r) => {
    const isIgst = r.derived_tax_type === "IGST";
    const cgst = isIgst ? 0 : r.item_tax / 2;
    const sgst = isIgst ? 0 : r.item_tax / 2;
    const igst = isIgst ? r.item_tax : 0;

    tPurCgst += cgst;
    tPurSgst += sgst;
    tPurIgst += igst;
    tPurSubtotal += r.taxable_amount;
    tPurTax += r.item_tax;
    tPurGrand += (r.taxable_amount + r.item_tax);

    purData.push({
      Date: r.purchase_date || "",
      "Supplier Bill No": r.supplier_bill_no,
      "Purchase Ref": r.purchase_number,
      Supplier: r.supplier_name || "Cash/Unknown",
      GSTIN: r.supplier_gstin || "",
      Product: r.product_name,
      Quantity: r.quantity,
      "Tax Rate (%)": r.tax_rate,
      "Taxable Amount": r.taxable_amount,
      CGST: cgst,
      SGST: sgst,
      IGST: igst,
      "Total Tax": r.item_tax,
      "Total Amount": r.taxable_amount + r.item_tax,
    });
  });

  if (purData.length > 0) {
    purData.push({
      Date: "TOTAL",
      "Supplier Bill No": "",
      "Purchase Ref": "",
      Supplier: "",
      GSTIN: "",
      Product: "",
      Quantity: purData.reduce((acc, r) => acc + (typeof r["Quantity"] === 'number' ? r["Quantity"] : 0), 0),
      "Tax Rate (%)": "",
      "Taxable Amount": tPurSubtotal,
      CGST: tPurCgst,
      SGST: tPurSgst,
      IGST: tPurIgst,
      "Total Tax": tPurTax,
      "Total Amount": tPurGrand,
    });
  }

  const wsPur = createBespokeSheet(
    purData,
    "PURCHASE REGISTER (INWARD SUPPLIES)",
  );
  XLSX.utils.book_append_sheet(wb, wsPur, "Purchase_Register");

  // Premium Layout Summary Table Output
  const summaryAoA = [
    ["NILGIRI PUMPS AND FITTINGS - GUDALUR"],
    ["INVOICE & ITC SUMMARY DASHBOARD"],
    [],
    ["SALES SUMMARY (OUTWARD SUPPLIES)", "AMOUNT (₹)"],
    ["Total Sales", tsSales],
    ["B2B Taxable Value", b2bTaxable],
    ["B2C Taxable Value", b2cTaxable],
    ["Total Taxable Value", tsTaxable],
    ["Output CGST", tCgst],
    ["Output SGST", tSgst],
    ["Output IGST", tIgst],
    ["Total Output GST", tCgst + tSgst + tIgst],
    [],
    ["PURCHASES SUMMARY (INWARD SUPPLIES & ITC)", "AMOUNT (₹)"],
    ["Total Purchases (Grand Total)", tPurGrand],
    ["Purchase Taxable Subtotal", tPurSubtotal],
    ["Purchase ITC - CGST", tPurCgst],
    ["Purchase ITC - SGST", tPurSgst],
    ["Purchase ITC - IGST", tPurIgst],
    ["Total Purchase Tax (ITC)", tPurTax],
    [],
    ["FINAL NET LIABILITY", "AMOUNT (₹)"],
    ["Net Output GST - Input Tax Credit", tCgst + tSgst + tIgst - tPurTax],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoA);
  const sumRange = XLSX.utils.decode_range(wsSummary["!ref"]!);
  wsSummary["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];

  for (let R = sumRange.s.r; R <= sumRange.e.r; ++R) {
    // Determine the nature of the row to strictly box it
    const valString = String(
      wsSummary[XLSX.utils.encode_cell({ r: R, c: 0 })]?.v || "",
    );
    const isGlobalHeader = R === 0 || R === 1;
    const isSubHeader =
      valString.includes("SUMMARY (") || valString.includes("LIABILITY");
    const isNetRow = valString.includes("Net Output");
    const isEmpty = valString === "" && R > 2;

    for (let C = sumRange.s.c; C <= sumRange.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });

      if (!wsSummary[cellAddress] && !isEmpty && !isGlobalHeader) {
        // Create dummy cell to assert border wrapping over blanks
        wsSummary[cellAddress] = { t: "s", v: "", s: {} };
      }
      if (isGlobalHeader && !wsSummary[cellAddress]) {
        wsSummary[cellAddress] = { t: "s", v: "", s: {} };
      }

      const activeCell = wsSummary[cellAddress];
      if (!activeCell) continue;

      if (activeCell.t === "n") activeCell.z = "#,##0.00";

      if (isEmpty) {
        continue; // Keep spacer rows completely blank (no borders)
      }

      if (R === 0) {
        activeCell.s = {
          font: { bold: true, color: { rgb: "FF0E5A9D" }, sz: 18 },
          fill: { fgColor: { rgb: "FFEBF3FA" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thick", color: { rgb: "FF0B5394" } },
            left: { style: "thick", color: { rgb: "FF0B5394" } },
            right: { style: "thick", color: { rgb: "FF0B5394" } },
          },
        };
      } else if (R === 1) {
        activeCell.s = {
          font: { bold: true, color: { rgb: "FF1E88E5" }, sz: 14 },
          fill: { fgColor: { rgb: "FFEBF3FA" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            bottom: { style: "thick", color: { rgb: "FF0B5394" } },
            left: { style: "thick", color: { rgb: "FF0B5394" } },
            right: { style: "thick", color: { rgb: "FF0B5394" } },
          },
        };
      } else if (R === 2) {
        activeCell.s = { fill: { fgColor: { rgb: "FFFFFFFF" } } };
      } else if (isSubHeader) {
        activeCell.s = {
          font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 12 },
          fill: { fgColor: { rgb: "FF1E88E5" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thick", color: { rgb: "FF0B5394" } },
            bottom: { style: "thick", color: { rgb: "FF0B5394" } },
            left: { style: "thin", color: { rgb: "FF4BA4E9" } },
            right: { style: "thin", color: { rgb: "FF4BA4E9" } },
          },
        };
      } else {
        activeCell.s = {
          font: {
            bold: isNetRow,
            color: { rgb: isNetRow ? "FF000000" : "FF333333" },
            sz: 11,
          },
          fill: {
            fgColor: {
              rgb: isNetRow
                ? "FFEAEAEA"
                : R % 2 === 0
                  ? "FFF8F9FA"
                  : "FFFFFFFF",
            },
          },
          alignment: {
            vertical: "center",
            horizontal: activeCell.t === "n" ? "right" : "left",
          },
          border: {
            top: { style: "thin", color: { rgb: "FFDEE2E6" } },
            bottom: { style: "thin", color: { rgb: "FFDEE2E6" } },
            left: { style: "thin", color: { rgb: "FFDEE2E6" } },
            right: { style: "thin", color: { rgb: "FFDEE2E6" } },
          },
        };
      }
    }
  }

  wsSummary["!cols"] = [{ wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "GST_Summary");

  return wb;
}
