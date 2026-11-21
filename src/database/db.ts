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
      // purchases
      "ALTER TABLE purchases ADD COLUMN bill_number TEXT",
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

    // Ensure expenses table exists
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          category TEXT NOT NULL,
          amount NUMERIC NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'Cash',
          recipient TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.warn("Could not ensure expenses table:", e);
    }

    // Seamlessly ensure invoices have paid_amount and balance_amount
    try {
      const invoiceCols = await db.select<{ name: string }[]>(
        "PRAGMA table_info(invoices);",
      );
      const colNames = invoiceCols.map((c) => c.name);
      if (!colNames.includes("paid_amount")) {
        await db.execute(
          "ALTER TABLE invoices ADD COLUMN paid_amount NUMERIC DEFAULT NULL;",
        );
      }
      if (!colNames.includes("balance_amount")) {
        await db.execute(
          "ALTER TABLE invoices ADD COLUMN balance_amount NUMERIC DEFAULT NULL;",
        );
      }
    } catch (e) {
      console.warn("Could not patch invoices columns:", e);
    }

    // Ensure customer_payments table exists for tracking customer ledger payments
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS customer_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          invoice_id INTEGER,
          payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          amount NUMERIC NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'Cash',
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        );
      `);

      // One-time backfill historical payments from existing invoices
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      const backfillStatus = await db.select<{ value: string }[]>(
        "SELECT value FROM app_settings WHERE key = 'customer_payments_backfilled_v2'",
      );

      if (!backfillStatus || backfillStatus.length === 0) {
        // Clear any partial backfill
        await db.execute("DELETE FROM customer_payments");

        // Backfill all customer invoice payments (handling legacy paid invoices and partial payments)
        await db.execute(`
          INSERT INTO customer_payments (customer_id, invoice_id, payment_date, amount, payment_method, notes)
          SELECT
            i.customer_id,
            i.id,
            i.invoice_date,
            CASE
              WHEN i.paid_amount IS NOT NULL AND i.paid_amount > 0 THEN i.paid_amount
              WHEN i.payment_method NOT IN ('Credit', 'credit') THEN i.grand_total
              WHEN i.payment_method = 'Credit (Paid)' THEN i.grand_total
              ELSE 0
            END AS effective_paid,
            CASE
              WHEN i.payment_method LIKE '%UPI%' THEN 'UPI'
              WHEN i.payment_method LIKE '%Card%' THEN 'Card'
              WHEN i.payment_method LIKE '%Credit%' THEN 'Credit Settlement'
              ELSE 'Cash'
            END,
            'Payment for Bill ' || i.invoice_number
          FROM invoices i
          WHERE i.customer_id IS NOT NULL
            AND (
              (i.paid_amount IS NOT NULL AND i.paid_amount > 0)
              OR (i.paid_amount IS NULL AND i.payment_method NOT IN ('Credit', 'credit'))
              OR (i.paid_amount IS NULL AND i.payment_method = 'Credit (Paid)')
            )
        `);

        await db.execute(
          "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('customer_payments_backfilled_v2', 'true')",
        );
      }
    } catch (e) {
      console.warn("Could not ensure customer_payments table:", e);
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

    // Renumber invoices from Nov 1, 2026 onwards starting from INV-4392 (One-time migration)
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      const migrationStatus = await db.select<{ value: string }[]>(
        "SELECT value FROM app_settings WHERE key = 'nov_2026_renumber_done'",
      );

      if (!migrationStatus || migrationStatus.length === 0) {
        const novInvoices = await db.select<{ id: number; invoice_number: string; invoice_date: string }[]>(
          `
          SELECT id, invoice_number, invoice_date
          FROM invoices
          WHERE date(invoice_date, 'localtime') >= '2026-11-01'
          ORDER BY invoice_date ASC, id ASC
          `,
        );

        if (novInvoices.length > 0) {
          // Step 1: temporarily rename to prevent any unique constraint conflict
          for (const inv of novInvoices) {
            await db.execute(
              "UPDATE invoices SET invoice_number = ? WHERE id = ?",
              [`TEMP_RENUM_${inv.id}`, inv.id],
            );
          }
          // Step 2: assign clean sequential standard prefix INV-4392, INV-4393...
          let num = 4392;
          for (const inv of novInvoices) {
            await db.execute(
              "UPDATE invoices SET invoice_number = ? WHERE id = ?",
              [`INV-${num}`, inv.id],
            );
            num++;
          }
        }

        await db.execute(
          "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('nov_2026_renumber_done', 'true')",
        );
      }
    } catch (e) {
      console.warn("Could not renumber Nov invoices:", e);
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
