import { useEffect, useState } from "react";

import {
  createCategory,
  getCategories,
  type Category,
} from "../../database/category";

import { createUnit, getUnits, type Unit } from "../../database/unit";

function CategoryUnitSettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [categoryName, setCategoryName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitSymbol, setUnitSymbol] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [categoryData, unitData] = await Promise.all([
        getCategories(),
        getUnits(),
      ]);

      setCategories(categoryData);
      setUnits(unitData);
    } catch (error) {
      console.error("Failed to load settings data:", error);
      setError("Failed to load categories and units.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCategory() {
    const name = categoryName.trim();

    if (!name) {
      return;
    }

    try {
      setError("");

      await createCategory(name);

      setCategoryName("");

      await loadData();
    } catch (error) {
      console.error("Failed to create category:", error);
      setError("Could not add category. It may already exist.");
    }
  }

  async function handleAddUnit() {
    const name = unitName.trim();

    if (!name) {
      return;
    }

    try {
      setError("");

      await createUnit(name, unitSymbol.trim() || null);

      setUnitName("");
      setUnitSymbol("");

      await loadData();
    } catch (error) {
      console.error("Failed to create unit:", error);
      setError("Could not add unit. It may already exist.");
    }
  }

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div>
      <div className="welcome">
        <div>
          <h3>Categories & Units</h3>
          <p>Manage categories and units used by your products.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Categories */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Categories</h3>
            <p>Product categories used in your store.</p>
          </div>
        </div>

        <div className="settings-add-row">
          <input
            type="text"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="e.g. PVC"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleAddCategory();
              }
            }}
          />

          <button className="primary-button" onClick={handleAddCategory}>
            + Add Category
          </button>
        </div>

        <div className="simple-list">
          {categories.length === 0 ? (
            <p className="empty-message">No categories added yet.</p>
          ) : (
            categories.map((category) => (
              <div className="simple-list-item" key={category.id}>
                {category.name}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Units */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Units</h3>
            <p>Units used when measuring product quantities.</p>
          </div>
        </div>

        <div className="settings-add-row">
          <input
            type="text"
            value={unitName}
            onChange={(event) => setUnitName(event.target.value)}
            placeholder="e.g. Meter"
          />

          <input
            type="text"
            value={unitSymbol}
            onChange={(event) => setUnitSymbol(event.target.value)}
            placeholder="e.g. m"
          />

          <button className="primary-button" onClick={handleAddUnit}>
            + Add Unit
          </button>
        </div>

        <div className="simple-list">
          {units.length === 0 ? (
            <p className="empty-message">No units added yet.</p>
          ) : (
            units.map((unit) => (
              <div className="simple-list-item" key={unit.id}>
                <span>{unit.name}</span>

                {unit.symbol && (
                  <span className="unit-symbol">{unit.symbol}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoryUnitSettings;
