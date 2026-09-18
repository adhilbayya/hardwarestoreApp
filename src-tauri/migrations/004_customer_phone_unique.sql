CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
ON customers(phone)
WHERE phone IS NOT NULL AND phone != '';