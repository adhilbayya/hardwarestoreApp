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
          name,
          phone,
          address,
          gstin,
        });
      } else {
        await createSupplier({
          name,
          phone,
          address,
          gstin,
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
      supplier.gstin?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="supplier-page">
      <div className="welcome">
        <div>
          <h3>Suppliers</h3>
          <p>Manage your suppliers and supplier information.</p>
        </div>

        <button className="primary-button" onClick={openAddModal}>
          + Add Supplier
        </button>
      </div>

      <div className="suppliers-card panel">
        <div className="suppliers-toolbar">
          <div className="suppliers-search">
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredSuppliers.length === 0 ? (
          <div className="suppliers-empty">
            <h3>No suppliers found</h3>
            <p>Add your first supplier to get started.</p>
          </div>
        ) : (
          <div className="suppliers-table-wrapper">
            <table className="suppliers-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>GSTIN</th>
                  <th>Address</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <span className="supplier-name">{supplier.name}</span>
                    </td>

                    <td className="supplier-phone">{supplier.phone || "—"}</td>

                    <td className="supplier-gstin">{supplier.gstin || "—"}</td>

                    <td className="supplier-address">
                      {supplier.address || "—"}
                    </td>

                    <td>
                      <button
                        className="supplier-edit-button"
                        onClick={() => openEditModal(supplier)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="supplier-modal-overlay" onClick={closeModal}>
          <div className="supplier-modal" onClick={(e) => e.stopPropagation()}>
            <div className="supplier-modal-header">
              <div>
                <h3>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h3>

                <p>
                  {editingSupplier
                    ? "Update supplier information."
                    : "Add a new supplier to your store."}
                </p>
              </div>

              <button className="supplier-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="supplier-modal-body">
              {error && <div className="supplier-form-error">{error}</div>}

              <div className="supplier-form-group">
                <label>Supplier Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter supplier name"
                />
              </div>

              <div className="supplier-form-group">
                <label>Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="supplier-form-group">
                <label>GSTIN</label>
                <input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="Enter GSTIN"
                />
              </div>

              <div className="supplier-form-group">
                <label>Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter supplier address"
                  rows={3}
                />
              </div>
            </div>

            <div className="supplier-modal-actions">
              <button className="secondary-button" onClick={closeModal}>
                Cancel
              </button>

              <button className="primary-button" onClick={handleSave}>
                {editingSupplier ? "Update Supplier" : "Save Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
