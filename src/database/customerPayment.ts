import { getDatabase } from "./db";
import type { Customer } from "./customer";

export type CustomerPayment = {
  id: number;
  customer_id: number;
  invoice_id: number | null;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  invoice_number?: string | null;
};

export type CreateCustomerPaymentData = {
  customer_id: number;
  invoice_id?: number | null;
  payment_date?: string;
  amount: number;
  payment_method?: string;
  notes?: string | null;
};

export type LedgerEntryType = "INVOICE" | "PAYMENT";

export type CustomerLedgerEntry = {
  id: string; // unique key, e.g. "inv-10" or "pay-25"
  date: string;
  type: LedgerEntryType;
  reference: string; // e.g. "INV-4392" or "Receipt #25 (UPI)"
  description: string;
  invoice_id?: number | null;
  payment_id?: number | null;
  items_summary?: string;
  billed_amount: number; // Debit: increases due
  paid_amount: number;   // Credit: decreases due
  running_balance: number;
  payment_method?: string;
  notes?: string | null;
};

export type CustomerLedgerSummary = {
  customer: Customer;
  total_invoices_count: number;
  total_billed: number;
  total_paid: number;
  current_balance_due: number;
  opening_balance: number;
  closing_balance: number;
  period_billed: number;
  period_paid: number;
};

export type CustomerLedgerResult = {
  summary: CustomerLedgerSummary;
  entries: CustomerLedgerEntry[];
};

/**
 * Record a customer payment.
 * If invoice_id is provided, applies directly to that invoice.
 * If invoice_id is null/undefined, automatically allocates payment across open credit invoices in FIFO order.
 */
