import { getDatabase } from "./db";

export type Product = {
  id: number;

  // Basic information
  barcode: string | null;
  name: string;
  sku: string | null;
  brand: string | null;
  hsn_sac: string | null;
  category_id: number | null;
  category_name: string | null;
  unit_id: number | null;
  unit_name: string | null;
  unit_symbol: string | null;
  uom: string | null;
  tax_rate: number;

  // Pricing
  purchase_price: number;
  selling_price: number;
  wholesale_price: number;
  average_cost: number;
  mrp: number;

  // Inventory
  stock_quantity: number;
  minimum_stock: number;
  has_bulk: number;
  bulk_unit: string | null;
  bulk_conversion_rate: number | null;
  bulk_price: number | null;

  // System
  is_active: number;
  created_at: string;
  updated_at: string;
};

export async function getProducts(): Promise<Product[]> {
  const db = await getDatabase();

  const products = await db.select<Product[]>(
    `
    SELECT
      p.id,
      p.barcode,
      p.name,
      p.sku,
      p.brand,
      p.hsn_sac,

      p.category_id,
      c.name AS category_name,

      p.unit_id,
      u.name AS unit_name,
      u.symbol AS unit_symbol,

      p.uom,
      p.tax_rate,

      p.purchase_price,
      p.selling_price,
      p.wholesale_price,
      p.average_cost,
      p.mrp,

      p.stock_quantity,
      p.minimum_stock,
      p.has_bulk,
      p.bulk_unit,
      p.bulk_conversion_rate,
      p.bulk_price,

      p.is_active,
      p.created_at,
      p.updated_at

    FROM products p

    LEFT JOIN categories c
      ON p.category_id = c.id

    LEFT JOIN units u
      ON p.unit_id = u.id

    WHERE p.is_active = 1

    ORDER BY p.name ASC
    `,
  );

  return products;
}

export async function createProduct(product: {
  barcode?: string | null;
  name: string;
  sku?: string | null;
  brand?: string | null;
  hsn_sac?: string | null;
  category_id?: number | null;
  unit_id?: number | null;
  uom?: string | null;
  tax_rate?: number;

  purchase_price: number;
  selling_price: number;
  wholesale_price?: number;
  mrp?: number;

  stock_quantity: number;
  minimum_stock?: number;

  has_bulk?: number;
  bulk_unit?: string | null;
  bulk_conversion_rate?: number | null;
  bulk_price?: number | null;
}) {
  const db = await getDatabase();

  await db.execute(
    `
    INSERT INTO products (
      barcode,
      name,
      sku,
      brand,
      hsn_sac,
      category_id,
      unit_id,
      uom,
      tax_rate,
      purchase_price,
      average_cost,
      selling_price,
      wholesale_price,
      mrp,
      stock_quantity,
      minimum_stock,
      has_bulk,
      bulk_unit,
      bulk_conversion_rate,
      bulk_price
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      product.barcode ?? null,
      product.name,
      product.sku ?? null,
      product.brand ?? null,
      product.hsn_sac ?? null,
      product.category_id ?? null,
      product.unit_id ?? null,
      product.uom ?? null,
      product.tax_rate ?? 0,

      product.purchase_price,
      product.purchase_price,
      product.selling_price,
      product.wholesale_price ?? 0,
      product.mrp ?? 0,

      product.stock_quantity,
      product.minimum_stock ?? 0,
      product.has_bulk ?? 0,
      product.bulk_unit ?? null,
      product.bulk_conversion_rate ?? null,
      product.bulk_price ?? null,
    ],
  );
}

export async function updateProduct(
  id: number,
  product: {
    barcode?: string | null;
    name: string;
    sku?: string | null;
    brand?: string | null;
    hsn_sac?: string | null;
    category_id?: number | null;
    unit_id?: number | null;
    uom?: string | null;
    tax_rate?: number;

    purchase_price: number;
    selling_price: number;
    wholesale_price?: number;
    mrp?: number;

    stock_quantity: number;
    minimum_stock?: number;

    has_bulk?: number;
    bulk_unit?: string | null;
    bulk_conversion_rate?: number | null;
    bulk_price?: number | null;
  },
) {
  const db = await getDatabase();

  await db.execute(
    `
    UPDATE products
    SET
      barcode = ?,
      name = ?,
      sku = ?,
      brand = ?,
      hsn_sac = ?,
      category_id = ?,
      unit_id = ?,
      uom = ?,
      tax_rate = ?,
      purchase_price = ?,
      selling_price = ?,
      wholesale_price = ?,
      mrp = ?,
      stock_quantity = ?,
      minimum_stock = ?,
      has_bulk = ?,
      bulk_unit = ?,
      bulk_conversion_rate = ?,
      bulk_price = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [
      product.barcode ?? null,
      product.name,
      product.sku ?? null,
      product.brand ?? null,
      product.hsn_sac ?? null,
      product.category_id ?? null,
      product.unit_id ?? null,
      product.uom ?? null,
      product.tax_rate ?? 0,

      product.purchase_price,
      product.selling_price,
      product.wholesale_price ?? 0,
      product.mrp ?? 0,

      product.stock_quantity,
      product.minimum_stock ?? 0,

      product.has_bulk ?? 0,
      product.bulk_unit ?? null,
      product.bulk_conversion_rate ?? null,
      product.bulk_price ?? null,

      id,
    ],
  );
}

export async function deactivateProduct(id: number) {
  const db = await getDatabase();

  await db.execute(
    `
    UPDATE products
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [id],
  );
}
