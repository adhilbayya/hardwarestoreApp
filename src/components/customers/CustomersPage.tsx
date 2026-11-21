import { useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
  getCustomerInvoiceCount,
  type Customer,
} from "../../database/customer";
import { getAllCustomerCreditBalances } from "../../database/customerPayment";
import CustomerLedgerModal from "./CustomerLedgerModal";

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditBalances, setCreditBalances] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState<Customer | null>(null);

  // Delete confirmation modal state
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleteInvoiceCount, setDeleteInvoiceCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadCustomers() {
    try {
      setLoading(true);
      const [data, balances] = await Promise.all([
        getCustomers(),
        getAllCustomerCreditBalances(),
      ]);
      setCustomers(data);
      setCreditBalances(balances);
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return customers;

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(search) ||
        (customer.phone ?? "").toLowerCase().includes(search) ||
        (customer.gstin ?? "").toLowerCase().includes(search) ||
        (customer.address ?? "").toLowerCase().includes(search),
    );
  }, [customers, searchTerm]);

  // Derived metrics for KPI cards
  const stats = useMemo(() => {
    let gstRegistered = 0;
    let withPhone = 0;

    for (const c of customers) {
      if (c.gstin && c.gstin.trim() !== "") gstRegistered++;
      if (c.phone && c.phone.trim() !== "") withPhone++;
    }

    let totalCreditOutstanding = 0;
    let debtorCount = 0;
    for (const bal of creditBalances.values()) {
      if (bal > 0.001) {
        totalCreditOutstanding += bal;
        debtorCount++;
      }
    }

    return {
      total: customers.length,
      gstRegistered,
      withPhone,
      totalCreditOutstanding,
      debtorCount,
    };
  }, [customers, creditBalances]);

  function openAddModal() {
    setEditingCustomer(null);
    setShowModal(true);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer);
    setShowModal(true);
  }

  async function promptDeleteCustomer(customer: Customer) {
    setCustomerToDelete(customer);
    setDeleteInvoiceCount(null);
    setDeleteError("");
    try {
      const count = await getCustomerInvoiceCount(customer.id);
      setDeleteInvoiceCount(count);
    } catch (err) {
      console.error("Failed to check invoice count for customer:", err);
      setDeleteInvoiceCount(0);
    }
  }

  async function handleConfirmDelete() {
    if (!customerToDelete) return;
    try {
      setDeleting(true);
      setDeleteError("");
      await deleteCustomer(customerToDelete.id);
      await loadCustomers();
      setCustomerToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete customer:", err);
      setDeleteError(err?.message || "Failed to delete customer record.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="customers-page-container">
      {/* Header Row */}
      <div className="customers-header-row">
        <div>
          <h3>Customers Directory</h3>
          <p>Manage store clients, contact numbers, GST numbers, and billing addresses.</p>
        </div>

        <div className="customers-header-actions">
          <div className="customers-summary-badge">
            <span>👥</span>
            <span>
              {customers.length} {customers.length === 1 ? "Customer" : "Customers"} Registered
            </span>
          </div>

          <button
            type="button"
            className="customers-add-btn"
            onClick={openAddModal}
          >
            <span>+</span>
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="customers-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <div className="customers-stat-card">
          <div>
            <div className="stat-label">Total Client Base</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-sub">Registered buyers & accounts</div>
          </div>
          <div className="customers-stat-icon stat-icon-blue">👥</div>
        </div>

        <div className="customers-stat-card">
          <div>
            <div className="stat-label">Total Credit Outstanding</div>
            <div className="stat-value" style={{ color: "#d97706" }}>
              ₹{stats.totalCreditOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="stat-sub">Across {stats.debtorCount} debtor accounts</div>
          </div>
          <div className="customers-stat-icon stat-icon-amber">💰</div>
        </div>

        <div className="customers-stat-card">
          <div>
            <div className="stat-label">GST Registered (B2B)</div>
            <div className="stat-value" style={{ color: "#059669" }}>
              {stats.gstRegistered}
            </div>
            <div className="stat-sub">Valid GSTIN holders for tax filing</div>
          </div>
          <div className="customers-stat-icon stat-icon-emerald">🏢</div>
        </div>

        <div className="customers-stat-card">
          <div>
            <div className="stat-label">Phone Verified</div>
            <div className="stat-value" style={{ color: "#7c3aed" }}>
              {stats.withPhone}
            </div>
            <div className="stat-sub">Contact numbers on record</div>
          </div>
          <div className="customers-stat-icon stat-icon-purple">📱</div>
        </div>
      </div>

      {/* Main Customers Card */}
      <div className="customers-card">
        <div className="customers-card-header">
          <div>
            <h4>
              <span>Customer Records</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#2563eb",
                  background: "#eff6ff",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                Showing {filteredCustomers.length} of {customers.length}
              </span>
            </h4>
            <p>Search by customer name, mobile phone number, address, or GSTIN.</p>
          </div>
        </div>

        {/* Search Bar Row */}
        <div className="customers-search-row">
          <div className="customers-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search customer name, phone number, GSTIN, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-btn"
                title="Clear search"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="customers-table-wrapper">
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Loading customer directory...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div style={{ padding: "44px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>👥</div>
              <h5 style={{ margin: "0 0 6px", fontSize: "15px", color: "#1e293b" }}>
                {customers.length === 0
                  ? "No customers added yet"
                  : "No customers match your search"}
              </h5>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
                {customers.length === 0
                  ? "Click the button below to register your first store customer."
                  : "Try clearing your search query or searching by partial name or digits."}
              </p>
              {searchTerm ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSearchTerm("")}
                >
                  Clear Search
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={openAddModal}
                >
                  + Add First Customer
                </button>
              )}
            </div>
          ) : (
            <table className="customers-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>#</th>
                  <th>Customer Name</th>
                  <th style={{ width: "150px" }}>Phone Number</th>
                  <th>Billing Address</th>
                  <th style={{ width: "170px" }}>GSTIN</th>
                  <th style={{ width: "170px", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer, index) => {
                  const pendingDue = creditBalances.get(customer.id);
                  const hasDue = pendingDue !== undefined && pendingDue > 0.001;

                  return (
                    <tr key={customer.id}>
                      <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                        {index + 1}
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerForLedger(customer)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              fontWeight: 600,
                              color: "#0f172a",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "13.5px",
                            }}
                            title="Click to view Customer Khata / Statement"
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#2563eb")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#0f172a")}
                          >
                            {customer.name}
                          </button>

                          {hasDue && (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#b45309",
                                background: "#fffbeb",
                                border: "1px solid #fde68a",
                                padding: "1px 7px",
                                borderRadius: "10px",
                              }}
                              title="Pending credit due"
                            >
                              Due: ₹{pendingDue!.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                        {customer.state_name && (
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            📍 {customer.state_name}{customer.state_code ? ` (${customer.state_code})` : ""}
                          </div>
                        )}
                      </td>

                      <td>
                        {customer.phone ? (
                          <span style={{ fontWeight: 500, color: "#1e293b" }}>
                            📞 {customer.phone}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      <td>
                        {customer.address ? (
                          <span style={{ color: "#334155" }}>{customer.address}</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      <td>
                        {customer.gstin ? (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "#059669",
                              background: "#ecfdf5",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              border: "1px solid #a7f3d0",
                            }}
                          >
                            {customer.gstin}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>Consumer</span>
                        )}
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
                            style={{
                              color: "#2563eb",
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                            }}
                            onClick={() => setSelectedCustomerForLedger(customer)}
                            title="Open Customer Account Khata / Ledger"
                          >
                            <span>📄</span>
                            <span>Ledger</span>
                          </button>
                          <button
                            type="button"
                            className="customers-action-btn"
                            onClick={() => openEditModal(customer)}
                          >
                            <span>✏️</span>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="customers-action-btn customers-delete-btn"
                            onClick={() => promptDeleteCustomer(customer)}
                            title="Delete customer"
                          >
                            <span>🗑️</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setShowModal(false)}
          onSaved={loadCustomers}
        />
      )}

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div
          className="modal-overlay"
          onClick={() => !deleting && setCustomerToDelete(null)}
        >
          <div
            className="modal"
            style={{ maxWidth: "460px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#fee2e2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  🗑️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>
                    Delete Customer
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Permanently remove this customer record
                  </p>
                </div>
              </div>

              <button
                className="modal-close"
                onClick={() => !deleting && setCustomerToDelete(null)}
                disabled={deleting}
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: "18px 22px" }}>
              {deleteError && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    color: "#dc2626",
                    fontSize: "12.5px",
                    marginBottom: "12px",
                  }}
                >
                  ⚠️ {deleteError}
                </div>
              )}

              <p style={{ margin: "0 0 12px 0", fontSize: "13.5px", color: "#334155" }}>
                Are you sure you want to delete{" "}
                <b style={{ color: "#0f172a" }}>{customerToDelete.name}</b>?
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
                  <b style={{ color: "#475569" }}>Name:</b> {customerToDelete.name}
                </div>
                {customerToDelete.phone && (
                  <div>
                    <b style={{ color: "#475569" }}>Phone:</b> {customerToDelete.phone}
                  </div>
                )}
                {customerToDelete.gstin && (
                  <div>
                    <b style={{ color: "#475569" }}>GSTIN:</b> {customerToDelete.gstin}
                  </div>
                )}
                {customerToDelete.address && (
                  <div>
                    <b style={{ color: "#475569" }}>Address:</b>{" "}
                    {customerToDelete.address}
                  </div>
                )}
              </div>

              {deleteInvoiceCount !== null && deleteInvoiceCount > 0 ? (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    color: "#b45309",
                    lineHeight: "1.4",
                  }}
                >
                  ⚠️ <b>Notice:</b> This customer is linked to{" "}
                  <b>{deleteInvoiceCount}</b> past invoice(s). Deleting will remove
                  this customer profile and retain those past invoices as Walk-in
                  Customer.
                </div>
              ) : deleteInvoiceCount === 0 ? (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "#15803d",
                  }}
                >
                  ✅ No invoices are linked to this customer profile. Safe to
                  delete.
                </div>
              ) : null}
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
                onClick={() => setCustomerToDelete(null)}
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
                <span>{deleting ? "Deleting..." : "Yes, Delete Customer"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Account Ledger / Khata Statement Modal */}
      {selectedCustomerForLedger && (
        <CustomerLedgerModal
          customer={selectedCustomerForLedger}
          onClose={() => setSelectedCustomerForLedger(null)}
          onPaymentRecorded={loadCustomers}
        />
      )}
    </div>
  );
}

