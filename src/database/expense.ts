import { getDatabase } from "./db";

export type Expense = {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  payment_method: string;
  recipient: string | null;
  notes: string | null;
  created_at: string;
};

export type CreateExpenseData = {
  expense_date?: string;
  category: string;
  amount: number;
  payment_method: string;
  recipient?: string | null;
  notes?: string | null;
};

export type ExpenseSummary = {
  todayTotal: number;
  thisMonthTotal: number;
  allTimeTotal: number;
  totalCount: number;
  byCategory: { category: string; total: number }[];
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Shop Rent",
  "Electricity & Utilities",
  "Staff Salary / Advance",
  "Freight & Transport",
  "Tea & Refreshments",
  "Maintenance & Repairs",
  "Stationery & Office",
  "Packaging Material",
  "Tax / Professional Fees",
  "Miscellaneous",
];

export async function getExpenses(filter?: {
  startDate?: string;
  endDate?: string;
  category?: string;
}): Promise<Expense[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter?.startDate) {
    conditions.push("date(expense_date) >= date(?)");
    params.push(filter.startDate);
  }
  if (filter?.endDate) {
    conditions.push("date(expense_date) <= date(?)");
    params.push(filter.endDate);
  }
  if (filter?.category && filter.category !== "ALL") {
    conditions.push("category = ?");
    params.push(filter.category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return await db.select<Expense[]>(
    `
    SELECT
      id,
      expense_date,
      category,
      amount,
      payment_method,
      recipient,
      notes,
      created_at
    FROM expenses
    ${whereClause}
    ORDER BY expense_date DESC, id DESC
    `,
    params,
  );
}

export async function createExpense(data: CreateExpenseData): Promise<number> {
  const db = await getDatabase();

  if (!data.category || data.category.trim() === "") {
    throw new Error("Category is required.");
  }
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const expenseDate = data.expense_date && data.expense_date.trim() !== ""
    ? data.expense_date
    : new Date().toISOString().replace("T", " ").substring(0, 19);

  const result = await db.execute(
    `
    INSERT INTO expenses (
      expense_date,
      category,
      amount,
      payment_method,
      recipient,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      expenseDate,
      data.category.trim(),
      data.amount,
      data.payment_method || "Cash",
      data.recipient?.trim() || null,
      data.notes?.trim() || null,
    ],
  );

  return result.lastInsertId as number;
}

export async function updateExpense(
  id: number,
  data: CreateExpenseData,
): Promise<void> {
  const db = await getDatabase();

  if (!data.category || data.category.trim() === "") {
    throw new Error("Category is required.");
  }
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const expenseDate = data.expense_date && data.expense_date.trim() !== ""
    ? data.expense_date
    : new Date().toISOString().replace("T", " ").substring(0, 19);

  await db.execute(
    `
    UPDATE expenses
    SET
      expense_date = ?,
      category = ?,
      amount = ?,
      payment_method = ?,
      recipient = ?,
      notes = ?
    WHERE id = ?
    `,
    [
      expenseDate,
      data.category.trim(),
      data.amount,
      data.payment_method || "Cash",
      data.recipient?.trim() || null,
      data.notes?.trim() || null,
      id,
    ],
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM expenses WHERE id = ?", [id]);
}

export async function getExpenseSummary(): Promise<ExpenseSummary> {
  const db = await getDatabase();

  const todayRows = await db.select<{ total: number | null }[]>(
    `SELECT SUM(amount) as total FROM expenses WHERE date(expense_date) = date('now', 'localtime')`,
  );
  const thisMonthRows = await db.select<{ total: number | null }[]>(
    `SELECT SUM(amount) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now', 'localtime')`,
  );
  const allTimeRows = await db.select<{ total: number | null; count: number }[]>(
    `SELECT SUM(amount) as total, COUNT(*) as count FROM expenses`,
  );

  const byCatRows = await db.select<{ category: string; total: number }[]>(
    `SELECT category, SUM(amount) as total FROM expenses GROUP BY category ORDER BY total DESC`,
  );

  return {
    todayTotal: todayRows[0]?.total || 0,
    thisMonthTotal: thisMonthRows[0]?.total || 0,
    allTimeTotal: allTimeRows[0]?.total || 0,
    totalCount: allTimeRows[0]?.count || 0,
    byCategory: byCatRows || [],
  };
}
