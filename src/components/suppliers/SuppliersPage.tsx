import { useEffect, useState } from "react";
import {
  createSupplier,
  getSuppliers,
  updateSupplier,
  type Supplier,
} from "../../database/supplier";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");

  const [error, setError] = useState("");

  async function loadSuppliers() {
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function openAddModal() {
    setEditingSupplier(null);
    setName("");
    setPhone("");
    setAddress("");
    setGstin("");
    setError("");
    setIsModalOpen(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setPhone(supplier.phone ?? "");
    setAddress(supplier.address ?? "");
    setGstin(supplier.gstin ?? "");
    setError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingSupplier(null);
    setError("");
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Supplier name is required.");
      return;
    }

    try {
      setError("");

      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          gstin: gstin.trim() || undefined,
        });
      } else {
        await createSupplier({
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          gstin: gstin.trim() || undefined,
        });
      }

      await loadSuppliers();
      closeModal();
    } catch (error) {
      console.error("Failed to save supplier:", error);
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
    }
  }

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = search.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.gstin?.toLowerCase().includes(query) ||
      supplier.address?.toLowerCase().includes(query)
    );
  });

  const totalSuppliersCount = suppliers.length;
  const gstRegisteredCount = suppliers.filter((s) => s.gstin && s.gstin.trim() !== "").length;
  const phoneContactsCount = suppliers.filter((s) => s.phone && s.phone.trim() !== "").length;

  return (
    <div className="suppliers-page-container">
      {/* Header */}
      <div className="suppliers-header-row">
        <div>
          <h3>Suppliers Directory</h3>
          <p>Manage vendors, distributor contacts, and GST credentials.</p>
        </div>

        <button className="primary-button" onClick={openAddModal}>
          + Add Supplier
        </button>
      </div>

      {/* KPI Cards */}
      <div className="suppliers-stats-grid">
        <div className="suppliers-stat-card">
          <div>
            <div className="stat-label">Total Suppliers</div>
            <div className="stat-value">{totalSuppliersCount}</div>
            <div className="stat-sub">Active vendors on file</div>
          </div>
          <div className="customer-stat-icon stat-icon-blue">🏢</div>
        </div>

        <div className="suppliers-stat-card">
          <div>
            <div className="stat-label">GST Registered</div>
            <div className="stat-value">{gstRegisteredCount}</div>
            <div className="stat-sub">Vendors with verified GSTIN</div>
          </div>
          <div className="customer-stat-icon stat-icon-purple">🧾</div>
        </div>

        <div className="suppliers-stat-card">
          <div>
            <div className="stat-label">Phone Contacts</div>
            <div className="stat-value">{phoneContactsCount}</div>
            <div className="stat-sub">Direct phone reachability</div>
          </div>
          <div className="customer-stat-icon stat-icon-emerald">📞</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="suppliers-card">
        <div className="suppliers-card-header">
          <h4>All Suppliers ({filteredSuppliers.length})</h4>

          <div className="suppliers-search-box">
            <span className="suppliers-search-icon">🔍</span>
            <input
              type="text"
              className="suppliers-search-input"
              placeholder="Search by vendor name, phone, GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="suppliers-search-clear"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {filteredSuppliers.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏢</div>
            <h4
              style={{
                margin: "0 0 4px",
                color: "#1e293b",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              {search ? "No suppliers match your search" : "No suppliers yet"}
            </h4>
            <p style={{ margin: 0, fontSize: "13px" }}>
              {search
                ? "Try searching with a different name or number."
                : "Add your first supplier or distributor above to get started."}
            </p>
          </div>
        ) : (
          <div className="suppliers-table-wrapper">
            <table className="suppliers-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Phone</th>
                  <th>GSTIN</th>
                  <th>Address</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <strong style={{ color: "#0f172a", fontSize: "14px" }}>
                        {supplier.name}
                      </strong>
                    </td>

                    <td>
                      {supplier.phone ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontFamily: "monospace",
                            fontWeight: 600,
                            color: "#334155",
                          }}
                        >
                          📞 {supplier.phone}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>

                    <td>
                      {supplier.gstin ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            fontFamily: "monospace",
                            fontWeight: 600,
                            fontSize: "12px",
                            color: "#0f172a",
                          }}
                        >
                          {supplier.gstin}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>

                    <td style={{ maxWidth: "300px" }}>
                      <span
                        style={{
                          color: supplier.address ? "#475569" : "#94a3b8",
                          fontSize: "13px",
                        }}
                      >
                        {supplier.address || "—"}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        className="customers-action-btn"
                        onClick={() => openEditModal(supplier)}
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal product-editor-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px" }}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
                </h3>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  {editingSupplier
                    ? "Update supplier details and GST credentials."
                    : "Register a new vendor for inventory purchases."}
                </p>
              </div>

              <button className="modal-close" onClick={closeModal} title="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div
                  className="form-error"
                  style={{
                    margin: "0 0 16px 0",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: "13px",
                  }}
                >
                  {error}
                </div>
              )}

              <div className="product-editor-section">
                <div className="product-editor-section-header">
                  <span className="product-editor-section-title">
                    Vendor Information
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "6px",
                    }}
                  >
                    Supplier / Company Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Tools & Hardware Ltd."
                    autoFocus
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <div className="form-group">
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="form-group">
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      GSTIN Number
                    </label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 32AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "6px",
                    }}
                  >
                    Address
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop/Warehouse address, Street, City..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={closeModal}>
                Cancel
              </button>

              <button className="primary-button" onClick={handleSave}>
                {editingSupplier ? "Save Changes" : "Create Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