type CustomerModalProps = {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
};

function CustomerModal({ customer, onClose, onSaved }: CustomerModalProps) {
  const [formData, setFormData] = useState({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    gstin: customer?.gstin ?? "",
    state_name: customer?.state_name ?? "",
    state_code: customer?.state_code ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSave() {
    setError("");

    if (!formData.name.trim()) {
      setError("Customer name is required.");
      return;
    }

    try {
      setSaving(true);

      if (customer) {
        await updateCustomer(customer.id, {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          gstin: formData.gstin,
          state_name: formData.state_name,
          state_code: formData.state_code,
        });
      } else {
        await createCustomer({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          gstin: formData.gstin,
          state_name: formData.state_name,
          state_code: formData.state_code,
        });
      }

      await onSaved();
      onClose();
    } catch (error: any) {
      console.error("Failed to save customer:", error);
      setError("Failed to save customer: " + (error?.message || String(error)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal product-editor-modal"
        style={{ maxWidth: "540px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>{customer ? "Edit Customer Details" : "Register New Customer"}</h3>
            <p>
              {customer
                ? "Update contact numbers, billing address, or tax details."
                : "Add a new customer profile for quick invoice selection."}
            </p>
          </div>

          <button className="modal-close" onClick={onClose} disabled={saving} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="product-editor-body" style={{ padding: "20px 24px" }}>
          {error && (
            <div
              className="form-error"
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

          {/* Section 1: Basic & Contact */}
          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>👤</span>
              <span>Primary Information</span>
            </div>

            <div className="product-editor-field">
              <label>
                Customer Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Ramesh Kumar, City Hardware"
                autoFocus
              />
            </div>

            <div className="product-editor-field">
              <label>Mobile / Phone Number</label>
              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
              />
            </div>

            <div className="product-editor-field">
              <label>Billing & Delivery Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter street, locality, town, or pincode"
                rows={2}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Section 2: Taxation & GST */}
          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>🏛️</span>
              <span>GST & State Details (Optional)</span>
            </div>

            <div className="product-editor-field">
              <label>GSTIN (15 Digits)</label>
              <input
                name="gstin"
                value={formData.gstin}
                onChange={handleChange}
                placeholder="e.g. 33AAAAA0000A1Z5"
                style={{ textTransform: "uppercase" }}
              />
              <span className="field-hint">Required for B2B GST tax credit invoices</span>
            </div>

            <div className="product-editor-grid-2">
              <div className="product-editor-field">
                <label>State Name</label>
                <input
                  name="state_name"
                  value={formData.state_name}
                  onChange={handleChange}
                  placeholder="e.g. Tamil Nadu"
                />
              </div>

              <div className="product-editor-field">
                <label>State Code</label>
                <input
                  name="state_code"
                  value={formData.state_code}
                  onChange={handleChange}
                  placeholder="e.g. 33"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : customer
                ? "Update Customer"
                : "Save Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomersPage;
