import { getDatabase } from "./db";

export type QuotationItem = {
  id?: number;
  quotation_id?: number;
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
};

export type Quotation = {
  id: number;
  quotation_number: string;
  customer_id: number | null;
  quotation_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  status: "PENDING" | "CONVERTED" | "EXPIRED" | "CANCELLED";
  notes: string | null;
  tax_type: "CGST_SGST" | "IGST";
  created_at: string;
  converted_invoice_id: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_gstin?: string | null;
};

export type CreateQuotationData = {
  customer_id?: number | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  notes?: string | null;
  items: QuotationItem[];
  tax_type: "CGST_SGST" | "IGST";
};

export async function getNextQuotationNumber(): Promise<string> {
  const db = await getDatabase();

  const result = await db.select<{ max_number: number | null }[]>(
    `
    SELECT MAX(
      CAST(
        SUBSTR(quotation_number, INSTR(quotation_number, '-') + 1) AS INTEGER
      )
    ) as max_number
    FROM quotations
    WHERE quotation_number LIKE 'EST-%'
    `,
  );

  const maxNumber = result[0]?.max_number ?? 0;
  const nextNumber = maxNumber + 1;
  return `EST-${String(nextNumber).padStart(4, "0")}`;
}

export async function createQuotation(data: CreateQuotationData): Promise<number> {
  const db = await getDatabase();
  const quotationNumber = await getNextQuotationNumber();

  const result = await db.execute(
    `
    INSERT INTO quotations (
      quotation_number,
      customer_id,
      quotation_date,
      subtotal,
      tax_amount,
      discount_amount,
      grand_total,
      status,
      notes,
      tax_type
    ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'PENDING', ?, ?)
    `,
    [
      quotationNumber,
      data.customer_id ?? null,
      data.subtotal,
      data.tax_amount,
      data.discount_amount,
      data.grand_total,
      data.notes ?? null,
      data.tax_type,
    ],
  );

  const quotationId = result.lastInsertId ?? 0;

  for (const item of data.items) {
    await db.execute(
      `
      INSERT INTO quotation_items (
        quotation_id,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        quotationId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.cost_price || 0,
        item.tax_rate,
        item.tax_amount,
        item.discount_amount,
        item.line_total,
        item.is_bulk ? 1 : 0,
        item.bulk_multiplier ?? 1,
      ],
    );
  }

  return quotationId;
}

export async function getQuotations(
  fromDate?: string,
  toDate?: string,
): Promise<Quotation[]> {
  const db = await getDatabase();

  let query = `
    SELECT
      q.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      c.gstin AS customer_gstin
    FROM quotations q
    LEFT JOIN customers c ON q.customer_id = c.id
  `;

  const params: any[] = [];
  if (fromDate && toDate) {
    query += ` WHERE date(q.quotation_date, 'localtime') BETWEEN date(?) AND date(?)`;
    params.push(fromDate, toDate);
  }

  query += ` ORDER BY q.id DESC`;

  return await db.select<Quotation[]>(query, params);
}

export async function getQuotationById(id: number): Promise<{
  quotation: Quotation;
  items: QuotationItem[];
}> {
  const db = await getDatabase();

  const quotations = await db.select<Quotation[]>(
    `
    SELECT
      q.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      c.gstin AS customer_gstin
    FROM quotations q
    LEFT JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
    `,
    [id],
  );

  if (quotations.length === 0) {
    throw new Error(`Quotation with id ${id} not found.`);
  }

  const items = await db.select<QuotationItem[]>(
    `
    SELECT
      qi.*,
      p.sku,
      p.hsn_sac,
      p.brand,
      p.bulk_unit,
      u.symbol AS unit_symbol
    FROM quotation_items qi
    LEFT JOIN products p ON qi.product_id = p.id
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE qi.quotation_id = ?
    `,
    [id],
  );

  return {
    quotation: quotations[0],
    items,
  };
}

export async function updateQuotationStatus(
  id: number,
  status: "PENDING" | "CONVERTED" | "EXPIRED" | "CANCELLED",
  convertedInvoiceId?: number | null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `
    UPDATE quotations
    SET status = ?, converted_invoice_id = COALESCE(?, converted_invoice_id)
    WHERE id = ?
    `,
    [status, convertedInvoiceId ?? null, id],
  );
}

export async function deleteQuotation(id: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM quotation_items WHERE quotation_id = ?`, [id]);
  await db.execute(`DELETE FROM quotations WHERE id = ?`, [id]);
}
