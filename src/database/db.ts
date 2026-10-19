import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDatabase() {
  if (!db) {
    db = await Database.load("sqlite:hardware_store.db");

    // Seamlessly patch missing columns for transitioning installations
    const patches = [
      // invoices
      "ALTER TABLE invoices ADD COLUMN tax_type TEXT DEFAULT 'CGST_SGST'",
      "ALTER TABLE invoices ADD COLUMN vehicle_number TEXT",
      "ALTER TABLE invoices ADD COLUMN driver_details TEXT",
      // customers
      "ALTER TABLE customers ADD COLUMN state_name TEXT",
      "ALTER TABLE customers ADD COLUMN state_code TEXT",
      // products
      "ALTER TABLE products ADD COLUMN hsn_code TEXT",
      "ALTER TABLE products ADD COLUMN barcode TEXT",
      "ALTER TABLE products ADD COLUMN brand TEXT",
      "ALTER TABLE products ADD COLUMN hsn_sac TEXT",
      "ALTER TABLE products ADD COLUMN uom TEXT",
      "ALTER TABLE products ADD COLUMN tax_rate NUMERIC DEFAULT 0",
      "ALTER TABLE products ADD COLUMN wholesale_price NUMERIC NOT NULL DEFAULT 0",
      "ALTER TABLE products ADD COLUMN mrp NUMERIC NOT NULL DEFAULT 0",
      "ALTER TABLE products ADD COLUMN average_cost NUMERIC NOT NULL DEFAULT 0",
      "ALTER TABLE products ADD COLUMN has_bulk INTEGER DEFAULT 0",
      "ALTER TABLE products ADD COLUMN bulk_unit TEXT",
      "ALTER TABLE products ADD COLUMN bulk_conversion_rate REAL",
      "ALTER TABLE products ADD COLUMN bulk_price REAL",
      // invoice_items
      "ALTER TABLE invoice_items ADD COLUMN is_bulk INTEGER DEFAULT 0",
      "ALTER TABLE invoice_items ADD COLUMN bulk_multiplier REAL DEFAULT 1",
      "ALTER TABLE invoice_items ADD COLUMN cost_price NUMERIC NOT NULL DEFAULT 0",
    ];

    for (const patch of patches) {
      try {
        await db.execute(patch);
      } catch (e) {
        // Will throw if column already exists, safely ignore
      }
    }

    // Ensure quotations tables exist
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS quotations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quotation_number TEXT NOT NULL UNIQUE,
          customer_id INTEGER,
          quotation_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          subtotal NUMERIC NOT NULL DEFAULT 0,
          tax_amount NUMERIC NOT NULL DEFAULT 0,
          discount_amount NUMERIC NOT NULL DEFAULT 0,
          grand_total NUMERIC NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'PENDING',
          notes TEXT,
          tax_type TEXT NOT NULL DEFAULT 'CGST_SGST',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          converted_invoice_id INTEGER,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
      `);
      await db.execute(`
        CREATE TABLE IF NOT EXISTS quotation_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quotation_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          quantity NUMERIC NOT NULL,
          unit_price NUMERIC NOT NULL,
          cost_price NUMERIC NOT NULL DEFAULT 0,
          tax_rate NUMERIC NOT NULL DEFAULT 0,
          tax_amount NUMERIC NOT NULL DEFAULT 0,
          discount_amount NUMERIC NOT NULL DEFAULT 0,
          line_total NUMERIC NOT NULL,
          is_bulk INTEGER DEFAULT 0,
          bulk_multiplier REAL DEFAULT 1,
          FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
      `);
    } catch (e) {
      console.warn("Could not ensure quotation tables:", e);
    }

    // Seamlessly ensure average_cost is stored in base units (loose units), not bulk units
    try {
      await db.execute(`
        UPDATE products
        SET average_cost = purchase_price
        WHERE has_bulk = 1
          AND bulk_conversion_rate > 1
          AND average_cost > purchase_price * 2
      `);
      await db.execute(`
        UPDATE products
        SET average_cost = purchase_price
        WHERE average_cost <= 0 AND purchase_price > 0
      `);
      await db.execute(`
        UPDATE invoice_items
        SET cost_price = (SELECT purchase_price FROM products WHERE products.id = invoice_items.product_id)
        WHERE product_id IN (
          SELECT id FROM products WHERE has_bulk = 1 AND bulk_conversion_rate > 1
        )
        AND cost_price > (
          SELECT purchase_price * 2 FROM products WHERE products.id = invoice_items.product_id
        )
      `);
    } catch (e) {
      console.warn("Could not normalize average_cost:", e);
    }
  }

  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}
