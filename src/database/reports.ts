import { getDatabase } from "./db";

export type ReportSummary = {
  totalSales: number;
  grossSales: number;
  totalPurchases: number;
  totalBills: number;
  totalTax: number;
  salesTax: number;
  purchaseTax: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
};

export type SalesReportRow = {
  id: number;
  invoice_number: string;
  customer_name: string | null;
  grand_total: number;
  paid_amount?: number;
  balance_amount?: number;
  tax_amount: number;
  payment_method: string;
  invoice_date: string;
  customer_phone: string | null;
  notes?: string | null;
};

export type PurchaseReportRow = {
  id: number;
  purchase_number: string;
  bill_number?: string | null;
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
 * Robust item cost calculator that resolves bulk packages vs loose pieces,
 * weighted average cost, and tax-inclusive historical pricing anomalies.
 */
export function computeItemCost(it: {
  quantity: number;
  unit_price: number;
  cost_price: number;
  is_bulk?: number | boolean;
  bulk_multiplier?: number;
  prod_pp?: number | null;
  prod_ac?: number | null;
  prod_sp?: number | null;
  prod_rate?: number | null;
  prod_tax_rate?: number | null;
}): number {
  const qty = Number(it.quantity || 0);
  if (qty <= 0) return 0;

  const isBulk = it.is_bulk === 1 || it.is_bulk === true;
  const mult =
    it.bulk_multiplier && it.bulk_multiplier > 1
      ? it.bulk_multiplier
      : it.prod_rate && it.prod_rate > 1
        ? it.prod_rate
        : 1;

  // 1. Determine base unit cost (priority: average_cost from real purchases, then purchase_price, then recorded cost_price)
  let baseUnitCost =
    it.prod_ac && it.prod_ac > 0
      ? it.prod_ac
      : it.prod_pp && it.prod_pp > 0
        ? it.prod_pp
        : it.cost_price > 0
          ? it.cost_price
          : 0;

  // Reference single base unit selling price
  const baseSellingPrice =
    it.prod_sp && it.prod_sp > 0
      ? it.prod_sp
      : isBulk && mult > 1
        ? it.unit_price / mult
        : it.unit_price;

  // 2. Safeguard: if baseUnitCost was entered as the package/box cost for a bulk product
  if (mult > 1 && baseSellingPrice > 0 && baseUnitCost > baseSellingPrice * 1.5) {
    baseUnitCost = baseUnitCost / mult;
  }

  // 3. Safeguard: if baseUnitCost was entered with GST included (e.g. GI wire)
  const taxRate = it.prod_tax_rate && it.prod_tax_rate > 0 ? it.prod_tax_rate : 18;
  if (baseSellingPrice > 0 && baseUnitCost > baseSellingPrice && baseUnitCost / (1 + taxRate / 100) <= baseSellingPrice) {
    baseUnitCost = baseUnitCost / (1 + taxRate / 100);
  }

  // 4. Calculate cost per unit sold:
  // If bulk: cost per bulk unit is baseUnitCost * mult
  // If loose: cost per loose unit is baseUnitCost
  let unitCost = isBulk ? baseUnitCost * mult : baseUnitCost;

  // 5. Absolute safeguard: cost per unit sold should never exceed the selling price of that unit
  const sellingUnitPrice = it.unit_price > 0 ? it.unit_price : baseSellingPrice;
  if (sellingUnitPrice > 0 && unitCost > sellingUnitPrice) {
    if (unitCost / (1 + taxRate / 100) <= sellingUnitPrice) {
      unitCost = unitCost / (1 + taxRate / 100);
    } else {
      // Data entry typo -> normalize to 85% of selling price to prevent negative profit
      unitCost = sellingUnitPrice * 0.85;
    }
  }

  return qty * unitCost;
}

/**
 * Get summary numbers for a date range.
 */
export async function getReportSummary(
  fromDate: string,
  toDate: string,
): Promise<ReportSummary> {
  const db = await getDatabase();

  // Sales summary (net_sales excludes GST, gross_sales includes GST)
  const sales = await db.select<
    {
      net_sales: number | null;
      gross_sales: number | null;
      total_bills: number;
      sales_tax: number | null;
      total_discount: number | null;
    }[]
  >(
    `
    SELECT
      COALESCE(SUM(subtotal), 0) AS net_sales,
      COALESCE(SUM(grand_total), 0) AS gross_sales,
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

  // Operating Expenses summary
  let totalExpenses = 0;
  try {
    const expensesRows = await db.select<{ total_expenses: number | null }[]>(
      `
      SELECT COALESCE(SUM(amount), 0) AS total_expenses
      FROM expenses
      WHERE date(expense_date) BETWEEN date(?) AND date(?)
      `,
      [fromDate, toDate],
    );
    totalExpenses = Number(expensesRows[0]?.total_expenses ?? 0);
  } catch (e) {
    // If expenses table not queried or empty
  }

  // Cost of products sold: Calculate with exact per-line unit & bulk matching
  const items = await db.select<any[]>(
    `
    SELECT
      ii.id,
      ii.quantity,
      ii.unit_price,
      ii.cost_price,
      ii.is_bulk,
      ii.bulk_multiplier,
      pr.purchase_price AS prod_pp,
      pr.average_cost AS prod_ac,
      pr.selling_price AS prod_sp,
      pr.bulk_conversion_rate AS prod_rate,
      pr.tax_rate AS prod_tax_rate
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN products pr ON ii.product_id = pr.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    `,
    [fromDate, toDate],
  );

  let totalCost = 0;
  for (const it of items) {
    totalCost += computeItemCost(it);
  }

  const netSales = Number(sales[0]?.net_sales ?? 0);
  const grossSales = Number(sales[0]?.gross_sales ?? 0);
  const salesTax = Number(sales[0]?.sales_tax ?? 0);
  const purchaseTax = Number(purchases[0]?.purchase_tax ?? 0);
  const totalTax = salesTax + purchaseTax;

  // Gross profit is net sales revenue (excluding GST) minus inventory cost of goods sold
  const grossProfit = netSales - totalCost;
  const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // Net profit is gross profit minus operating expenses (rent, electricity, tea, salaries, etc.)
  const netProfit = grossProfit - totalExpenses;
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  return {
    totalSales: netSales,
    grossSales,
    totalPurchases: Number(purchases[0]?.total_purchases ?? 0),
    totalBills: Number(sales[0]?.total_bills ?? 0),
    totalTax,
    salesTax,
    purchaseTax,
    totalCost,
    grossProfit,
    profitMargin,
    totalExpenses,
    netProfit,
    netMargin,
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
      COALESCE(i.paid_amount, i.grand_total) AS paid_amount,
      COALESCE(i.balance_amount, 0) AS balance_amount,
      i.tax_amount,
      i.payment_method,
      i.invoice_date,
      c.phone AS customer_phone,
      i.notes
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
      p.bill_number,
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
  total_cost?: number;
  gross_profit?: number;
  profit_margin?: number;
};

/**
 * Get all items sold within a date range grouped by item with profit and margin.
 */
export async function getItemwiseSalesReport(
  fromDate: string,
  toDate: string,
): Promise<ItemwiseReportRow[]> {
  const db = await getDatabase();

  const items = await db.select<any[]>(
    `
    SELECT
      ii.id,
      ii.product_id,
      ii.product_name,
      ii.quantity,
      ii.unit_price,
      ii.cost_price,
      ii.line_total,
      ii.tax_amount,
      ii.is_bulk,
      ii.bulk_multiplier,
      pr.hsn_sac,
      pr.purchase_price AS prod_pp,
      pr.average_cost AS prod_ac,
      pr.selling_price AS prod_sp,
      pr.bulk_conversion_rate AS prod_rate,
      pr.tax_rate AS prod_tax_rate
    FROM invoice_items ii
    INNER JOIN invoices i
      ON ii.invoice_id = i.id
    LEFT JOIN products pr
      ON ii.product_id = pr.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
    `,
    [fromDate, toDate],
  );

  const productMap = new Map<
    string,
    {
      product_id: number;
      product_name: string;
      quantity: number;
      net_sales: number;
      tax_amount: number;
      total_cost: number;
      hsn_sac: string | null;
    }
  >();

  for (const it of items) {
    const key = `${it.product_id || 0}_${it.product_name}`;
    const cost = computeItemCost(it);
    const netSales = Number(it.line_total || 0);
    const tax = Number(it.tax_amount || 0);

    if (!productMap.has(key)) {
      productMap.set(key, {
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: 0,
        net_sales: 0,
        tax_amount: 0,
        total_cost: 0,
        hsn_sac: it.hsn_sac || null,
      });
    }

    const p = productMap.get(key)!;
    p.quantity += Number(it.quantity || 0);
    p.net_sales += netSales;
    p.tax_amount += tax;
    p.total_cost += cost;
  }

  const grouped = Array.from(productMap.values()).map((p) => {
    const grossProfit = p.net_sales - p.total_cost;
    const margin = p.net_sales > 0 ? (grossProfit / p.net_sales) * 100 : 0;
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      quantity: Number(p.quantity.toFixed(2)),
      total_amount: p.net_sales,
      tax_amount: p.tax_amount,
      hsn_sac: p.hsn_sac,
      total_cost: p.total_cost,
      gross_profit: grossProfit,
      profit_margin: margin,
    };
  });

  grouped.sort((a, b) => b.quantity - a.quantity);
  return grouped;
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
