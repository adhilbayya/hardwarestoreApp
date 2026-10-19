import { useEffect, useState } from "react";
import { createProduct, type Product } from "../../database/product";
import { getUnits, type Unit } from "../../database/unit";

type AddProductModalProps = {
  onClose: () => void;
  onProductAdded: () => void;
  existingProducts: Product[];
};

function AddProductModal({
  onClose,
  onProductAdded,
  existingProducts,
}: AddProductModalProps) {
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
    bulk_mrp: "",
    bulk_purchase_price: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stockInputType, setStockInputType] = useState("base");
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

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

        stock_quantity: finalStock,
        minimum_stock: Number(formData.minimum_stock) || 0,

        has_bulk: formData.has_bulk ? 1 : 0,
        bulk_unit: formData.bulk_unit.trim() || null,
        bulk_conversion_rate: Number(formData.bulk_conversion_rate) || null,
        bulk_price: Number(formData.bulk_price) || null,
      });

      onProductAdded();
      onClose();
    } catch (error: any) {
      console.error("Failed to save product:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("UNIQUE constraint failed: products.barcode")) {
        setError("A product with this Barcode already exists.");
      } else {
        setError(`Failed to save product: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const matchingSuggestions =
    formData.name.trim().length > 1
      ? existingProducts
          .filter(
            (p) =>
              p.name
                .toLowerCase()
                .includes(formData.name.trim().toLowerCase()) &&
              p.name.toLowerCase() !== formData.name.trim().toLowerCase(),
          )
          .slice(0, 8)
      : [];

  const exactDuplicate = existingProducts.some(
    (p) => p.name.toLowerCase() === formData.name.trim().toLowerCase(),
  );

  return (
    <div className="modal-overlay">
      <div className="modal product-editor-modal">
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3>Add New Product</h3>
            <p>Register product details, pricing, GST rates, and packaging.</p>
          </div>

          <button className="modal-close" onClick={onClose} disabled={saving} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body with Section Cards */}
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

            {/* Product Name with Suggestions */}
            <div className="product-editor-field">
              <label>
                Product Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  handleChange(e);
                  setShowNameSuggestions(true);
                }}
                onFocus={() => setShowNameSuggestions(true)}
                onBlur={() =>
                  setTimeout(() => setShowNameSuggestions(false), 200)
                }
                placeholder="e.g. PVC Pipe 1 inch, Brass Valve"
                autoComplete="off"
              />

              {showNameSuggestions && matchingSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 2px)",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    maxHeight: "180px",
                    overflowY: "auto",
                    zIndex: 20,
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#64748b",
                      background: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    Similar Existing Products:
                  </div>
                  {matchingSuggestions.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                        fontSize: "13px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, name: p.name }));
                        setShowNameSuggestions(false);
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f1f5f9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        ₹{p.mrp?.toFixed(2) || p.selling_price?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {exactDuplicate && (
                <span
                  style={{
                    color: "#d97706",
                    fontSize: "11px",
                    marginTop: "2px",
                    display: "block",
                    fontWeight: 500,
                  }}
                >
                  ⚠️ Note: A product with this exact name already exists in inventory.
                </span>
              )}
            </div>

            <div className="product-editor-grid-3">
              {/* Brand */}
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

              {/* HSN/SAC */}
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

              {/* Unit */}
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
              {/* Tax Rate */}
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

              {/* Purchase Price */}
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

              {/* Sale Price (Net) */}
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

              {/* Retail MRP */}
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

          {/* Section 3: Stock & Inventory Thresholds */}
          <div className="product-editor-section">
            <div className="product-editor-section-title">
              <span>📊</span>
              <span>Stock & Inventory Levels</span>
            </div>

            <div className="product-editor-grid-2">
              {/* Current Stock */}
              <div className="product-editor-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Initial Opening Stock</label>
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
                      onChange={(e) => setStockInputType(e.target.value)}
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

              {/* Minimum Stock */}
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
                id="has_bulk_checkbox"
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
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddProductModal;
