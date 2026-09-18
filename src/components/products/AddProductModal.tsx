import { useEffect, useState } from "react";
import { createProduct } from "../../database/product";
import { getCategories, type Category } from "../../database/category";
import { getUnits, type Unit } from "../../database/unit";

type AddProductModalProps = {
  onClose: () => void;
  onProductAdded: () => void;
};

function AddProductModal({ onClose, onProductAdded }: AddProductModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    brand: "",
    hsn_sac: "",
    category_id: "",
    unit_id: "",
    uom: "",
    tax_rate: "",
    purchase_price: "",
    selling_price: "",
    wholesale_price: "",
    mrp: "",
    stock_quantity: "",
    minimum_stock: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    try {
      const [categoryData, unitData] = await Promise.all([
        getCategories(),
        getUnits(),
      ]);

      setCategories(categoryData);
      setUnits(unitData);
    } catch (error) {
      console.error("Failed to load categories/units:", error);
    }
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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
      setError("Product name is required.");
      return;
    }

    if (formData.selling_price === "") {
      setError("Retail sale price is required.");
      return;
    }

    try {
      setSaving(true);

      await createProduct({
        name: formData.name.trim(),

        sku: formData.sku.trim() || null,
        barcode: formData.barcode.trim() || null,
        brand: formData.brand.trim() || null,
        hsn_sac: formData.hsn_sac.trim() || null,

        category_id: formData.category_id ? Number(formData.category_id) : null,

        unit_id: formData.unit_id ? Number(formData.unit_id) : null,

        uom: formData.uom.trim() || null,

        tax_rate: Number(formData.tax_rate) || 0,

        purchase_price: Number(formData.purchase_price) || 0,
        selling_price: Number(formData.selling_price),
        wholesale_price: Number(formData.wholesale_price) || 0,
        mrp: Number(formData.mrp) || 0,

        stock_quantity: Number(formData.stock_quantity) || 0,
        minimum_stock: Number(formData.minimum_stock) || 0,
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

            {/* SKU */}
            <div className="form-group">
              <label>SKU / Item Code</label>
              <input
                name="sku"
                type="text"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Item code"
              />
            </div>

            {/* Barcode */}
            <div className="form-group">
              <label>Barcode</label>
              <input
                name="barcode"
                type="text"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="Optional"
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

            {/* Category */}
            <div className="form-group">
              <label>Category</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
              >
                <option value="">Select category</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
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
              <label>Retail Sale Price</label>
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

            {/* Wholesale */}
            <div className="form-group">
              <label>Wholesale Sale Price</label>
              <input
                name="wholesale_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.wholesale_price}
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
