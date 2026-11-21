import { useEffect, useState } from "react";
import { updateProduct, type Product } from "../../database/product";
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
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    name: product.name,
    barcode: product.barcode ?? "",
    brand: product.brand ?? "",
    hsn_sac: product.hsn_sac ?? "",
    category_id: product.category_id?.toString() ?? "",
    unit_id: product.unit_id?.toString() ?? "",
    uom: product.uom ?? "",
    tax_rate: product.tax_rate.toString(),

    purchase_price: product.purchase_price.toString(),
    selling_price: product.selling_price.toString(),
    mrp: product.mrp.toString(),

    stock_quantity: product.stock_quantity.toString(),
    minimum_stock: product.minimum_stock.toString(),
    has_bulk: product.has_bulk === 1,
    bulk_unit: product.bulk_unit || "",
    bulk_conversion_rate: product.bulk_conversion_rate?.toString() || "",
    bulk_price: product.bulk_price?.toString() || "",
    bulk_mrp: product.bulk_price
      ? (
          Number(product.bulk_price) *
          (1 + Number(product.tax_rate) / 100)
        ).toFixed(2)
      : "",
    bulk_purchase_price:
      product.bulk_conversion_rate && product.purchase_price
        ? (
            Number(product.purchase_price) *
            Number(product.bulk_conversion_rate)
          ).toFixed(2)
        : "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stockInputType, setStockInputType] = useState("base");

  function handleStockTypeChange(newType: string) {
    if (newType === stockInputType) return;
    const rate = Number(formData.bulk_conversion_rate) || 1;
    const currentStock = Number(formData.stock_quantity);

    if (!isNaN(currentStock) && formData.stock_quantity.trim() !== "") {
      if (newType === "bulk") {
        // Converting base units to packages: divide by conversion rate
        const converted = rate > 0 ? (currentStock / rate) : currentStock;
        setFormData((prev) => ({
          ...prev,
          stock_quantity: converted.toString(),
        }));
      } else {
        // Converting packages to base units: multiply by conversion rate
        const converted = currentStock * rate;
        setFormData((prev) => ({
          ...prev,
          stock_quantity: converted.toString(),
        }));
      }
    }
    setStockInputType(newType);
  }

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

    setFormData((previous) => {
      const nextData = { ...previous, [name]: parsedValue };
      if (name === "mrp") {
        const taxNum = Number(nextData.tax_rate) || 0;
        if (value.trim() !== "") {
          const incPrice = Number(value);
          if (!isNaN(incPrice)) {
            nextData.selling_price = (incPrice / (1 + taxNum / 100)).toFixed(2);
          }
        }
      }

      if (name === "bulk_mrp") {
        const taxNum = Number(nextData.tax_rate) || 0;
        if (value.trim() !== "") {
          const incPrice = Number(value);
          if (!isNaN(incPrice)) {
            nextData.bulk_price = (incPrice / (1 + taxNum / 100)).toFixed(2);
          }
        }
      }

      if (name === "bulk_purchase_price") {
        const rate = Number(nextData.bulk_conversion_rate) || 1;
        if (value.trim() !== "") {
          nextData.purchase_price = (Number(value) / rate).toFixed(2);
        }
      }

      if (name === "bulk_conversion_rate") {
        const rate = Number(parsedValue) || 1;
        if (
          nextData.bulk_purchase_price !== undefined &&
          nextData.bulk_purchase_price.trim() !== ""
        ) {
          nextData.purchase_price = (
            Number(nextData.bulk_purchase_price) / rate
          ).toFixed(2);
        }
      }

      return nextData;
    });
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

      let finalStock = Number(formData.stock_quantity) || 0;
      if (formData.has_bulk && stockInputType === "bulk") {
        finalStock = finalStock * (Number(formData.bulk_conversion_rate) || 1);
      }

      await updateProduct(product.id, {
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

        stock_quantity: finalStock,
        minimum_stock: Number(formData.minimum_stock) || 0,

        has_bulk: formData.has_bulk ? 1 : 0,
        bulk_unit: formData.bulk_unit.trim() || null,
        bulk_conversion_rate: Number(formData.bulk_conversion_rate) || null,
        bulk_price: Number(formData.bulk_price) || null,
      });

      onProductUpdated();
      onClose();
    } catch (error: any) {
      console.error("Failed to update product:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("UNIQUE constraint failed: products.barcode")) {
        setError("A product with this Barcode already exists.");
      } else {
        setError(`Failed to update product: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal product-editor-modal">
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3>Edit Product</h3>
            <p>Modify catalog specifications, pricing, tax rates, or inventory levels.</p>
          </div>

          <button className="modal-close" onClick={onClose} disabled={saving} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="product-editor-body">
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

          {/* Section 1: Basic Information */}
          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>📦</span>
              <span>Basic Information</span>
            </div>

            <div className="product-editor-field">
              <label>
                Product Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. PVC Pipe 1 inch"
              />
            </div>

            <div className="product-editor-grid-3">
              <div className="product-editor-field">
                <label>Brand / Manufacturer</label>
                <input
                  name="brand"
                  type="text"
                  value={formData.brand}
                  onChange={handleChange}
                  placeholder="e.g. Supreme, Finolex"
                />
              </div>

              <div className="product-editor-field">
                <label>HSN / SAC Code</label>
                <input
                  name="hsn_sac"
                  type="text"
                  value={formData.hsn_sac}
                  onChange={handleChange}
                  placeholder="e.g. 3917, 8413"
                />
              </div>

              <div className="product-editor-field">
                <label>
                  {formData.has_bulk ? "Loose Unit (e.g. Meter, Pc)" : "Base Unit"}
                </label>
                <select
                  name="unit_id"
                  value={formData.unit_id}
                  onChange={handleChange}
                >
                  <option value="">Select unit...</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                      {unit.symbol ? ` (${unit.symbol})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Taxation */}
          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>💰</span>
              <span>Pricing & Taxation</span>
            </div>

            <div className="product-editor-grid-4">
              <div className="product-editor-field">
                <label>Tax Rate (GST %)</label>
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

              <div className="product-editor-field">
                <label>
                  {formData.has_bulk ? "Purchase Rate / Unit" : "Purchase Price (₹)"}
                </label>
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

              <div className="product-editor-field">
                <label>
                  Sale Price (-tax) <span style={{ color: "#ef4444" }}>*</span>
                </label>
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

              <div className="product-editor-field">
                <label>Sale MRP (incl. Tax)</label>
                <input
                  name="mrp"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.mrp}
                  onChange={handleChange}
                  placeholder="0.00"
                  style={{ fontWeight: 600, color: "#1e293b" }}
                />
                <span className="field-hint">Auto-computes sale price</span>
              </div>
            </div>
          </div>

          {/* Section 3: Stock & Inventory */}
          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>📊</span>
              <span>Stock & Inventory Levels</span>
            </div>

            <div className="product-editor-grid-2">
              <div className="product-editor-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Current Stock Quantity</label>
                  {formData.has_bulk && (
                    <select
                      style={{
                        padding: "2px 6px",
                        fontSize: "11px",
                        height: "24px",
                        width: "auto",
                        borderRadius: "4px",
                        borderColor: "#cbd5e1",
                      }}
                      value={stockInputType}
                      onChange={(e) => handleStockTypeChange(e.target.value)}
                    >
                      <option value="base">As Loose Units</option>
                      <option value="bulk">As Full Packages</option>
                    </select>
                  )}
                </div>
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

              <div className="product-editor-field">
                <label>Low Stock Warning Threshold</label>
                <input
                  name="minimum_stock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minimum_stock}
                  onChange={handleChange}
                  placeholder="5"
                />
                <span className="field-hint">Alerts when inventory drops below this number</span>
              </div>
            </div>
          </div>

          {/* Section 4: Bulk / Dual Packaging Settings */}
          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>📦</span>
              <span>Packaging & Unit Conversion</span>
            </div>

            <label className="bulk-toggle-card">
              <input
                type="checkbox"
                name="has_bulk"
                id="has_bulk_checkbox_edit"
                checked={formData.has_bulk}
                onChange={handleChange}
              />
              <div>
                <span>This item is sold in both Full Packages AND Loose Units</span>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  e.g., Wire or Pipes sold as whole Rolls/Bundles as well as per Meter/Piece
                </div>
              </div>
            </label>

            {formData.has_bulk && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "6px" }}>
                <div className="product-editor-grid-2">
                  <div className="product-editor-field">
                    <label>Full Package Name</label>
                    <input
                      name="bulk_unit"
                      type="text"
                      value={formData.bulk_unit}
                      onChange={handleChange}
                      placeholder="e.g. Roll, Box, Bundle"
                    />
                  </div>
                  <div className="product-editor-field">
                    <label>Units inside 1 Full Package</label>
                    <input
                      name="bulk_conversion_rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.bulk_conversion_rate}
                      onChange={handleChange}
                      placeholder="e.g. 30 (Meters per Roll)"
                    />
                  </div>
                </div>

                <div className="product-editor-grid-3">
                  <div className="product-editor-field">
                    <label>Package Purchase Price</label>
                    <input
                      name="bulk_purchase_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.bulk_purchase_price}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="product-editor-field">
                    <label>Package Sale Price (-tax)</label>
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
                  <div className="product-editor-field">
                    <label>Package Sale MRP (incl. Tax)</label>
                    <input
                      name="bulk_mrp"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.bulk_mrp}
                      onChange={handleChange}
                      placeholder="0.00"
                      style={{ fontWeight: 600, color: "#1e293b" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="modal-actions" style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0" }}>
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
