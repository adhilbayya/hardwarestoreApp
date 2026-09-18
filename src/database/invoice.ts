import { getDatabase } from "./db";

export type InvoiceItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
};

export type CreateInvoiceData = {
  customer_id?: number | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  payment_method: string;
  notes?: string | null;
  items: InvoiceItem[];
};

export async function getNextInvoiceNumber(): Promise<string> {
  const db = await getDatabase();

  const result = await db.select<{ max_number: number | null }[]>(
    `
    SELECT MAX(
      CAST(
        SUBSTR(invoice_number, 5)
        AS INTEGER
      )
    ) AS max_number
    FROM invoices
    WHERE invoice_number LIKE 'INV-%'
    `,
  );

  const maxNumber = result[0]?.max_number ?? 0;

  const nextNumber = maxNumber + 1;

  return `INV-${String(nextNumber).padStart(6, "0")}`;
}

export async function createInvoice(
  invoice: CreateInvoiceData,
): Promise<{ invoiceNumber: string; invoiceId: number }> {
  const db = await getDatabase();

  const invoiceNumber = await getNextInvoiceNumber();

  // Check stock BEFORE starting the transaction.
  // This keeps the transaction as short as possible.
  for (const item of invoice.items) {
    const stock = await db.select<
      {
        stock_quantity: number;
      }[]
    >(
      `
      SELECT stock_quantity
      FROM products
      WHERE id = ?
        AND is_active = 1
      `,
      [item.product_id],
    );

    if (!stock.length) {
      throw new Error(`Product not found: ${item.product_name}`);
    }

    if (stock[0].stock_quantity < item.quantity) {
      throw new Error(`Insufficient stock for: ${item.product_name}`);
    }
  }

  try {
    // Create invoice
    const invoiceResult = await db.execute(
      `
      INSERT INTO invoices (
        invoice_number,
        customer_id,
        subtotal,
        tax_amount,
        discount_amount,
        grand_total,
        payment_method,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        invoiceNumber,
        invoice.customer_id ?? null,
        invoice.subtotal,
        invoice.tax_amount,
        invoice.discount_amount,
        invoice.grand_total,
        invoice.payment_method,
        invoice.notes ?? null,
      ],
    );

    const invoiceId = invoiceResult.lastInsertId;

    if (!invoiceId) {
      throw new Error("Failed to create invoice.");
    }

    // Add invoice items
    for (const item of invoice.items) {
      await db.execute(
        `
        INSERT INTO invoice_items (
          invoice_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          tax_rate,
          tax_amount,
          discount_amount,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          invoiceId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.tax_rate,
          item.tax_amount,
          item.discount_amount,
          item.line_total,
        ],
      );

      // Reduce stock
      await db.execute(
        `
        UPDATE products
        SET
          stock_quantity = stock_quantity - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND is_active = 1
          AND stock_quantity >= ?
        `,
        [item.quantity, item.product_id, item.quantity],
      );
    }

    return {
      invoiceNumber,
      invoiceId: invoiceId as number,
    };
  } catch (error) {
    console.error("Invoice creation failed:", error);

    throw error;
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  const db = await getDatabase();

  return await db.select<Invoice[]>(
    `
    SELECT
      id,
      invoice_number,
      customer_id,
      invoice_date,
      subtotal,
      tax_amount,
      discount_amount,
      grand_total,
      payment_method,
      notes,
      created_at
    FROM invoices
    ORDER BY id DESC
    `,
  );
}

export async function getInvoiceById(id: number): Promise<{
  invoice: Invoice;
  items: InvoiceItem[];
}> {
  const db = await getDatabase();

  const invoices = await db.select<Invoice[]>(
    `
    SELECT
      id,
      invoice_number,
      customer_id,
      invoice_date,
      subtotal,
      tax_amount,
      discount_amount,
      grand_total,
      payment_method,
      notes,
      created_at
    FROM invoices
    WHERE id = ?
    `,
    [id],
  );

  if (!invoices.length) {
    throw new Error("Invoice not found.");
  }

  const items = await db.select<InvoiceItem[]>(
    `
    SELECT
      product_id,
      product_name,
      quantity,
      unit_price,
      tax_rate,
      tax_amount,
      discount_amount,
      line_total
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY id ASC
    `,
    [id],
  );

  return {
    invoice: invoices[0],
    items,
  };
}
