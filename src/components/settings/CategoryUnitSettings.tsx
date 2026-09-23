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

function CategoryUnitSettings() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitName, setUnitName] = useState("");
  const [unitSymbol, setUnitSymbol] = useState("");

  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);

  const [error, setError] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);

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
    } catch (error) {
      console.error("Failed to load settings data:", error);
      setError("Failed to load categories and units.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenBackupFolder() {
    try {
      const folder = await appConfigDir();
      await openPath(folder);
    } catch (error) {
      console.error("Failed to open backup folder:", error);

      const message = error instanceof Error ? error.message : String(error);

      setError(`Could not open backup folder: ${message}`);
    }
  }

  async function handleAddUnit() {
    const name = unitName.trim();

    if (!name) {
      return;
    }

    try {
      setError("");
      setBackupMessage("");

      await createUnit(name, unitSymbol.trim() || null);

      setUnitName("");
      setUnitSymbol("");

      await loadData();
    } catch (error) {
      console.error("Failed to create unit:", error);
      setError("Could not add unit. It may already exist.");
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
      ];

      for (const unit of popularUnits) {
        try {
          await createUnit(unit.name, unit.symbol);
        } catch (e) {
          // Ignore if it already exists
        }
      }

      await loadData();
    } catch (error) {
      console.error("Failed to load popular units:", error);
    }
  }

  async function handleDeleteUnit(id: number) {
    try {
      const isConfirmed = await confirm(
        "Are you sure you want to delete this unit?",
        { title: "Delete Unit", kind: "warning" },
      );
      if (!isConfirmed) return;

      await deleteUnit(id);
      await loadData();
    } catch (error) {
      console.error("Failed to delete unit:", error);
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
        setBackupMessage("Backup created successfully.");
      }
    } catch (error) {
      console.error("Backup failed:", error);

      const message = error instanceof Error ? error.message : String(error);

      setError(`Backup failed: ${message}`);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore() {
    const confirmed = await confirm(
      "Restore this backup?\n\nYour current database will be replaced by the selected backup.",
      { title: "Confirm Restore" },
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
          "Backup restored successfully. Please restart the app.",
        );
      }
    } catch (error) {
      console.error("Restore failed:", error);

      const message = error instanceof Error ? error.message : String(error);

      setError(`Restore failed: ${message}`);
    } finally {
      setRestoreLoading(false);
    }
  }

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="welcome">
        <div>
          <h3>Settings</h3>
          <p>Manage units and database backups.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {backupMessage && <div className="form-success">{backupMessage}</div>}

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

          <button className="secondary-button" onClick={handleLoadPopularUnits}>
            Load Popular Units
          </button>
        </div>

        <div className="simple-list">
          {units.length === 0 ? (
            <p className="empty-message">No units added yet.</p>
          ) : (
            units.map((unit) => (
              <div
                className="simple-list-item"
                key={unit.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span>{unit.name}</span>
                  {unit.symbol && (
                    <span className="unit-symbol" style={{ marginLeft: "4px" }}>
                      ({unit.symbol})
                    </span>
                  )}
                </div>
                <button
                  className="danger-button"
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    minHeight: "auto",
                    minWidth: "auto",
                    backgroundColor: "transparent",
                    color: "var(--danger)",
                  }}
                  onClick={() => handleDeleteUnit(unit.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Backup */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Database Backup</h3>
            <p>
              Create a backup of your products, customers, suppliers, sales and
              purchases.
            </p>
          </div>
        </div>

        <div className="settings-add-row">
          <button
            className="primary-button"
            onClick={handleBackup}
            disabled={backupLoading}
          >
            {backupLoading ? "Creating Backup..." : "Backup Now"}
          </button>
          <button
            className="secondary-button"
            onClick={handleRestore}
            disabled={restoreLoading}
          >
            {restoreLoading ? "Restoring Backup..." : "Restore Backup"}
          </button>
          <button className="secondary-button" onClick={handleOpenBackupFolder}>
            Open Backup Folder
          </button>
        </div>
        <div className="simple-list">
          <h4>Automatic Backups</h4>

          {automaticBackups.length === 0 ? (
            <p className="empty-message">No automatic backups yet.</p>
          ) : (
            automaticBackups.map((backup) => {
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
                <div className="simple-list-item" key={backup.name}>
                  <span>{displayDate}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoryUnitSettings;
