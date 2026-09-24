import { getDatabase } from "./db";

export type InvoiceItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
  is_bulk?: number;
  bulk_multiplier?: number;
  sku?: string | null;
  hsn_sac?: string | null;
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
  is_redone: number;
  redone_at: string | null;
  tax_type: "CGST_SGST" | "IGST";
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
  tax_type: "CGST_SGST" | "IGST";
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

  // --------------------------------------------------
  // Validate invoice
  // --------------------------------------------------

  if (invoice.items.length === 0) {
    throw new Error("Invoice must contain at least one item.");
  }

  const productIds = new Set<number>();

  for (const item of invoice.items) {
    if (item.quantity <= 0) {
      throw new Error(`Invalid quantity for: ${item.product_name}`);
    }

    if (item.unit_price < 0) {
      throw new Error(`Invalid price for: ${item.product_name}`);
    }

    if (productIds.has(item.product_id)) {
      throw new Error(`Duplicate product in invoice: ${item.product_name}`);
    }

    productIds.add(item.product_id);
  }

  // --------------------------------------------------
  // Check stock BEFORE writing anything
  // --------------------------------------------------

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

    const stockToDeduct = item.quantity * (item.bulk_multiplier || 1);

    if (stock[0].stock_quantity < stockToDeduct) {
      throw new Error(`Insufficient stock for: ${item.product_name}`);
    }
  }

  try {
    // --------------------------------------------------
    // Create invoice
    // --------------------------------------------------

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
        notes,
        tax_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        invoice.tax_type,
      ],
    );

    const invoiceId = invoiceResult.lastInsertId;

    if (!invoiceId) {
      throw new Error("Failed to create invoice.");
    }

    // --------------------------------------------------
    // Add invoice items and reduce stock
    // --------------------------------------------------

    for (const item of invoice.items) {
      // Get current average cost.
      // This is internal and is NOT shown on the
      // customer invoice.

      const productRows = await db.select<
        {
          average_cost: number;
        }[]
      >(
        `
        SELECT average_cost
        FROM products
        WHERE id = ?
          AND is_active = 1
        `,
        [item.product_id],
      );

      const product = productRows[0];

      if (!product) {
        throw new Error(`Product not found: ${item.product_name}`);
      }

      const costPrice = Number(product.average_cost ?? 0);

      // Save invoice item
      await db.execute(
        `
        INSERT INTO invoice_items (
          invoice_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          cost_price,
          tax_rate,
          tax_amount,
          discount_amount,
          line_total,
          is_bulk,
          bulk_multiplier
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          invoiceId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          costPrice,
          item.tax_rate,
          item.tax_amount,
          item.discount_amount,
          item.line_total,
          item.is_bulk ?? 0,
          item.bulk_multiplier ?? 1,
        ],
      );

      // Reduce stock
      const stockToDeduct = item.quantity * (item.bulk_multiplier || 1);
      const stockUpdate = await db.execute(
        `
        UPDATE products
        SET
          stock_quantity = stock_quantity - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND is_active = 1
          AND stock_quantity >= ?
        `,
        [stockToDeduct, item.product_id, stockToDeduct],
      );

      if (stockUpdate.rowsAffected !== 1) {
        throw new Error(`Stock could not be updated for: ${item.product_name}`);
      }
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
      created_at,
      is_redone,
      redone_at,
      tax_type
    FROM invoices
    ORDER BY id DESC
    `,
  );
}

export type CreditInvoice = {
  id: number;
  invoice_number: string;
  customer_name: string | null;
  grand_total: number;
  invoice_date: string;
  payment_method: string;
};

export async function getCreditInvoices(): Promise<CreditInvoice[]> {
  const db = await getDatabase();
  return await db.select<CreditInvoice[]>(
    `
    SELECT
      i.id,
      i.invoice_number,
      c.name AS customer_name,
      i.grand_total,
      i.invoice_date,
      i.payment_method
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.payment_method = 'Credit' OR i.payment_method = 'credit'
    ORDER BY i.invoice_date DESC, i.id DESC
    `,
  );
}

