import { getDatabase } from "./db";

export type ReportSummary = {
  totalSales: number;
  totalPurchases: number;
  totalBills: number;
  totalTax: number;
  salesTax: number;
  purchaseTax: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
};

export type SalesReportRow = {
  id: number;
  invoice_number: string;
  customer_name: string | null;
  grand_total: number;
  tax_amount: number;
  payment_method: string;
  invoice_date: string;
};

export type PurchaseReportRow = {
  id: number;
  purchase_number: string;
  supplier_name: string | null;
  grand_total: number;
  tax_amount: number;
  payment_method: string;
  purchase_date: string;
};

export type TopSellingProduct = {
  product_id: number;
  product_name: string;
  quantity_sold: number;
  sales_amount: number;
};

/**
 * Get summary numbers for a date range.
 */
export async function getReportSummary(
  fromDate: string,
  toDate: string,
): Promise<ReportSummary> {
  const db = await getDatabase();

  // Sales summary
  const sales = await db.select<
    {
      total_sales: number | null;
      total_bills: number;
      sales_tax: number | null;
      total_discount: number | null;
    }[]
  >(
    `
    SELECT
      COALESCE(SUM(grand_total), 0) AS total_sales,
      COUNT(*) AS total_bills,
      COALESCE(SUM(tax_amount), 0) AS sales_tax,
      COALESCE(SUM(discount_amount), 0) AS total_discount
    FROM invoices
    WHERE date(invoice_date, 'localtime')
      BETWEEN date(?) AND date(?)
    `,
    [fromDate, toDate],
  );

  // Purchase summary
  const purchases = await db.select<
    {
      total_purchases: number | null;
      purchase_tax: number | null;
    }[]
  >(
    `
    SELECT
      COALESCE(SUM(grand_total), 0) AS total_purchases,
      COALESCE(SUM(tax_amount), 0) AS purchase_tax
    FROM purchases
    WHERE date(purchase_date, 'localtime')
      BETWEEN date(?) AND date(?)
    `,
    [fromDate, toDate],
  );

  // Cost of products sold
  const cost = await db.select<
    {
      total_cost: number | null;
    }[]
  >(
    `
    SELECT
      COALESCE(
        SUM(ii.quantity * ii.cost_price),
        0
      ) AS total_cost
    FROM invoice_items ii
    INNER JOIN invoices i
      ON ii.invoice_id = i.id
    WHERE date(i.invoice_date, 'localtime')
      BETWEEN date(?) AND date(?)
    `,
    [fromDate, toDate],
  );

  const totalSales = Number(sales[0]?.total_sales ?? 0);

  const salesTax = Number(sales[0]?.sales_tax ?? 0);

  const purchaseTax = Number(purchases[0]?.purchase_tax ?? 0);

  const totalTax = salesTax + purchaseTax;

  const totalCost = Number(cost[0]?.total_cost ?? 0);

  // Sales excluding sales tax
  const netSales = totalSales - salesTax;

  // Gross profit
  const grossProfit = netSales - totalCost;

  // Profit margin
  const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  return {
    totalSales,
    totalPurchases: Number(purchases[0]?.total_purchases ?? 0),
    totalBills: Number(sales[0]?.total_bills ?? 0),
    totalTax,
    salesTax,
    purchaseTax,
    totalCost,
    grossProfit,
    profitMargin,
  };
}

/**
 * Get sales within a date range.
 */
export async function getSalesReport(
  fromDate: string,
  toDate: string,
): Promise<SalesReportRow[]> {
  const db = await getDatabase();

  return await db.select<SalesReportRow[]>(
    `
    SELECT
      i.id,
      i.invoice_number,
      c.name AS customer_name,
      i.grand_total,
      i.tax_amount,
      i.payment_method,
      i.invoice_date
    FROM invoices i
    LEFT JOIN customers c
      ON i.customer_id = c.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    ORDER BY i.invoice_date DESC, i.id DESC
    `,
    [fromDate, toDate],
  );
}

/**
 * Get purchases within a date range.
 */
export async function getPurchasesReport(
  fromDate: string,
  toDate: string,
): Promise<PurchaseReportRow[]> {
  const db = await getDatabase();

  return await db.select<PurchaseReportRow[]>(
    `
    SELECT
      p.id,
      p.purchase_number,
      s.name AS supplier_name,
      p.grand_total,
      p.tax_amount,
      p.payment_method,
      p.purchase_date
    FROM purchases p
    LEFT JOIN suppliers s
      ON p.supplier_id = s.id
    WHERE date(p.purchase_date, 'localtime') BETWEEN date(?) AND date(?)
    ORDER BY p.purchase_date DESC, p.id DESC
    `,
    [fromDate, toDate],
  );
}

/**
 * Get the top-selling products within a date range.
 */
export async function getTopSellingProducts(
  fromDate: string,
  toDate: string,
): Promise<TopSellingProduct[]> {
  const db = await getDatabase();

  return await db.select<TopSellingProduct[]>(
    `
    SELECT
      ii.product_id,
      ii.product_name,
      SUM(ii.quantity) AS quantity_sold,
      SUM(ii.line_total) AS sales_amount
    FROM invoice_items ii
    INNER JOIN invoices i
      ON ii.invoice_id = i.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    GROUP BY ii.product_id, ii.product_name
    ORDER BY quantity_sold DESC
    LIMIT 10
    `,
    [fromDate, toDate],
  );
}

export type ItemwiseReportRow = {
  product_id: number;
  product_name: string;
  quantity: number;
  total_amount: number;
  tax_amount: number;
  hsn_sac: string | null;
};

/**
 * Get all items sold within a date range grouped by item.
 */
export async function getItemwiseSalesReport(
  fromDate: string,
  toDate: string,
): Promise<ItemwiseReportRow[]> {
  const db = await getDatabase();

  return await db.select<ItemwiseReportRow[]>(
    `
    SELECT
      ii.product_id,
      ii.product_name,
      SUM(ii.quantity) AS quantity,
      SUM(ii.line_total) AS total_amount,
      SUM(ii.tax_amount) AS tax_amount,
      MAX(pr.hsn_sac) AS hsn_sac
    FROM invoice_items ii
    INNER JOIN invoices i
      ON ii.invoice_id = i.id
    LEFT JOIN products pr
      ON ii.product_id = pr.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    GROUP BY ii.product_id, ii.product_name
    ORDER BY quantity DESC
    `,
    [fromDate, toDate],
  );
}

/**
 * Get all items purchased within a date range grouped by item.
 */
export async function getItemwisePurchaseReport(
  fromDate: string,
  toDate: string,
): Promise<ItemwiseReportRow[]> {
  const db = await getDatabase();

  return await db.select<ItemwiseReportRow[]>(
    `
    SELECT
      pi.product_id,
      pi.product_name,
      SUM(pi.quantity) AS quantity,
      SUM(pi.line_total) AS total_amount,
      SUM(pi.tax_amount) AS tax_amount,
      MAX(pr.hsn_sac) AS hsn_sac
    FROM purchase_items pi
    INNER JOIN purchases p
      ON pi.purchase_id = p.id
    LEFT JOIN products pr
      ON pi.product_id = pr.id
    WHERE date(p.purchase_date, 'localtime') BETWEEN date(?) AND date(?)
    GROUP BY pi.product_id, pi.product_name
    ORDER BY quantity DESC
    `,
    [fromDate, toDate],
  );
}