export async function recordCustomerPayment(
  data: CreateCustomerPaymentData,
): Promise<number> {
  const db = await getDatabase();
  const paymentDate = data.payment_date || new Date().toISOString();
  const method = data.payment_method || "Cash";
  const notes = data.notes?.trim() || null;
  const amount = Number(data.amount);

  if (isNaN(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  // 1. Insert into customer_payments
  const insertResult = await db.execute(
    `
    INSERT INTO customer_payments (customer_id, invoice_id, payment_date, amount, payment_method, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [data.customer_id, data.invoice_id || null, paymentDate, amount, method, notes],
  );

  const paymentId = insertResult.lastInsertId as number;

  // 2. Adjust invoice balances
  if (data.invoice_id) {
    // Specific invoice settlement
    const invRows = await db.select<
      { grand_total: number; paid_amount: number | null; balance_amount: number | null }[]
    >(
      `SELECT grand_total, paid_amount, balance_amount FROM invoices WHERE id = ?`,
      [data.invoice_id],
    );

    if (invRows.length > 0) {
      const inv = invRows[0];
      const curPaid = Number(inv.paid_amount ?? 0);
      const curBal =
        inv.balance_amount !== null && inv.balance_amount !== undefined
          ? Number(inv.balance_amount)
          : Number(inv.grand_total);

      const newPaid = curPaid + amount;
      const newBal = Math.max(0, curBal - amount);

      await db.execute(
        `
        UPDATE invoices
        SET
          paid_amount = ?,
          balance_amount = ?,
          payment_method = ?
        WHERE id = ?
        `,
        [newPaid, newBal, newBal <= 0 ? "Credit (Paid)" : "Partial", data.invoice_id],
      );
    }
  } else {
    // General customer deposit: allocate across open credit bills in FIFO order
    let remainingToAllocate = amount;

    const openInvoices = await db.select<
      { id: number; grand_total: number; paid_amount: number | null; balance_amount: number | null }[]
    >(
      `
      SELECT id, grand_total, paid_amount, balance_amount
      FROM invoices
      WHERE customer_id = ?
        AND payment_method != 'Credit (Paid)'
        AND (
          (balance_amount IS NOT NULL AND balance_amount > 0.001)
          OR (balance_amount IS NULL AND payment_method IN ('Credit', 'credit'))
        )
      ORDER BY invoice_date ASC, id ASC
      `,
      [data.customer_id],
    );

    for (const inv of openInvoices) {
      if (remainingToAllocate <= 0) break;

      const curPaid = Number(inv.paid_amount ?? 0);
      const curBal =
        inv.balance_amount !== null && inv.balance_amount !== undefined
          ? Number(inv.balance_amount)
          : Number(inv.grand_total);

      if (curBal <= 0) continue;

      const allocation = Math.min(curBal, remainingToAllocate);
      const newPaid = curPaid + allocation;
      const newBal = Math.max(0, curBal - allocation);

      await db.execute(
        `
        UPDATE invoices
        SET
          paid_amount = ?,
          balance_amount = ?,
          payment_method = ?
        WHERE id = ?
        `,
        [newPaid, newBal, newBal <= 0 ? "Credit (Paid)" : "Partial", inv.id],
      );

      remainingToAllocate -= allocation;
    }
  }

  return paymentId;
}

/**
 * Fetch all payments recorded for a customer.
 */
export async function getCustomerPayments(
  customerId: number,
): Promise<CustomerPayment[]> {
  const db = await getDatabase();

  return await db.select<CustomerPayment[]>(
    `
    SELECT
      p.id,
      p.customer_id,
      p.invoice_id,
      p.payment_date,
      p.amount,
      p.payment_method,
      p.notes,
      p.created_at,
      i.invoice_number
    FROM customer_payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE p.customer_id = ?
    ORDER BY p.payment_date DESC, p.id DESC
    `,
    [customerId],
  );
}

/**
 * Fetch complete chronological customer ledger (Khata account statement).
 * Computes running balance, summary totals, and item details.
 */
export async function getCustomerLedger(
  customerId: number,
  options?: { startDate?: string; endDate?: string },
): Promise<CustomerLedgerResult> {
  const db = await getDatabase();

  // 1. Fetch customer details
  const customerRows = await db.select<Customer[]>(
    `
    SELECT id, name, phone, address, gstin, state_name, state_code, created_at, updated_at
    FROM customers
    WHERE id = ?
    `,
    [customerId],
  );

  if (!customerRows.length) {
    throw new Error("Customer not found.");
  }
  const customer = customerRows[0];

  // 2. Fetch all invoices for this customer
  const invoices = await db.select<
    {
      id: number;
      invoice_number: string;
      invoice_date: string;
      grand_total: number;
      paid_amount: number | null;
      balance_amount: number | null;
      payment_method: string;
      notes: string | null;
    }[]
  >(
    `
    SELECT id, invoice_number, invoice_date, grand_total, paid_amount, balance_amount, payment_method, notes
    FROM invoices
    WHERE customer_id = ?
    ORDER BY invoice_date ASC, id ASC
    `,
    [customerId],
  );

  // 3. Fetch item summaries for all invoices of this customer
  const invoiceIds = invoices.map((inv) => inv.id);
  const itemsSummaryMap = new Map<number, string>();

  if (invoiceIds.length > 0) {
    // Chunk queries if there are very many invoices
    const chunkSize = 200;
    for (let i = 0; i < invoiceIds.length; i += chunkSize) {
      const chunk = invoiceIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const itemRows = await db.select<
        { invoice_id: number; product_name: string; quantity: number }[]
      >(
        `
        SELECT invoice_id, product_name, quantity
        FROM invoice_items
        WHERE invoice_id IN (${placeholders})
        ORDER BY id ASC
        `,
        chunk,
      );

      for (const row of itemRows) {
        const existing = itemsSummaryMap.get(row.invoice_id);
        const itemText = `${row.product_name} (${row.quantity})`;
        if (!existing) {
          itemsSummaryMap.set(row.invoice_id, itemText);
        } else {
          // Keep up to 3 items in summary to avoid overly huge table cell
          const parts = existing.split(", ");
          if (parts.length < 3) {
            itemsSummaryMap.set(row.invoice_id, `${existing}, ${itemText}`);
          } else if (parts.length === 3) {
            itemsSummaryMap.set(row.invoice_id, `${existing}, ...`);
          }
        }
      }
    }
  }

  // 4. Fetch all payments for this customer
  const payments = await db.select<
    {
      id: number;
      invoice_id: number | null;
      payment_date: string;
      amount: number;
      payment_method: string;
      notes: string | null;
      invoice_number: string | null;
    }[]
  >(
    `
    SELECT
      p.id,
      p.invoice_id,
      p.payment_date,
      p.amount,
      p.payment_method,
      p.notes,
      i.invoice_number
    FROM customer_payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE p.customer_id = ?
    ORDER BY p.payment_date ASC, p.id ASC
    `,
    [customerId],
  );

  // 5. Build raw chronological event list
  type RawEvent = {
    date: string;
    sortKey: string;
    type: LedgerEntryType;
    invoice?: (typeof invoices)[0];
    payment?: (typeof payments)[0];
  };

  const rawEvents: RawEvent[] = [];

  for (const inv of invoices) {
    rawEvents.push({
      date: inv.invoice_date,
      // Priority 1 for invoice so invoice precedes payment on same timestamp
      sortKey: `${inv.invoice_date}_0_${inv.id}`,
      type: "INVOICE",
      invoice: inv,
    });
  }

  for (const pay of payments) {
    rawEvents.push({
      date: pay.payment_date,
      // Priority 2 for payment
      sortKey: `${pay.payment_date}_1_${pay.id}`,
      type: "PAYMENT",
      payment: pay,
    });
  }

  rawEvents.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // 6. Compute running balances and overall account summary
  let currentRunningBalance = 0;
  let totalBilledAllTime = 0;
  let totalPaidAllTime = 0;

  const allProcessedEntries: CustomerLedgerEntry[] = [];

  for (const evt of rawEvents) {
    if (evt.type === "INVOICE" && evt.invoice) {
      const billed = Number(evt.invoice.grand_total);
      totalBilledAllTime += billed;
      currentRunningBalance += billed;

      allProcessedEntries.push({
        id: `inv-${evt.invoice.id}`,
        date: evt.invoice.invoice_date,
        type: "INVOICE",
        reference: evt.invoice.invoice_number,
        description: `Tax Invoice ${evt.invoice.invoice_number}`,
        invoice_id: evt.invoice.id,
        items_summary: itemsSummaryMap.get(evt.invoice.id) || "",
        billed_amount: billed,
        paid_amount: 0,
        running_balance: currentRunningBalance,
        payment_method: evt.invoice.payment_method,
        notes: evt.invoice.notes,
      });
    } else if (evt.type === "PAYMENT" && evt.payment) {
      const paid = Number(evt.payment.amount);
      totalPaidAllTime += paid;
      currentRunningBalance -= paid;

      const refText = evt.payment.invoice_number
        ? `Payment (${evt.payment.payment_method}) - Bill ${evt.payment.invoice_number}`
        : `Payment Received (${evt.payment.payment_method})`;

      allProcessedEntries.push({
        id: `pay-${evt.payment.id}`,
        date: evt.payment.payment_date,
        type: "PAYMENT",
        reference: `REC-${evt.payment.id}`,
        description: refText,
        invoice_id: evt.payment.invoice_id,
        payment_id: evt.payment.id,
        billed_amount: 0,
        paid_amount: paid,
        running_balance: currentRunningBalance,
        payment_method: evt.payment.payment_method,
        notes: evt.payment.notes,
      });
    }
  }

  // 7. Apply Date Range Filtering if specified
  const startDateStr = options?.startDate ? options.startDate.split("T")[0] : null;
  const endDateStr = options?.endDate ? options.endDate.split("T")[0] : null;

  let openingBalance = 0;
  let periodBilled = 0;
  let periodPaid = 0;
  const filteredEntries: CustomerLedgerEntry[] = [];

  for (const entry of allProcessedEntries) {
    const entryDateStr = entry.date.split("T")[0];

    if (startDateStr && entryDateStr < startDateStr) {
      openingBalance += entry.billed_amount - entry.paid_amount;
      continue;
    }

    if (endDateStr && entryDateStr > endDateStr) {
      continue;
    }

    periodBilled += entry.billed_amount;
    periodPaid += entry.paid_amount;
    filteredEntries.push(entry);
  }

  const closingBalance = openingBalance + periodBilled - periodPaid;
  const netDue = Math.max(0, currentRunningBalance);

  return {
    summary: {
      customer,
      total_invoices_count: invoices.length,
      total_billed: totalBilledAllTime,
      total_paid: totalPaidAllTime,
      current_balance_due: netDue,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      period_billed: periodBilled,
      period_paid: periodPaid,
    },
    entries: filteredEntries,
  };
}

/**
 * Fetch total outstanding credit balances mapped by customer_id.
 */
export async function getAllCustomerCreditBalances(): Promise<Map<number, number>> {
  const db = await getDatabase();

  const rows = await db.select<{ customer_id: number; pending_due: number }[]>(
    `
    SELECT
      customer_id,
      SUM(
        COALESCE(
          balance_amount,
          CASE WHEN payment_method IN ('Credit', 'credit') THEN grand_total ELSE 0 END
        )
      ) AS pending_due
    FROM invoices
    WHERE customer_id IS NOT NULL
      AND payment_method != 'Credit (Paid)'
      AND (
        (balance_amount IS NOT NULL AND balance_amount > 0.001)
        OR (balance_amount IS NULL AND payment_method IN ('Credit', 'credit'))
      )
    GROUP BY customer_id
    `,
  );

  const balanceMap = new Map<number, number>();
  for (const row of rows) {
    if (row.pending_due > 0.001) {
      balanceMap.set(row.customer_id, Number(row.pending_due));
    }
  }

  return balanceMap;
}