export async function closeCredit(invoiceId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `
    UPDATE invoices
    SET payment_method = 'Credit (Paid)'
    WHERE id = ?
    `,
    [invoiceId],
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
      created_at,
      is_redone,
      redone_at,
      tax_type
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
      i.product_id,
      i.product_name,
      i.quantity,
      i.unit_price,
      i.cost_price,
      i.tax_rate,
      i.tax_amount,
      i.discount_amount,
      i.line_total,
      i.is_bulk,
      i.bulk_multiplier,
      p.sku as sku,
      p.hsn_sac as hsn_sac
    FROM invoice_items i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE i.invoice_id = ?
    ORDER BY i.id ASC
    `,
    [id],
  );

  return {
    invoice: invoices[0],
    items,
  };
}

export async function updateInvoice(
  invoiceId: number,
  invoiceData: CreateInvoiceData,
): Promise<void> {
  const db = await getDatabase();

  if (invoiceData.items.length === 0) {
    throw new Error("Invoice must contain at least one item.");
  }

  const productIds = new Set<number>();
  for (const item of invoiceData.items) {
    if (item.quantity <= 0)
      throw new Error(`Invalid quantity for: ${item.product_name}`);
    if (item.unit_price < 0)
      throw new Error(`Invalid price for: ${item.product_name}`);
    if (productIds.has(item.product_id))
      throw new Error(`Duplicate product in invoice: ${item.product_name}`);
    productIds.add(item.product_id);
  }

  // 1. Get current original items
  const { items: originalItems } = await getInvoiceById(invoiceId);

  // Check stock limits accounting for what was already reserved in this bill
  for (const item of invoiceData.items) {
    const stockResult = await db.select<{ stock_quantity: number }[]>(
      `SELECT stock_quantity FROM products WHERE id = ? AND is_active = 1`,
      [item.product_id],
    );
    if (!stockResult.length)
      throw new Error(`Product not found: ${item.product_name}`);

    // Adjust existing stock by adding back the quantity that is currently in this bill for this item
    const originalItem = originalItems.find(
      (oi) => oi.product_id === item.product_id,
    );
    const existingReserved = originalItem
      ? originalItem.quantity * (originalItem.bulk_multiplier || 1)
      : 0;
    const stockToDeduct = item.quantity * (item.bulk_multiplier || 1);

    const availableStock = stockResult[0].stock_quantity + existingReserved;
    if (availableStock < stockToDeduct) {
      throw new Error(`Insufficient stock for: ${item.product_name}`);
    }
  }

  try {
    // 2. Revert stock for original items
    for (const oi of originalItems) {
      const stockToRevert = oi.quantity * (oi.bulk_multiplier || 1);
      await db.execute(
        `UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [stockToRevert, oi.product_id],
      );
    }

    // 3. Delete old items
    await db.execute(`DELETE FROM invoice_items WHERE invoice_id = ?`, [
      invoiceId,
    ]);

    // 4. Update the invoice record
    await db.execute(
      `
      UPDATE invoices
      SET
        customer_id = ?,
        subtotal = ?,
        tax_amount = ?,
        discount_amount = ?,
        grand_total = ?,
        payment_method = ?,
        notes = ?,
        tax_type = ?,
        is_redone = 1,
        redone_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        invoiceData.customer_id ?? null,
        invoiceData.subtotal,
        invoiceData.tax_amount,
        invoiceData.discount_amount,
        invoiceData.grand_total,
        invoiceData.payment_method,
        invoiceData.notes ?? null,
        invoiceData.tax_type,
        invoiceId,
      ],
    );

    // 5. Insert new items and deduct stock
    for (const item of invoiceData.items) {
      const productRows = await db.select<{ average_cost: number }[]>(
        `SELECT average_cost FROM products WHERE id = ? AND is_active = 1`,
        [item.product_id],
      );
      if (!productRows.length)
        throw new Error(`Product not found: ${item.product_name}`);
      const costPrice = Number(productRows[0].average_cost ?? 0);

      await db.execute(
        `
        INSERT INTO invoice_items (
          invoice_id, product_id, product_name, quantity, unit_price, cost_price,
          tax_rate, tax_amount, discount_amount, line_total, is_bulk, bulk_multiplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          invoiceId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          costPrice,
          item.tax_rate,
          item.tax_amount,
          item.discount_amount,
          item.line_total,
          item.is_bulk ?? 0,
          item.bulk_multiplier ?? 1,
        ],
      );

      const stockToDeduct = item.quantity * (item.bulk_multiplier || 1);
      const stockUpdate = await db.execute(
        `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1 AND stock_quantity >= ?`,
        [stockToDeduct, item.product_id, stockToDeduct],
      );

      if (stockUpdate.rowsAffected !== 1) {
        throw new Error(`Stock could not be updated for: ${item.product_name}`);
      }
    }
  } catch (error) {
    throw error;
  }
}

export async function deleteInvoice(invoiceId: number): Promise<void> {
  const db = await getDatabase();
  const { items } = await getInvoiceById(invoiceId);

  try {
    // 1. Revert stock for all items
    for (const item of items) {
      const stockToRevert = item.quantity * (item.bulk_multiplier || 1);
      await db.execute(
        `UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [stockToRevert, item.product_id],
      );
    }

    // 2. Delete invoice items
    await db.execute(`DELETE FROM invoice_items WHERE invoice_id = ?`, [
      invoiceId,
    ]);

    // 3. Delete invoice
    await db.execute(`DELETE FROM invoices WHERE id = ?`, [invoiceId]);
  } catch (error) {
    throw error;
  }
}
