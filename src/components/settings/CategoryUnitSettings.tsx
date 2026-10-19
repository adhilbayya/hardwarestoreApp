import { useEffect, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { appConfigDir } from "@tauri-apps/api/path";

import {
  createUnit,
  getUnits,
  deleteUnit,
  type Unit,
} from "../../database/unit";

import {
  backupDatabase,
  restoreDatabase,
  getAutomaticBackups,
} from "../../database/backup";

type SettingsTab = "units" | "backup" | "store";

function CategoryUnitSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("units");

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitSymbol, setUnitSymbol] = useState("");

  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const [error, setError] = useState("");
  const [backupMessage, setBackupMessage] = useState("");

  const [automaticBackups, setAutomaticBackups] = useState<
    { name: string; modifiedAt?: number }[]
  >([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [unitData, automaticBackupData] = await Promise.all([
        getUnits(),
        getAutomaticBackups(),
      ]);

      setUnits(unitData);
      setAutomaticBackups(automaticBackupData);
    } catch (err) {
      console.error("Failed to load settings data:", err);
      setError("Failed to load units or backup snapshots.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenBackupFolder() {
    try {
      const folder = await appConfigDir();
      await openPath(folder);
    } catch (err) {
      console.error("Failed to open backup folder:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Could not open backup folder: ${message}`);
    }
  }

  async function handleAddUnit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const name = unitName.trim();

    if (!name) {
      setError("Please provide a unit name (e.g. Meter, Pieces).");
      return;
    }

    try {
      setError("");
      setBackupMessage("");

      await createUnit(name, unitSymbol.trim() || null);

      setUnitName("");
      setUnitSymbol("");
      setBackupMessage(`Unit "${name}" added successfully.`);

      await loadData();
    } catch (err) {
      console.error("Failed to create unit:", err);
      setError("Could not add unit. It may already exist in your directory.");
    }
  }

  async function handleLoadPopularUnits() {
    try {
      setError("");
      setBackupMessage("");

      const popularUnits = [
        { name: "Numbers", symbol: "Nos" },
        { name: "Pieces", symbol: "Pcs" },
        { name: "Meter", symbol: "Mtr" },
        { name: "Feet", symbol: "Ft" },
        { name: "Inch", symbol: "In" },
        { name: "Box", symbol: "Box" },
        { name: "Set", symbol: "Set" },
        { name: "Roll", symbol: "Roll" },
        { name: "Bundle", symbol: "Bndl" },
        { name: "Packet", symbol: "Pkt" },
        { name: "Kilogram", symbol: "Kg" },
        { name: "Litre", symbol: "Ltr" },
      ];

      let addedCount = 0;
      for (const unit of popularUnits) {
        try {
          await createUnit(unit.name, unit.symbol);
          addedCount++;
        } catch {
          // Already exists, ignore
        }
      }

      await loadData();
      setBackupMessage(
        addedCount > 0
          ? `Added ${addedCount} standard hardware units.`
          : "All standard units are already configured.",
      );
    } catch (err) {
      console.error("Failed to load popular units:", err);
      setError("Failed to load popular unit presets.");
    }
  }

  async function handleDeleteUnit(unit: Unit) {
    try {
      const isConfirmed = await confirm(
        `Are you sure you want to delete unit "${unit.name}"? Products currently using this unit will retain it as text.`,
        { title: "Delete Unit", kind: "warning" },
      );
      if (!isConfirmed) return;

      await deleteUnit(unit.id);
      await loadData();
      setBackupMessage(`Unit "${unit.name}" was removed.`);
    } catch (err) {
      console.error("Failed to delete unit:", err);
      setError("Could not delete unit.");
    }
  }

  async function handleBackup() {
    try {
      setBackupLoading(true);
      setError("");
      setBackupMessage("");

      const result = await backupDatabase();

      if (result) {
        setBackupMessage("Database backup file saved successfully.");
        await loadData();
      }
    } catch (err) {
      console.error("Backup failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Backup failed: ${message}`);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore() {
    const confirmed = await confirm(
      "Restore backup file?\n\nWarning: Your current active store database will be replaced by the selected backup file. A safety copy of your current database will be saved before restore.",
      { title: "Confirm Database Restore", kind: "warning" },
    );

    if (!confirmed) {
      return;
    }

    try {
      setRestoreLoading(true);
      setError("");
      setBackupMessage("");

      const result = await restoreDatabase();

      if (result) {
        setBackupMessage(
          "Backup restored successfully! Please restart the app to refresh all data cache.",
        );
      }
    } catch (err) {
      console.error("Restore failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Restore failed: ${message}`);
    } finally {
      setRestoreLoading(false);
    }
  }

  const filteredUnits = units.filter(
    (u) =>
      u.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
      (u.symbol && u.symbol.toLowerCase().includes(unitSearch.toLowerCase())),
  );

  if (loading) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="settings-page-container">
      {/* Header */}
      <div className="settings-header-row">
        <div>
          <h3>System Settings</h3>
          <p>
            Configure inventory units of measurement, system backups, and view business parameters.
          </p>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="settings-alert-banner settings-alert-error">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {backupMessage && (
        <div className="settings-alert-banner settings-alert-success">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✓</span>
            <span>{backupMessage}</span>
          </div>
          <button
            onClick={() => setBackupMessage("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Nav Tabs */}
      <div className="settings-tabs-bar">
        <button
          className={`settings-tab-btn ${activeTab === "units" ? "active" : ""}`}
          onClick={() => setActiveTab("units")}
        >
          <span>📏 Units of Measurement</span>
          <span className="settings-tab-badge">{units.length}</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === "backup" ? "active" : ""}`}
          onClick={() => setActiveTab("backup")}
        >
          <span>💾 Database Backup & Recovery</span>
          <span className="settings-tab-badge">{automaticBackups.length}</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === "store" ? "active" : ""}`}
          onClick={() => setActiveTab("store")}
        >
          <span>🏢 Store Profile & GSTIN</span>
        </button>
      </div>

      {/* TAB 1: UNITS OF MEASUREMENT */}
      {activeTab === "units" && (
        <div className="settings-panel-card">
          <div className="settings-panel-header">
            <div className="settings-panel-header-left">
              <div className="settings-panel-header-icon stat-icon-blue">
                📏
              </div>
              <div className="settings-panel-header-text">
                <h4>Unit Directory</h4>
                <p>Define product measurement units used in inventory and billing (e.g. Nos, Mtr, Box, Pkt).</p>
              </div>
            </div>

            <button
              className="secondary-button"
              onClick={handleLoadPopularUnits}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              ⚡ Load Common Hardware Units
            </button>
          </div>

          <div className="settings-panel-body">
            {/* Create New Unit Form */}
            <form onSubmit={handleAddUnit} className="settings-form-bar">
              <div className="settings-form-field" style={{ flex: "2", minWidth: "160px" }}>
                <label className="settings-form-label">Unit Full Name *</label>
                <input
                  type="text"
                  className="settings-form-input"
                  placeholder="e.g. Meter, Bundle, Kilogram"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                />
              </div>

              <div className="settings-form-field" style={{ flex: "1", minWidth: "100px" }}>
                <label className="settings-form-label">Symbol / Short Code</label>
                <input
                  type="text"
                  className="settings-form-input"
                  placeholder="e.g. m, Bndl, Kg"
                  value={unitSymbol}
                  onChange={(e) => setUnitSymbol(e.target.value)}
                />
              </div>

              <div style={{ alignSelf: "flex-end" }}>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ height: "38px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  + Add Unit
                </button>
              </div>
            </form>

            {/* Inset Search Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Configured Units ({filteredUnits.length})
              </span>

              <div className="suppliers-search-box" style={{ minWidth: "220px" }}>
                <span className="suppliers-search-icon">🔍</span>
                <input
                  type="text"
                  className="suppliers-search-input"
                  placeholder="Filter units..."
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                />
                {unitSearch && (
                  <button
                    className="suppliers-search-clear"
                    onClick={() => setUnitSearch("")}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Units Inset Table */}
            {filteredUnits.length === 0 ? (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#94a3b8",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px dashed #cbd5e1",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>📏</div>
                <div style={{ fontWeight: 600, color: "#475569" }}>
                  {unitSearch ? "No matching units found" : "No measurement units added yet"}
                </div>
                <div style={{ fontSize: "12px", marginTop: "2px" }}>
                  {unitSearch
                    ? "Try searching for a different unit name or symbol."
                    : 'Use the form above or click "Load Common Hardware Units" to get started.'}
                </div>
              </div>
            ) : (
              <div className="settings-units-table-container">
                <table className="settings-units-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45%" }}>Unit Name</th>
                      <th style={{ width: "35%" }}>Symbol / Display Code</th>
                      <th style={{ width: "20%", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((unit) => (
                      <tr key={unit.id}>
                        <td>
                          <strong style={{ color: "#0f172a", fontSize: "14px" }}>
                            {unit.name}
                          </strong>
                        </td>
                        <td>
                          {unit.symbol ? (
                            <span className="unit-symbol-chip">
                              {unit.symbol}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="secondary-button"
                            style={{
                              color: "#ef4444",
                              borderColor: "#fecaca",
                              padding: "4px 10px",
                              fontSize: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            onClick={() => handleDeleteUnit(unit)}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BACKUP & RECOVERY */}
      {activeTab === "backup" && (
        <div className="settings-panel-card">
          <div className="settings-panel-header">
            <div className="settings-panel-header-left">
              <div className="settings-panel-header-icon stat-icon-emerald">
                💾
              </div>
              <div className="settings-panel-header-text">
                <h4>Database Backup & Recovery</h4>
                <p>Save copies of your database to an external drive or restore previously saved copies safely.</p>
              </div>
            </div>

            <button
              className="secondary-button"
              onClick={handleOpenBackupFolder}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              📁 Open App Data Folder
            </button>
          </div>

          <div className="settings-panel-body">
            {/* Feature Action Cards */}
            <div className="settings-backup-feature-grid">
              <div className="settings-backup-card-action">
                <div>
                  <div className="settings-backup-card-title">
                    <span>💾</span>
                    <span>Create Database Backup</span>
                  </div>
                  <p className="settings-backup-card-desc">
                    Generates a timestamped `.db` snapshot of all products, sales, purchases, invoices, and customers to any folder or USB drive.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={handleBackup}
                  disabled={backupLoading}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {backupLoading ? "Creating Backup..." : "Save Backup Now"}
                </button>
              </div>

              <div className="settings-backup-card-action">
                <div>
                  <div className="settings-backup-card-title">
                    <span>🔄</span>
                    <span>Restore From Backup</span>
                  </div>
                  <p className="settings-backup-card-desc">
                    Replace the current store database with a previous `.db` file. An automatic safety snapshot of your current database will be taken first.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={handleRestore}
                  disabled={restoreLoading}
                  style={{ width: "100%", justifyContent: "center", borderColor: "#f59e0b", color: "#d97706" }}
                >
                  {restoreLoading ? "Restoring..." : "Select File to Restore"}
                </button>
              </div>

              <div className="settings-backup-card-action">
                <div>
                  <div className="settings-backup-card-title">
                    <span>📂</span>
                    <span>System Backup Directory</span>
                  </div>
                  <p className="settings-backup-card-desc">
                    Direct access to the internal storage folder where SQLite databases and automated rolling safety archives are stored on disk.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={handleOpenBackupFolder}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Open in File Explorer
                </button>
              </div>
            </div>

            {/* Automatic Snapshots History */}
            <div style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Automated Snapshots ({automaticBackups.length})
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Automated rolling snapshots generated on app launch
                </span>
              </div>

              {automaticBackups.length === 0 ? (
                <div
                  style={{
                    padding: "30px 16px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "13px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px dashed #cbd5e1",
                  }}
                >
                  No automated snapshots recorded yet. Snapshots will appear here as the app runs.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {automaticBackups.map((backup) => {
                    const match = backup.name.match(
                      /^hardware_store_auto_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.db$/,
                    );

                    let displayDate = backup.name;

                    if (match) {
                      const [, year, month, day, hour, minute, second] = match;
                      const date = new Date(
                        `${year}-${month}-${day}T${hour}:${minute}:${second}`,
                      );

                      if (!Number.isNaN(date.getTime())) {
                        displayDate = date.toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        });
                      }
                    }

                    return (
                      <div className="settings-snapshot-row" key={backup.name}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "16px", color: "#0284c7" }}>🗄️</span>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "13px" }}>
                              {displayDate}
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>
                              {backup.name}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "11px",
                            fontFamily: "monospace",
                            color: "#166534",
                            background: "#dcfce7",
                            border: "1px solid #bbf7d0",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
                          Auto Snapshot
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STORE PROFILE & GSTIN */}
      {activeTab === "store" && (
        <div className="settings-panel-card">
          <div className="settings-panel-header">
            <div className="settings-panel-header-left">
              <div className="settings-panel-header-icon stat-icon-purple">
                🏢
              </div>
              <div className="settings-panel-header-text">
                <h4>Store Profile & Tax Identifiers</h4>
                <p>Configured business details printed on customer invoices and purchase order records.</p>
              </div>
            </div>
          </div>

          <div className="settings-panel-body">
            <div className="settings-store-grid">
              <div className="settings-store-field-card">
                <span className="settings-store-field-label">Business Name</span>
                <span className="settings-store-field-val">NILGIRI PUMPS AND FITTINGS</span>
              </div>

              <div className="settings-store-field-card">
                <span className="settings-store-field-label">GSTIN / UIN</span>
                <span className="settings-store-field-val" style={{ fontFamily: "monospace", color: "#0284c7" }}>
                  33BHFPM8521H1ZE
                </span>
              </div>

              <div className="settings-store-field-card">
                <span className="settings-store-field-label">Store Address</span>
                <span className="settings-store-field-val">
                  11/339A3, Calicut Road, Gudalur, Nilgiris, Tamilnadu - 643212
                </span>
              </div>

              <div className="settings-store-field-card">
                <span className="settings-store-field-label">Contact Numbers</span>
                <span className="settings-store-field-val" style={{ fontFamily: "monospace" }}>
                  8592884441, 9486938207
                </span>
              </div>

              <div className="settings-store-field-card">
                <span className="settings-store-field-label">Official Email</span>
                <span className="settings-store-field-val">nilgiripumpsandfittings@gmail.com</span>
              </div>

              <div className="settings-store-field-card">
                <span className="settings-store-field-label">Jurisdiction & Terms</span>
                <span className="settings-store-field-val">
                  Subject to Nilgiris Jurisdiction • 7 Days Return Policy
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: "10px",
                padding: "14px 18px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "#166534",
              }}
            >
              <span>ℹ️</span>
              <span>
                These details are standardized across your printed GST Invoices, Delivery Challans, and Purchase Orders.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryUnitSettings;
