import { getDatabase } from "./db";
import { formatLocalDateToDbUtc } from "./dateUtils";

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
  brand?: string | null;
  unit_symbol?: string | null;
  bulk_unit?: string | null;
  current_purchase_price?: number | null;
  current_average_cost?: number | null;
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
  paid_amount?: number | null;
  balance_amount?: number | null;
  notes: string | null;
  created_at: string;
  is_redone: number;
  redone_at: string | null;
  tax_type: "CGST_SGST" | "IGST";
  vehicle_number?: string | null;
  driver_details?: string | null;
};

export type CreateInvoiceData = {
  invoice_date?: string | null;
  customer_id?: number | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  payment_method: string;
  paid_amount?: number | null;
  balance_amount?: number | null;
  notes?: string | null;
  items: InvoiceItem[];
  tax_type: "CGST_SGST" | "IGST";
  vehicle_number?: string | null;
  driver_details?: string | null;
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
  const nextNumber = Math.max(maxNumber + 1, 4392);

  return `INV-${nextNumber}`;
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
    const effectivePaid =
      invoice.paid_amount !== undefined && invoice.paid_amount !== null
        ? invoice.paid_amount
        : invoice.payment_method === "Credit" || invoice.payment_method === "credit"
          ? 0
          : invoice.grand_total;

    const effectiveBalance =
      invoice.balance_amount !== undefined && invoice.balance_amount !== null
        ? invoice.balance_amount
        : Math.max(0, invoice.grand_total - effectivePaid);

    const effectiveInvoiceDate = formatLocalDateToDbUtc(invoice.invoice_date);

    const invoiceResult = await db.execute(
      `
      INSERT INTO invoices (
        invoice_number,
        customer_id,
        invoice_date,
        subtotal,
        tax_amount,
        discount_amount,
        grand_total,
        payment_method,
        paid_amount,
        balance_amount,
        notes,
        tax_type,
        vehicle_number,
        driver_details
      )
      VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        invoiceNumber,
        invoice.customer_id ?? null,
        effectiveInvoiceDate,
        invoice.subtotal,
        invoice.tax_amount,
        invoice.discount_amount,
        invoice.grand_total,
        invoice.payment_method,
        effectivePaid,
        effectiveBalance,
        invoice.notes ?? null,
        invoice.tax_type,
        invoice.vehicle_number ?? null,
        invoice.driver_details ?? null,
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
          purchase_price: number;
        }[]
      >(
        `
        SELECT average_cost, purchase_price
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

      const costPrice =
        Number(product.average_cost) > 0
          ? Number(product.average_cost)
          : Number(product.purchase_price ?? 0);

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
      paid_amount,
      balance_amount,
      notes,
      created_at,
      is_redone,
      redone_at,
      tax_type,
      vehicle_number,
      driver_details
    FROM invoices
    ORDER BY id DESC
    `,
  );
}

export type CreditInvoice = {
  id: number;
  invoice_number: string;
  customer_id?: number | null;
  customer_name: string | null;
  customer_phone?: string | null;
  grand_total: number;
  paid_amount?: number | null;
  balance_amount?: number | null;
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
      i.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      i.grand_total,
      COALESCE(i.paid_amount, 0) AS paid_amount,
      COALESCE(i.balance_amount, i.grand_total) AS balance_amount,
      i.invoice_date,
      i.payment_method
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.payment_method != 'Credit (Paid)'
      AND (
        (i.balance_amount IS NOT NULL AND i.balance_amount > 0.001)
        OR (i.balance_amount IS NULL AND (i.payment_method = 'Credit' OR i.payment_method = 'credit'))
      )
    ORDER BY i.invoice_date DESC, i.id DESC
    `,
  );
}

