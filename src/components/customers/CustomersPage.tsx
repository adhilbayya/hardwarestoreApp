import { useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  getCustomers,
  updateCustomer,
  type Customer,
} from "../../database/customer";

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  async function loadCustomers() {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
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
        (customer.gstin ?? "").toLowerCase().includes(search),
    );
  }, [customers, searchTerm]);

  function openAddModal() {
    setEditingCustomer(null);
    setShowModal(true);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer);
    setShowModal(true);
  }

  return (
    <div>
      <div className="welcome">
        <div>
          <h3>Customers</h3>
          <p>Manage your store customers.</p>
        </div>

        <button className="primary-button" onClick={openAddModal}>
          + Add Customer
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Customer List</h3>
            <p>
              Showing {filteredCustomers.length} of {customers.length} customers
            </p>
          </div>
        </div>

        <div className="product-filters">
          <div className="search-box">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search customer, phone or GSTIN..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>GSTIN</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading customers...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    {customers.length === 0
                      ? "No customers found"
                      : "No customers match your search"}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone || "-"}</td>
                    <td>{customer.address || "-"}</td>
                    <td>{customer.gstin || "-"}</td>

                    <td>
                      <button
                        className="secondary-button"
                        onClick={() => openEditModal(customer)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setShowModal(false)}
          onSaved={loadCustomers}
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
        });
      } else {
        await createCustomer({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          gstin: formData.gstin,
        });
      }

      await onSaved();
      onClose();
    } catch (error) {
      console.error("Failed to save customer:", error);
      setError("Failed to save customer. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>{customer ? "Edit Customer" : "Add Customer"}</h3>
            <p>
              {customer
                ? "Update customer information."
                : "Add a new customer to your store."}
            </p>
          </div>

          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Customer Name *</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter customer name"
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
            />
          </div>

          <div className="form-group">
            <label>Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter customer address"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>GSTIN</label>
            <input
              name="gstin"
              value={formData.gstin}
              onChange={handleChange}
              placeholder="Enter GSTIN (optional)"
            />
          </div>

          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button
            className="secondary-button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
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
