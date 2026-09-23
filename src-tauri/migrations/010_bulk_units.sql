ALTER TABLE products ADD COLUMN has_bulk INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN bulk_unit TEXT;
ALTER TABLE products ADD COLUMN bulk_conversion_rate REAL;
ALTER TABLE products ADD COLUMN bulk_price REAL;

ALTER TABLE invoice_items ADD COLUMN is_bulk INTEGER DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN bulk_multiplier REAL DEFAULT 1;
