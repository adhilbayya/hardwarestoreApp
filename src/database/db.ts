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
  }

  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}
