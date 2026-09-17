import { useEffect, useState } from "react";
import { updateProduct, type Product } from "../../database/product";
import { getCategories, type Category } from "../../database/category";
import { getUnits, type Unit } from "../../database/unit";

type EditProductModalProps = {
  product: Product;
  onClose: () => void;
  onProductUpdated: () => void;
};

function EditProductModal({
  product,
  onClose,
  onProductUpdated,
}: EditProductModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    name: product.name,
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    brand: product.brand ?? "",
    hsn_sac: product.hsn_sac ?? "",
    category_id: product.category_id?.toString() ?? "",
    unit_id: product.unit_id?.toString() ?? "",
    uom: product.uom ?? "",
    tax_rate: product.tax_rate.toString(),

    purchase_price: product.purchase_price.toString(),
    selling_price: product.selling_price.toString(),
    wholesale_price: product.wholesale_price.toString(),
    mrp: product.mrp.toString(),

    stock_quantity: product.stock_quantity.toString(),
    minimum_stock: product.minimum_stock.toString(),
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

      await updateProduct(product.id, {
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

      onProductUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to update product:", error);
      setError("Failed to update product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Edit Product</h3>
            <p>Update product information.</p>
          </div>

          <button className="modal-close" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Product Name</label>
            <input name="name" value={formData.name} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>SKU / Item Code</label>
            <input name="sku" value={formData.sku} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Barcode</label>
            <input
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Brand</label>
            <input
              name="brand"
              value={formData.brand}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>HSN / SAC</label>
            <input
              name="hsn_sac"
              value={formData.hsn_sac}
              onChange={handleChange}
            />
          </div>

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

          <div className="form-group">
            <label>UOM</label>
            <input
              name="uom"
              value={formData.uom}
              onChange={handleChange}
              placeholder="e.g. 6 mtr / 2 no"
            />
          </div>

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

          <div className="form-group">
            <label>Tax Rate (%)</label>
            <input
              name="tax_rate"
              type="number"
              min="0"
              step="0.01"
              value={formData.tax_rate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Purchase Price</label>
            <input
              name="purchase_price"
              type="number"
              min="0"
              step="0.01"
              value={formData.purchase_price}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Retail Sale Price</label>
            <input
              name="selling_price"
              type="number"
              min="0"
              step="0.01"
              value={formData.selling_price}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Wholesale Sale Price</label>
            <input
              name="wholesale_price"
              type="number"
              min="0"
              step="0.01"
              value={formData.wholesale_price}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>MRP</label>
            <input
              name="mrp"
              type="number"
              min="0"
              step="0.01"
              value={formData.mrp}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Current Stock</label>
            <input
              name="stock_quantity"
              type="number"
              min="0"
              step="0.01"
              value={formData.stock_quantity}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Minimum Stock</label>
            <input
              name="minimum_stock"
              type="number"
              min="0"
              step="0.01"
              value={formData.minimum_stock}
              onChange={handleChange}
            />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

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
            {saving ? "Saving..." : "Update Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditProductModal;
