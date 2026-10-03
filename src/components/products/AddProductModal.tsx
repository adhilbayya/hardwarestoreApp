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
            <div className="form-group" style={{ position: "relative" }}>
              <label>Product Name</label>
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
                placeholder="e.g. PVC Pipe 1 inch"
              />

              {showNameSuggestions &&
                formData.name.trim().length > 1 &&
                existingProducts.some(
                  (p) =>
                    p.name
                      .toLowerCase()
                      .includes(formData.name.trim().toLowerCase()) &&
                    p.name.toLowerCase() !== formData.name.trim().toLowerCase(),
                ) && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% - 4px)",
                      left: 0,
                      right: 0,
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "0 0 4px 4px",
                      maxHeight: "150px",
                      overflowY: "auto",
                      zIndex: 10,
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  >
                    {existingProducts
                      .filter(
                        (p) =>
                          p.name
                            .toLowerCase()
                            .includes(formData.name.trim().toLowerCase()) &&
                          p.name.toLowerCase() !==
                            formData.name.trim().toLowerCase(),
                      )
                      .slice(0, 10)
                      .map((p) => (
                        <div
                          key={p.id}
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid #eee",
                            fontSize: "13px",
                          }}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, name: p.name }));
                            setShowNameSuggestions(false);
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#f3f4f6")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          {p.name}
                        </div>
                      ))}
                  </div>
                )}

              {existingProducts.some(
                (p) =>
                  p.name.toLowerCase() === formData.name.trim().toLowerCase(),
              ) && (
                <small
                  style={{
                    color: "#d97706",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  ⚠️ A product with this exact name already exists in your main
                  inventory.
                </small>
              )}
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

            {/* Unit */}
            <div className="form-group">
              <label>
                {formData.has_bulk
                  ? "Loose Unit (e.g. Meter, Piece)"
                  : "Unit (e.g. Meter, Piece)"}
              </label>
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
              <label>
                {formData.has_bulk
                  ? "Loose Unit Purchase Price"
                  : "Purchase Price"}
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

            {/* Retail */}
            <div className="form-group">
              <label>
                {formData.has_bulk
                  ? "Loose Unit Sale price (-tax)"
                  : "Sale price (-tax)"}
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

            {/* MRP */}
            <div className="form-group">
              <label>
                {formData.has_bulk ? "Loose Unit Sale Price" : "Sale Price"}
              </label>
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
              <label>
                Current Stock
                {formData.has_bulk && (
                  <select
                    style={{
                      marginLeft: "10px",
                      padding: "2px",
                      fontSize: "11px",
                    }}
                    value={stockInputType}
                    onChange={(e) => setStockInputType(e.target.value)}
                  >
                    <option value="base">As Loose Units</option>
                    <option value="bulk">As Full Packages</option>
                  </select>
                )}
              </label>
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
                This item is sold in both Full Packages AND Loose Units
              </label>
            </div>

            {formData.has_bulk && (
              <>
                <div className="form-group">
                  <label>Full Package Name (e.g. Roll, Box)</label>
                  <input
                    name="bulk_unit"
                    type="text"
                    value={formData.bulk_unit}
                    onChange={handleChange}
                    placeholder="e.g. Bundle"
                  />
                </div>
                <div className="form-group">
                  <label>How many Loose Units are inside 1 Full Package?</label>
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
                  <label>Full Package Purchase Price</label>
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
                <div className="form-group">
                  <label>Full Package Sale price (-tax)</label>
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
                <div className="form-group">
                  <label>Full Package Sale Price</label>
                  <input
                    name="bulk_mrp"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.bulk_mrp}
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
