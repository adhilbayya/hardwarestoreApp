import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDatabase() {
  if (!db) {
    db = await Database.load("sqlite:hardware_store.db");

    // Seamlessly patch missing columns for transitioning installations
    const patches = [
      "ALTER TABLE invoices ADD COLUMN tax_type TEXT DEFAULT 'CGST_SGST'",
      "ALTER TABLE customers ADD COLUMN state_name TEXT",
      "ALTER TABLE customers ADD COLUMN state_code TEXT",
      "ALTER TABLE products ADD COLUMN hsn_code TEXT",
      "ALTER TABLE products ADD COLUMN barcode TEXT",
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
