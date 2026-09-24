import { useEffect, useState } from "react";
import { createProduct } from "../../database/product";
import { getUnits, type Unit } from "../../database/unit";

type AddProductModalProps = {
  onClose: () => void;
  onProductAdded: () => void;
};

function AddProductModal({ onClose, onProductAdded }: AddProductModalProps) {
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    brand: "",
    hsn_sac: "",
    category_id: "",
    unit_id: "",
    uom: "",
    tax_rate: "",
    purchase_price: "",
    selling_price: "",
    mrp: "",
    stock_quantity: "",
    minimum_stock: "",
    has_bulk: false,
    bulk_unit: "",
    bulk_conversion_rate: "",
    bulk_price: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    try {
      const unitData = await getUnits();
      setUnits(unitData);
    } catch (error) {
      console.error("Failed to load categories/units:", error);
    }
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = event.target;

    let parsedValue: any = value;
    if (type === "checkbox") {
      parsedValue = (event.target as HTMLInputElement).checked;
    }

    setFormData((previous) => ({
      ...previous,
      [name]: parsedValue,
    }));
  }

  async function handleSave() {
    setError("");

    if (!formData.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (formData.selling_price === "") {
      setError("Sale price is required.");
      return;
    }

    try {
      setSaving(true);

      await createProduct({
        name: formData.name.trim(),

        barcode: formData.barcode.trim() || null,
        brand: formData.brand.trim() || null,
        hsn_sac: formData.hsn_sac.trim() || null,

        category_id: formData.category_id ? Number(formData.category_id) : null,

        unit_id: formData.unit_id ? Number(formData.unit_id) : null,

        uom: formData.uom.trim() || null,

        tax_rate: Number(formData.tax_rate) || 0,

        purchase_price: Number(formData.purchase_price) || 0,
        selling_price: Number(formData.selling_price),
        wholesale_price: 0,
        mrp: Number(formData.mrp) || 0,

        stock_quantity: Number(formData.stock_quantity) || 0,
        minimum_stock: Number(formData.minimum_stock) || 0,

        has_bulk: formData.has_bulk ? 1 : 0,
        bulk_unit: formData.bulk_unit.trim() || null,
        bulk_conversion_rate: Number(formData.bulk_conversion_rate) || null,
        bulk_price: Number(formData.bulk_price) || null,
      });

      onProductAdded();
      onClose();
    } catch (error) {
      console.error("Failed to save product:", error);
      setError(
        "Failed to save product. Please check the values and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal product-modal">
        <div className="modal-header">
          <div>
            <h3>Add Product</h3>
            <p>Add a new product to your inventory.</p>
          </div>

          <button className="modal-close" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="form-grid">
            {/* Product Name */}
            <div className="form-group">
              <label>Product Name</label>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. PVC Pipe 1 inch"
              />
            </div>

            {/* Brand */}
            <div className="form-group">
              <label>Brand</label>
              <input
                name="brand"
                type="text"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g. Supreme"
              />
            </div>

            {/* HSN/SAC */}
            <div className="form-group">
              <label>HSN / SAC</label>
              <input
                name="hsn_sac"
                type="text"
                value={formData.hsn_sac}
                onChange={handleChange}
                placeholder="e.g. 3917"
              />
            </div>

            {/* UOM */}
            <div className="form-group">
              <label>UOM</label>
              <input
                name="uom"
                type="text"
                value={formData.uom}
                onChange={handleChange}
                placeholder="e.g. 6 mtr / 2 no"
              />
            </div>

            {/* Unit */}
            <div className="form-group">
              <label>Unit</label>
              <select
                name="unit_id"
                value={formData.unit_id}
                onChange={handleChange}
              >
                <option value="">Select unit</option>

                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                    {unit.symbol ? ` (${unit.symbol})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Tax */}
            <div className="form-group">
              <label>Tax Rate (%)</label>
              <input
                name="tax_rate"
                type="number"
                min="0"
                step="0.01"
                value={formData.tax_rate}
                onChange={handleChange}
                placeholder="18"
              />
            </div>

            {/* Purchase */}
            <div className="form-group">
              <label>Purchase Price</label>
              <input
                name="purchase_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.purchase_price}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>

            {/* Retail */}
            <div className="form-group">
              <label>Sale Price</label>
              <input
                name="selling_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.selling_price}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>

            {/* MRP */}
            <div className="form-group">
              <label>MRP</label>
              <input
                name="mrp"
                type="number"
                min="0"
                step="0.01"
                value={formData.mrp}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>

            {/* Current Stock */}
            <div className="form-group">
              <label>Current Stock</label>
              <input
                name="stock_quantity"
                type="number"
                min="0"
                step="0.01"
                value={formData.stock_quantity}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            {/* Minimum Stock */}
            <div className="form-group">
              <label>Minimum Stock</label>
              <input
                name="minimum_stock"
                type="number"
                min="0"
                step="0.01"
                value={formData.minimum_stock}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            {/* Bulk Settings Toggle */}
            <div
              className="form-group"
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              <input
                type="checkbox"
                name="has_bulk"
                id="has_bulk_checkbox"
                checked={formData.has_bulk}
                onChange={handleChange}
                style={{ width: "auto" }}
              />
              <label htmlFor="has_bulk_checkbox" style={{ marginBottom: 0 }}>
                This item is also sold in bulk (e.g. Bundle, Box)
              </label>
            </div>

            {formData.has_bulk && (
              <>
                <div className="form-group">
                  <label>Bulk Unit Name</label>
                  <input
                    name="bulk_unit"
                    type="text"
                    value={formData.bulk_unit}
                    onChange={handleChange}
                    placeholder="e.g. Bundle"
                  />
                </div>
                <div className="form-group">
                  <label>Base Units per Bulk</label>
                  <input
                    name="bulk_conversion_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.bulk_conversion_rate}
                    onChange={handleChange}
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="form-group">
                  <label>Bulk Sale Price</label>
                  <input
                    name="bulk_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.bulk_price}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="form-error" style={{ margin: "0 28px 20px" }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-actions">
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
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddProductModal;
