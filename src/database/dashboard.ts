import { getDatabase } from "./db";

export type DashboardStats = {
  todaySales: number;
  todayBills: number;
  todayPurchases: number;
  totalProducts: number;
};

export type RecentSale = {
  id: number;
  invoice_number: string;
  customer_name: string | null;
  grand_total: number;
  payment_method: string;
  invoice_date: string;
};

export type RecentPurchase = {
  id: number;
  purchase_number: string;
  supplier_name: string | null;
  grand_total: number;
  payment_method: string;
  purchase_date: string;
};

export type LowStockProduct = {
  id: number;
  name: string;
  stock_quantity: number;
  minimum_stock: number;
  unit_symbol: string | null;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDatabase();

  const sales = await db.select<
    {
      today_sales: number | null;
      today_bills: number;
    }[]
  >(
    `
    SELECT
      COALESCE(SUM(grand_total), 0) AS today_sales,
      COUNT(*) AS today_bills
    FROM invoices
    WHERE date(invoice_date) = date('now', 'localtime')
    `,
  );

  const purchases = await db.select<
    {
      today_purchases: number | null;
    }[]
  >(
    `
    SELECT
      COALESCE(SUM(grand_total), 0) AS today_purchases
    FROM purchases
    WHERE date(purchase_date) = date('now', 'localtime')
    `,
  );

  const products = await db.select<
    {
      total_products: number;
    }[]
  >(
    `
    SELECT COUNT(*) AS total_products
    FROM products
    WHERE is_active = 1
    `,
  );

  return {
    todaySales: sales[0]?.today_sales ?? 0,
    todayBills: sales[0]?.today_bills ?? 0,
    todayPurchases: purchases[0]?.today_purchases ?? 0,
    totalProducts: products[0]?.total_products ?? 0,
  };
}

export async function getRecentSales(limit = 5): Promise<RecentSale[]> {
  const db = await getDatabase();

  return await db.select<RecentSale[]>(
    `
    SELECT
      i.id,
      i.invoice_number,
      c.name AS customer_name,
      i.grand_total,
      i.payment_method,
      i.invoice_date
    FROM invoices i
    LEFT JOIN customers c
      ON i.customer_id = c.id
    ORDER BY i.id DESC
    LIMIT ?
    `,
    [limit],
  );
}

export async function getRecentPurchases(limit = 5): Promise<RecentPurchase[]> {
  const db = await getDatabase();

  return await db.select<RecentPurchase[]>(
    `
    SELECT
      p.id,
      p.purchase_number,
      s.name AS supplier_name,
      p.grand_total,
      p.payment_method,
      p.purchase_date
    FROM purchases p
    LEFT JOIN suppliers s
      ON p.supplier_id = s.id
    ORDER BY p.id DESC
    LIMIT ?
    `,
    [limit],
  );
}

export async function getLowStockProducts(): Promise<LowStockProduct[]> {
  const db = await getDatabase();

  return await db.select<LowStockProduct[]>(
    `
    SELECT
      p.id,
      p.name,
      p.stock_quantity,
      p.minimum_stock,
      u.symbol AS unit_symbol
    FROM products p
    LEFT JOIN units u
      ON p.unit_id = u.id
    WHERE
      p.is_active = 1
      AND p.stock_quantity <= p.minimum_stock
    ORDER BY p.stock_quantity ASC
    LIMIT 10
    `,
  );
}
