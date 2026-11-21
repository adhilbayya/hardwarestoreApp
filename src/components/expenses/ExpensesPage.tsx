import { useEffect, useState, useMemo } from "react";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  DEFAULT_EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseSummary,
} from "../../database/expense";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  try {
    const clean = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
    const d = new Date(clean.endsWith("Z") ? clean : clean + "Z");
    if (isNaN(d.getTime())) {
      const fallback = new Date(dateStr);
      if (isNaN(fallback.getTime())) return dateStr;
      return fallback.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"] as const;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "THIS_MONTH" | "CUSTOM">("ALL");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Delete Confirmation Modal State
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [categoryFilter, dateFilter, customStartDate, customEndDate]);

  async function loadData() {
    try {
      setLoading(true);
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      const today = new Date();
      if (dateFilter === "TODAY") {
        startDate = today.toISOString().split("T")[0];
        endDate = startDate;
      } else if (dateFilter === "THIS_MONTH") {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        startDate = `${y}-${m}-01`;
        endDate = today.toISOString().split("T")[0];
      } else if (dateFilter === "CUSTOM") {
        startDate = customStartDate || undefined;
        endDate = customEndDate || undefined;
      }

      const [list, sum] = await Promise.all([
        getExpenses({
          startDate,
          endDate,
          category: categoryFilter,
        }),
        getExpenseSummary(),
      ]);

      setExpenses(list);
      setSummary(sum);
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAdd() {
    setEditingExpense(null);
    setCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
    setCustomCategory("");
    setAmount("");
    setPaymentMethod("Cash");
    setRecipient("");
    setNotes("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setError("");
    setShowModal(true);
  }

  function handleOpenEdit(exp: Expense) {
    setEditingExpense(exp);
    if (DEFAULT_EXPENSE_CATEGORIES.includes(exp.category)) {
      setCategory(exp.category);
      setCustomCategory("");
    } else {
      setCategory("OTHER");
      setCustomCategory(exp.category);
    }
    setAmount(exp.amount);
    setPaymentMethod(exp.payment_method || "Cash");
    setRecipient(exp.recipient || "");
    setNotes(exp.notes || "");
    const dStr = exp.expense_date.split(" ")[0] || exp.expense_date.split("T")[0];
    setExpenseDate(dStr);
    setError("");
    setShowModal(true);
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    const finalCategory = category === "OTHER" ? customCategory.trim() : category;

    if (!finalCategory) {
      setError("Please select or enter an expense category.");
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid expense amount greater than 0.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          category: finalCategory,
          amount: numAmount,
          payment_method: paymentMethod,
          recipient: recipient.trim() || null,
          notes: notes.trim() || null,
          expense_date: expenseDate,
        });
      } else {
        await createExpense({
          category: finalCategory,
          amount: numAmount,
          payment_method: paymentMethod,
          recipient: recipient.trim() || null,
          notes: notes.trim() || null,
          expense_date: expenseDate,
        });
      }

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to save expense.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!expenseToDelete) return;

    try {
      setDeleting(true);
      await deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete expense:", err);
      alert("Failed to delete expense.");
    } finally {
      setDeleting(false);
    }
  }

  // Filter by search term in memory (recipient, notes, category, amount)
  const filteredList = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        (e.recipient || "").toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.payment_method || "").toLowerCase().includes(q) ||
        String(e.amount).includes(q),
    );
  }, [expenses, search]);

  const currentListTotal = useMemo(() => {
    return filteredList.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredList]);

  function getModePillClass(mode?: string | null) {
    const m = (mode || "").toLowerCase();
    if (m === "cash") return "expenses-mode-pill cash";
    if (m === "upi") return "expenses-mode-pill upi";
    if (m.includes("bank") || m.includes("transfer")) return "expenses-mode-pill bank";
    if (m === "cheque") return "expenses-mode-pill cheque";
    return "expenses-mode-pill cash";
  }

  return (
    <div className="expenses-page-container">
      {/* Header Row */}
      <div className="expenses-header-row">
        <div>
          <h3>Expense Management</h3>
          <p>Track store overheads, shop utilities, transport, and staff advances.</p>
        </div>

        <div className="expenses-header-actions">
          <div className="expenses-summary-badge">
            <span>💳</span>
            <span>
              {summary ? formatCurrency(summary.thisMonthTotal) : "₹ 0.00"} This Month
            </span>
          </div>

          <button
            type="button"
            className="expenses-add-btn"
            onClick={handleOpenAdd}
          >
            <span>+</span>
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="expenses-stats-grid">
        <div className="expenses-stat-card">
          <div>
            <div className="stat-label">Today's Outflow</div>
            <div className="stat-value">
              {summary ? formatCurrency(summary.todayTotal) : "₹0.00"}
            </div>
            <div className="stat-sub">Cash & UPI spent today</div>
          </div>
          <div className="customers-stat-icon stat-icon-amber">💵</div>
        </div>

        <div className="expenses-stat-card">
          <div>
            <div className="stat-label">This Month</div>
            <div className="stat-value" style={{ color: "#dc2626" }}>
              {summary ? formatCurrency(summary.thisMonthTotal) : "₹0.00"}
            </div>
            <div className="stat-sub">Current monthly total</div>
          </div>
          <div className="customers-stat-icon stat-icon-red">📅</div>
        </div>

        <div className="expenses-stat-card">
          <div>
            <div className="stat-label">All-Time Recorded</div>
            <div className="stat-value" style={{ color: "#2563eb" }}>
              {summary ? formatCurrency(summary.allTimeTotal) : "₹0.00"}
            </div>
            <div className="stat-sub">{summary?.totalCount || 0} total transactions</div>
          </div>
          <div className="customers-stat-icon stat-icon-blue">📊</div>
        </div>

        <div className="expenses-stat-card">
          <div>
            <div className="stat-label">Filtered Period</div>
            <div className="stat-value" style={{ color: "#0f172a" }}>
              {formatCurrency(currentListTotal)}
            </div>
            <div className="stat-sub">{filteredList.length} expenses showing</div>
          </div>
          <div className="customers-stat-icon stat-icon-emerald">🔍</div>
        </div>
      </div>

      {/* Main Expenses Card */}
      <div className="expenses-card">
        <div className="expenses-card-header">
          <div>
            <h4>
              <span>Expense Records</span>
              <span className="expenses-count-badge">
                Showing {filteredList.length} of {expenses.length}
              </span>
            </h4>
            <p>Filter by date presets, category, or search by recipient, remarks, or amount.</p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="expenses-filter-row">
          <div className="expenses-filter-left">
            <div className="expenses-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search recipient, notes, or amount..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="clear-btn"
                  title="Clear search"
                  onClick={() => setSearch("")}
                >
                  ✕
                </button>
              )}
            </div>

            <select
              className="expenses-category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {DEFAULT_EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="expenses-filter-right">
            <div className="expenses-presets-bar">
              <button
                type="button"
                className={`expenses-preset-btn ${dateFilter === "ALL" ? "active" : ""}`}
                onClick={() => setDateFilter("ALL")}
              >
                All Time
              </button>
              <button
                type="button"
                className={`expenses-preset-btn ${dateFilter === "TODAY" ? "active" : ""}`}
                onClick={() => setDateFilter("TODAY")}
              >
                Today
              </button>
              <button
                type="button"
                className={`expenses-preset-btn ${dateFilter === "THIS_MONTH" ? "active" : ""}`}
                onClick={() => setDateFilter("THIS_MONTH")}
              >
                This Month
              </button>
              <button
                type="button"
                className={`expenses-preset-btn ${dateFilter === "CUSTOM" ? "active" : ""}`}
                onClick={() => setDateFilter("CUSTOM")}
              >
                Custom Range
              </button>
            </div>

            {dateFilter === "CUSTOM" && (
              <div className="expenses-custom-dates">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="expenses-table-wrapper">
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Loading expense records...
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ padding: "44px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>🧾</div>
              <h5 style={{ margin: "0 0 6px", fontSize: "15px", color: "#1e293b" }}>
                {expenses.length === 0 ? "No expenses recorded yet" : "No expenses match your search"}
              </h5>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
                {expenses.length === 0
                  ? "Click the button below to log your store's first operational expense."
                  : "Try clearing your search query or changing your date/category filters."}
              </p>
              {search || categoryFilter !== "ALL" || dateFilter !== "ALL" ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("ALL");
                    setDateFilter("ALL");
                  }}
                >
                  Reset Filters
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleOpenAdd}
                >
                  + Record Expense
                </button>
              )}
            </div>
          ) : (
            <table className="expenses-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>#</th>
                  <th style={{ width: "120px" }}>Date</th>
                  <th>Category</th>
                  <th>Paid To / Recipient</th>
                  <th style={{ textAlign: "center", width: "130px" }}>Payment Mode</th>
                  <th>Notes & Purpose</th>
                  <th style={{ textAlign: "right", width: "140px" }}>Amount</th>
                  <th style={{ textAlign: "center", width: "140px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((exp, index) => (
                  <tr key={exp.id}>
                    <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                      {index + 1}
                    </td>
                    <td style={{ color: "#475569", fontSize: "12.5px", fontWeight: 500 }}>
                      {formatDate(exp.expense_date)}
                    </td>
                    <td>
                      <span className="expenses-category-pill">{exp.category}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        {exp.recipient || <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>—</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={getModePillClass(exp.payment_method)}>
                        {exp.payment_method || "Cash"}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#475569", fontSize: "12.5px" }}>
                        {exp.notes || <span style={{ color: "#94a3b8" }}>—</span>}
                      </span>
                    </td>
                    <td className="expenses-amount-cell">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          className="customers-action-btn"
                          onClick={() => handleOpenEdit(exp)}
                        >
                          <span>✏️</span>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="customers-action-btn customers-delete-btn"
                          onClick={() => setExpenseToDelete(exp)}
                          title="Delete expense"
                        >
                          <span>🗑️</span>
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div
            className="modal expenses-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>{editingExpense ? "Edit Expense Entry" : "Record New Expense"}</h3>
                <p>
                  {editingExpense
                    ? "Update expense details, recipient, or payment method."
                    : "Log an operational store disbursement or staff out-of-pocket expense."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                title="Close"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "20px 24px",
                }}
              >
                {error && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      color: "#dc2626",
                      fontSize: "13px",
                    }}
                  >
                    ⚠️ {error}
                  </div>
                )}

                {/* Section 1: Amount & Date */}
                <div className="expenses-form-grid">
                  <div className="expenses-field">
                    <label>
                      Expense Date <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="expenses-field">
                    <label>
                      Amount (₹) <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      required
                      autoFocus
                      style={{ fontWeight: 700, fontSize: "15px" }}
                    />
                  </div>
                </div>

                {/* Section 2: Category */}
                <div className="expenses-field">
                  <label>
                    Category <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {DEFAULT_EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="OTHER">+ Other Custom Category</option>
                  </select>
                </div>

                {category === "OTHER" && (
                  <div className="expenses-field">
                    <label>
                      Specify Custom Category <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Delivery Fuel, Generator Diesel"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Section 3: Recipient */}
                <div className="expenses-field">
                  <label>Paid To / Recipient (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. EB Office, Ramesh Driver, Tea Stall"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>

                {/* Section 4: Payment Mode */}
                <div className="expenses-field">
                  <label>Payment Mode</label>
                  <div className="expenses-mode-pills-row">
                    {PAYMENT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`expenses-mode-btn ${paymentMethod === mode ? "active" : ""}`}
                        onClick={() => setPaymentMethod(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 5: Notes */}
                <div className="expenses-field">
                  <label>Remarks / Notes (Optional)</label>
                  <textarea
                    placeholder="Add bill voucher number or details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div
                className="modal-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  padding: "14px 22px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>💾</span>
                  <span>{submitting ? "Saving..." : editingExpense ? "Update Expense" : "Save Expense"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div
          className="modal-overlay"
          onClick={() => !deleting && setExpenseToDelete(null)}
        >
          <div
            className="modal"
            style={{ maxWidth: "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Confirm Delete Expense</h3>
                <p>This action will permanently delete this expense voucher.</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setExpenseToDelete(null)}
                disabled={deleting}
                title="Close"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: "20px 22px" }}>
              <p style={{ margin: "0 0 12px 0", fontSize: "13.5px", color: "#334155" }}>
                Are you sure you want to delete this expense entry?
              </p>

              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "12px",
                  lineHeight: "1.6",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <b style={{ color: "#475569" }}>Date:</b> {formatDate(expenseToDelete.expense_date)}
                </div>
                <div>
                  <b style={{ color: "#475569" }}>Category:</b> {expenseToDelete.category}
                </div>
                {expenseToDelete.recipient && (
                  <div>
                    <b style={{ color: "#475569" }}>Paid To:</b> {expenseToDelete.recipient}
                  </div>
                )}
                <div>
                  <b style={{ color: "#475569" }}>Amount:</b>{" "}
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>
                    {formatCurrency(expenseToDelete.amount)}
                  </span>
                </div>
                {expenseToDelete.notes && (
                  <div>
                    <b style={{ color: "#475569" }}>Notes:</b> {expenseToDelete.notes}
                  </div>
                )}
              </div>

              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  color: "#dc2626",
                }}
              >
                ⚠️ <b>Warning:</b> Deleted expenses cannot be recovered and will be removed from monthly totals.
              </div>
            </div>

            <div
              className="modal-actions"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                padding: "14px 22px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setExpenseToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                <span>🗑️</span>
                <span>{deleting ? "Deleting..." : "Yes, Delete Expense"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
