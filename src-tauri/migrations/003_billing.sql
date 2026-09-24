CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    phone TEXT,

    address TEXT,

    gstin TEXT,

    state_name TEXT,

    state_code TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_name
    ON customers(name);

CREATE INDEX IF NOT EXISTS idx_customers_phone
    ON customers(phone);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    invoice_number TEXT NOT NULL UNIQUE,

    customer_id INTEGER,

    invoice_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    subtotal NUMERIC NOT NULL DEFAULT 0,

    tax_amount NUMERIC NOT NULL DEFAULT 0,

    discount_amount NUMERIC NOT NULL DEFAULT 0,

    grand_total NUMERIC NOT NULL DEFAULT 0,

    payment_method TEXT NOT NULL DEFAULT 'Cash',

    notes TEXT,

    tax_type TEXT NOT NULL DEFAULT 'CGST_SGST',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    invoice_id INTEGER NOT NULL,

    product_id INTEGER NOT NULL,

    product_name TEXT NOT NULL,

    quantity NUMERIC NOT NULL,

    unit_price NUMERIC NOT NULL,

    tax_rate NUMERIC NOT NULL DEFAULT 0,

    tax_amount NUMERIC NOT NULL DEFAULT 0,

    discount_amount NUMERIC NOT NULL DEFAULT 0,

    line_total NUMERIC NOT NULL DEFAULT 0,

    FOREIGN KEY (invoice_id) REFERENCES invoices(id),

    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_date
    ON invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoices_number
    ON invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
    ON invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_product
    ON invoice_items(product_id);