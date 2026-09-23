CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER,
    purchase_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    grand_total NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    tax_rate NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    line_total NUMERIC NOT NULL DEFAULT 0,

    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_purchases_date
    ON purchases(purchase_date);

CREATE INDEX IF NOT EXISTS idx_purchases_number
    ON purchases(purchase_number);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier
    ON purchases(supplier_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase
    ON purchase_items(purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product
    ON purchase_items(product_id);