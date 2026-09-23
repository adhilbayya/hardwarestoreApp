import { save } from "@tauri-apps/plugin-dialog";
import { getDatabase, closeDatabase } from "./db";
import { open } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  copyFile,
  readDir,
  remove,
} from "@tauri-apps/plugin-fs";

export async function backupDatabase(): Promise<boolean> {
  try {
    const db = await getDatabase();

    // Make sure pending SQLite changes are written.
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");

    const now = new Date();

    const timestamp = now
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);

    const defaultFileName = `hardware_store_backup_${timestamp}.db`;

    // Ask the user where to save the backup.
    const destination = await save({
      defaultPath: defaultFileName,
      filters: [
        {
          name: "SQLite Database",
          extensions: ["db"],
        },
      ],
    });

    // User cancelled the dialog.
    if (!destination) {
      return false;
    }

    // Close the database before copying it.
    await closeDatabase();

    // hardware_store.db is stored in the SQL plugin's app config area.
    await copyFile("hardware_store.db", destination, {
      fromPathBaseDir: BaseDirectory.AppConfig,
    });

    // Reconnect the database after backup.
    await getDatabase();

    return true;
  } catch (error) {
    console.error("Database backup failed:", error);

    // Make sure the database is available again.
    try {
      await getDatabase();
    } catch (reconnectError) {
      console.error("Failed to reconnect database:", reconnectError);
    }

    throw error;
  }
}

async function createSafetyBackup(): Promise<void> {
  const db = await getDatabase();

  // Make sure pending SQLite changes are written.
  await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");

  const now = new Date();

  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  const safetyFileName = `hardware_store_before_restore_${timestamp}.db`;

  // Close database before copying it.
  await closeDatabase();

  await copyFile("hardware_store.db", safetyFileName, {
    fromPathBaseDir: BaseDirectory.AppConfig,
    toPathBaseDir: BaseDirectory.AppConfig,
  });

  // Reconnect after creating safety backup.
  await getDatabase();
}

export async function restoreDatabase(): Promise<boolean> {
  try {
    // Ask the user to select a backup file
    const source = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "SQLite Database",
          extensions: ["db"],
        },
      ],
    });

    // User cancelled
    if (!source || Array.isArray(source)) {
      return false;
    }
    await createSafetyBackup();

    // Replace the current database with the selected backup
    await copyFile(source, "hardware_store.db", {
      toPathBaseDir: BaseDirectory.AppConfig,
    });

    // Reconnect to restored database
    await getDatabase();

    return true;
  } catch (error) {
    console.error("Database restore failed:", error);

    // Try to reconnect
    try {
      await getDatabase();
    } catch (reconnectError) {
      console.error("Failed to reconnect database:", reconnectError);
    }

    throw error;
  }
}

export async function weeklyAutoBackup(): Promise<void> {
  try {
    const db = await getDatabase();

    // Get the date of the most recent automatic backup.
    const backups = await db.select<{ value: string | null }[]>(
      `
      SELECT value
      FROM app_settings
      WHERE key = 'last_auto_backup'
      `,
    );

    const lastBackup = backups[0]?.value;

    const now = new Date();

    if (lastBackup) {
      const lastBackupDate = new Date(lastBackup);
      const difference = now.getTime() - lastBackupDate.getTime();

      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      // Backup is still recent.
      if (difference < sevenDays) {
        return;
      }
    }

    // Make sure SQLite changes are written.
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");

    const timestamp = now
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);

    const backupFileName = `hardware_store_auto_${timestamp}.db`;

    // Close before copying.
    await closeDatabase();

    await copyFile("hardware_store.db", backupFileName, {
      fromPathBaseDir: BaseDirectory.AppConfig,
      toPathBaseDir: BaseDirectory.AppConfig,
    });

    // Reconnect.
    const restoredDb = await getDatabase();

    // Remember when the automatic backup was created.
    await restoredDb.execute(
      `
      INSERT INTO app_settings (key, value)
      VALUES ('last_auto_backup', ?)
      ON CONFLICT(key)
      DO UPDATE SET value = excluded.value
      `,
      [now.toISOString()],
    );

    console.log("Weekly automatic backup created:", backupFileName);
    await cleanupAutomaticBackups();
  } catch (error) {
    console.error("Weekly automatic backup failed:", error);
  }
}

export async function getAutomaticBackups(): Promise<
  { name: string; modifiedAt?: number }[]
> {
  const entries = await readDir(".", {
    baseDir: BaseDirectory.AppConfig,
  });

  return entries
    .filter(
      (entry) =>
        entry.isFile &&
        entry.name.startsWith("hardware_store_auto_") &&
        entry.name.endsWith(".db"),
    )
    .map((entry) => ({
      name: entry.name,
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

export async function cleanupAutomaticBackups(): Promise<void> {
  const entries = await readDir(".", {
    baseDir: BaseDirectory.AppConfig,
  });

  const backups = entries
    .filter(
      (entry) =>
        entry.isFile &&
        entry.name.startsWith("hardware_store_auto_") &&
        entry.name.endsWith(".db"),
    )
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  const backupsToDelete = backups.slice(8);

  for (const backupName of backupsToDelete) {
    try {
      await remove(backupName, {
        baseDir: BaseDirectory.AppConfig,
      });

      console.log("Deleted old automatic backup:", backupName);
    } catch (error) {
      console.error(`Failed to delete old backup ${backupName}:`, error);
    }
  }
}