export async function closeCredit(
  invoiceId: number,
  settleAmount?: number,
  paymentMethod: string = "Cash",
  notes?: string | null,
): Promise<{ remainingBalance: number }> {
  const db = await getDatabase();
  const invoices = await db.select<
    {
      customer_id: number | null;
      invoice_number: string;
      grand_total: number;
      paid_amount: number | null;
      balance_amount: number | null;
    }[]
  >(
    `SELECT customer_id, invoice_number, grand_total, paid_amount, balance_amount FROM invoices WHERE id = ?`,
    [invoiceId],
  );
  if (!invoices.length) throw new Error("Invoice not found.");
  const inv = invoices[0];
  const currentBalance =
    inv.balance_amount !== null && inv.balance_amount !== undefined
      ? Number(inv.balance_amount)
      : Number(inv.grand_total);
  const currentPaid =
    inv.paid_amount !== null && inv.paid_amount !== undefined
      ? Number(inv.paid_amount)
      : 0;

  const actualPaymentAmount =
    settleAmount === undefined || settleAmount >= currentBalance
      ? currentBalance
      : settleAmount;

  if (settleAmount === undefined || settleAmount >= currentBalance) {
    // Settle in full
    await db.execute(
      `
      UPDATE invoices
      SET
        payment_method = 'Credit (Paid)',
        paid_amount = grand_total,
        balance_amount = 0
      WHERE id = ?
      `,
      [invoiceId],
    );
  } else {
    // Partial payment toward credit balance
    const newPaid = currentPaid + settleAmount;
    const newBalance = Math.max(0, currentBalance - settleAmount);
    await db.execute(
      `
      UPDATE invoices
      SET
        paid_amount = ?,
        balance_amount = ?,
        payment_method = ?
      WHERE id = ?
      `,
      [
        newPaid,
        newBalance,
        newBalance <= 0 ? "Credit (Paid)" : "Partial",
        invoiceId,
      ],
    );
  }

  // Record customer payment entry if customer is linked
  if (inv.customer_id && actualPaymentAmount > 0) {
    try {
      await db.execute(
        `
        INSERT INTO customer_payments (customer_id, invoice_id, payment_date, amount, payment_method, notes)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
        `,
        [
          inv.customer_id,
          invoiceId,
          actualPaymentAmount,
          paymentMethod,
          notes?.trim() || `Credit settlement for Bill ${inv.invoice_number}`,
        ],
      );
    } catch (e) {
      console.warn("Could not record customer payment:", e);
    }
  }

  const finalBalance = Math.max(0, currentBalance - actualPaymentAmount);
  return { remainingBalance: finalBalance };
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
      paid_amount,
      balance_amount,
      notes,
      created_at,
      is_redone,
      redone_at,
      tax_type,
      vehicle_number,
      driver_details
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
      p.hsn_sac as hsn_sac,
      p.brand as brand,
      COALESCE(u.symbol, u.name, p.uom) as unit_symbol,
      p.bulk_unit as bulk_unit,
      p.purchase_price as current_purchase_price,
      p.average_cost as current_average_cost
    FROM invoice_items i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN units u ON p.unit_id = u.id
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
    const effectivePaid =
      invoiceData.paid_amount !== undefined && invoiceData.paid_amount !== null
        ? invoiceData.paid_amount
        : invoiceData.payment_method === "Credit" || invoiceData.payment_method === "credit"
          ? 0
          : invoiceData.grand_total;

    const effectiveBalance =
      invoiceData.balance_amount !== undefined && invoiceData.balance_amount !== null
        ? invoiceData.balance_amount
        : Math.max(0, invoiceData.grand_total - effectivePaid);

    const effectiveInvoiceDate = formatLocalDateToDbUtc(invoiceData.invoice_date);

    await db.execute(
      `
      UPDATE invoices
      SET
        customer_id = ?,
        invoice_date = COALESCE(?, invoice_date),
        subtotal = ?,
        tax_amount = ?,
        discount_amount = ?,
        grand_total = ?,
        payment_method = ?,
        paid_amount = ?,
        balance_amount = ?,
        notes = ?,
        tax_type = ?,
        vehicle_number = ?,
        driver_details = ?,
        is_redone = 1,
        redone_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        invoiceData.customer_id ?? null,
        effectiveInvoiceDate,
        invoiceData.subtotal,
        invoiceData.tax_amount,
        invoiceData.discount_amount,
        invoiceData.grand_total,
        invoiceData.payment_method,
        effectivePaid,
        effectiveBalance,
        invoiceData.notes ?? null,
        invoiceData.tax_type,
        invoiceData.vehicle_number ?? null,
        invoiceData.driver_details ?? null,
        invoiceId,
      ],
    );

    // 5. Insert new items and deduct stock
    for (const item of invoiceData.items) {
      const productRows = await db.select<
        { average_cost: number; purchase_price: number }[]
      >(
        `SELECT average_cost, purchase_price FROM products WHERE id = ? AND is_active = 1`,
        [item.product_id],
      );
      if (!productRows.length)
        throw new Error(`Product not found: ${item.product_name}`);
      const costPrice =
        Number(productRows[0].average_cost) > 0
          ? Number(productRows[0].average_cost)
          : Number(productRows[0].purchase_price ?? 0);

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

export type AuditorReportItem = {
  invoice_date: string;
  invoice_number: string;
  customer_name: string | null;
  customer_gstin: string | null;
  product_name: string;
  hsn_sac: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
};

export async function getAuditorReportItems(
  startDate: string,
  endDate: string,
): Promise<AuditorReportItem[]> {
  const db = await getDatabase();

  return await db.select<AuditorReportItem[]>(
    `
    SELECT
      i.invoice_date,
      i.invoice_number,
      c.name as customer_name,
      c.gstin as customer_gstin,
      ii.product_name,
      p.hsn_sac,
      ii.quantity,
      ii.unit_price,
      ii.tax_rate,
      ii.line_total as taxable_value,
      CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END as cgst_amount,
      CASE WHEN i.tax_type = 'CGST_SGST' THEN ii.tax_amount / 2 ELSE 0 END as sgst_amount,
      CASE WHEN i.tax_type = 'IGST' THEN ii.tax_amount ELSE 0 END as igst_amount,
      (ii.line_total + ii.tax_amount) as total_amount
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    LEFT JOIN products p ON ii.product_id = p.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE date(i.invoice_date, 'localtime') BETWEEN date(?) AND date(?)
      AND ii.tax_rate > 0
    ORDER BY i.invoice_date ASC, i.id ASC
    `,
    [startDate, endDate],
  );
}
