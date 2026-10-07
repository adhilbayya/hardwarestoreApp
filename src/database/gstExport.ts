import { getDatabase } from "./db";
import * as XLSX from "xlsx-js-style";

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
  // 1. Daily Summary
  // -----------------------------------------------------
  const dailySummaryRaw = await db.select<any[]>(
    `
    SELECT 
      date(invoice_date, 'localtime') as invoice_date, 
      COUNT(id) as invoice_count,
      SUM(subtotal) as taxable_amount,
      SUM(tax_amount) as tax_amount,
      SUM(grand_total) as total_amount
    FROM invoices 
    WHERE date(invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    GROUP BY date(invoice_date, 'localtime')
    ORDER BY date(invoice_date, 'localtime')
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
  // 2. Sales Register
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
      i.subtotal as taxable_amount,
      i.tax_amount,
      i.grand_total as total_amount
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
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
  // 3. GSTR1 B2B
  // -----------------------------------------------------
  const b2bRaw = await db.select<any[]>(
    `
    SELECT
      c.gstin,
      c.name,
      i.invoice_number,
      date(i.invoice_date, 'localtime') as invoice_date,
      i.grand_total as invoice_value,
      c.state_code as place_of_supply,
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
    GROUP BY i.id, ii.tax_rate
    ORDER BY date(i.invoice_date, 'localtime'), i.id
    `,
    [fromDate, toDate],
  );

  let b2bTaxable = 0;
  const b2bData = b2bRaw.map((r) => {
    b2bTaxable += r.taxable_value || 0;
    return {
      "GSTIN/UIN": r.gstin,
      "Receiver Name": r.name || "",
      "Invoice Number": r.invoice_number,
      "Invoice Date": r.invoice_date,
      "Invoice Value": r.invoice_value,
      "Place of Supply": r.place_of_supply || "",
      "Reverse Charge": "N",
      "Invoice Type": r.invoice_type || "",
      "E-Commerce GSTIN": "",
      Rate: r.tax_rate,
      "Taxable Value": r.taxable_value,
      "Integrated Tax": r.integrated_tax,
      "Central Tax": r.central_tax,
      "State/UT Tax": r.state_tax,
      Cess: 0,
    };
  });
  const wsB2B = createBespokeSheet(b2bData, "GSTR-1 (B2B SALES)");
  XLSX.utils.book_append_sheet(wb, wsB2B, "GSTR1_B2B");

  // -----------------------------------------------------
  // 4. GSTR1 B2C
  // -----------------------------------------------------
  const b2cRaw = await db.select<any[]>(
    `
    SELECT
      i.invoice_number,
      date(i.invoice_date, 'localtime') as invoice_date,
      i.grand_total as invoice_value,
      c.state_code as place_of_supply,
      ii.tax_rate,
      SUM(ii.line_total) as taxable_value,
      SUM(CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as integrated_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as central_tax,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as state_tax
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND IFNULL(c.gstin, '') = '' 
    GROUP BY i.id, ii.tax_rate
    ORDER BY date(i.invoice_date, 'localtime'), i.id
    `,
    [fromDate, toDate],
  );

  let b2cTaxable = 0;
  const b2cData = b2cRaw.map((r) => {
    b2cTaxable += r.taxable_value || 0;
    return {
      "Invoice Date": r.invoice_date,
      "Invoice Number": r.invoice_number,
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

  // -----------------------------------------------------
  // 5. Tax Split Detail
  // -----------------------------------------------------
  const splitRaw = await db.select<any[]>(
    `
    SELECT
      date(i.invoice_date, 'localtime') as invoice_date,
      i.invoice_number,
      i.tax_type as invoice_type,
      c.name as customer_name,
      c.gstin as customer_gstin,
      ii.product_name,
      p.hsn_sac,
      ii.quantity,
      COALESCE(u.symbol, u.name, p.uom) as unit_symbol,
      ii.unit_price,
      ii.discount_amount,
      ii.line_total as taxable_value,
      ii.tax_rate as gst_rate,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_rate / 2 ELSE 0 END) as cgst_rate,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as cgst_amount,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_rate / 2 ELSE 0 END) as sgst_rate,
      (CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END) as sgst_amount,
      (CASE WHEN i.tax_type = 'IGST' THEN ii.tax_rate ELSE 0 END) as igst_rate,
      (CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END) as igst_amount,
      (ii.line_total + ii.tax_amount) as invoice_total
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN products p ON ii.product_id = p.id
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    `,
    [fromDate, toDate],
  );

  const splitData = splitRaw.map((r) => ({
    "Invoice Date": r.invoice_date,
    "Invoice Number": r.invoice_number,
    "Invoice Type": r.invoice_type || "",
    "Customer/Party": r.customer_name || "",
    "Customer GSTIN": r.customer_gstin || "",
    "Product Name": r.product_name || "",
    "HSN/SAC": r.hsn_sac || "",
    Quantity: r.quantity,
    Unit: translateUQC(r.unit_symbol),
    "Unit Price": r.unit_price,
    Discount: r.discount_amount,
    "Taxable Value": r.taxable_value,
    "GST Rate": r.gst_rate,
    "CGST Rate": r.cgst_rate,
    "CGST Amount": r.cgst_amount,
    "SGST Rate": r.sgst_rate,
    "SGST Amount": r.sgst_amount,
    "IGST Rate": r.igst_rate,
    "IGST Amount": r.igst_amount,
    Cess: 0,
    "Invoice Total": r.invoice_total,
  }));
  const wsSplit = createBespokeSheet(splitData, "TAX SPLIT DETAILS");
  XLSX.utils.book_append_sheet(wb, wsSplit, "Tax_Split_Detail");

  // -----------------------------------------------------
  // 6. HSN
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
    GROUP BY p.hsn_sac, COALESCE(u.symbol, u.name, p.uom), ii.tax_rate
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
  // 7. HSN B2C
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
    GROUP BY p.hsn_sac, COALESCE(u.symbol, u.name, p.uom), ii.tax_rate
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

  // Derive CGST/SGST/IGST overall totals
  const overallTax = await db.select<any[]>(
    `
    SELECT
      SUM(CASE WHEN i.tax_type = 'IGST' THEN i.tax_amount ELSE 0 END) as igst,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN i.tax_amount / 2 ELSE 0 END) as cgst,
      SUM(CASE WHEN i.tax_type = 'CGST_SGST' THEN i.tax_amount / 2 ELSE 0 END) as sgst
    FROM invoices i
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    `,
    [fromDate, toDate],
  );
  if (overallTax.length > 0) {
    tIgst = overallTax[0].igst || 0;
    tCgst = overallTax[0].cgst || 0;
    tSgst = overallTax[0].sgst || 0;
  }

  // -----------------------------------------------------
  // 9. Purchase Register & ITC derived split
  // -----------------------------------------------------
  const purTotals = await db.select<any[]>(
    `
    SELECT 
      p.purchase_date,
      p.purchase_number,
      s.name as supplier_name,
      s.gstin as supplier_gstin,
      p.subtotal,
      p.discount_amount,
      p.tax_amount,
      p.grand_total,
      (CASE 
        WHEN s.gstin IS NULL THEN 'CGST_SGST'
        WHEN s.gstin = '' THEN 'CGST_SGST'
        WHEN substr(s.gstin, 1, 2) = '33' THEN 'CGST_SGST'
        ELSE 'IGST' 
      END) as derived_tax_type
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE date(p.purchase_date, 'localtime') BETWEEN date(?) AND date(?)
    ORDER BY date(p.purchase_date) ASC
    `,
    [fromDate, toDate],
  );

  const purData: any[] = [];
  let tPurSubtotal = 0,
    tPurDiscount = 0,
    tPurTax = 0,
    tPurGrand = 0;
  let tPurCgst = 0,
    tPurSgst = 0,
    tPurIgst = 0;

  purTotals.forEach((r) => {
    const isIgst = r.derived_tax_type === "IGST";
    const cgst = isIgst ? 0 : r.tax_amount / 2;
    const sgst = isIgst ? 0 : r.tax_amount / 2;
    const igst = isIgst ? r.tax_amount : 0;

    tPurCgst += cgst;
    tPurSgst += sgst;
    tPurIgst += igst;
    tPurSubtotal += r.subtotal;
    tPurDiscount += r.discount_amount;
    tPurTax += r.tax_amount;
    tPurGrand += r.grand_total;

    purData.push({
      Date: r.purchase_date ? r.purchase_date.split(" ")[0] : "",
      "Purchase No": r.purchase_number,
      Supplier: r.supplier_name || "Cash/Unknown",
      GSTIN: r.supplier_gstin || "",
      Subtotal: r.subtotal,
      Discount: r.discount_amount,
      CGST: cgst,
      SGST: sgst,
      IGST: igst,
      "Total Tax": r.tax_amount,
      "Grand Total": r.grand_total,
    });
  });

  if (purData.length > 0) {
    purData.push({
      Date: "TOTAL",
      "Purchase No": "",
      Supplier: "",
      GSTIN: "",
      Subtotal: tPurSubtotal,
      Discount: tPurDiscount,
      CGST: tPurCgst,
      SGST: tPurSgst,
      IGST: tPurIgst,
      "Total Tax": tPurTax,
      "Grand Total": tPurGrand,
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
