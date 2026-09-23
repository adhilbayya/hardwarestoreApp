import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDatabase() {
  if (!db) {
    db = await Database.load("sqlite:hardware_store.db");
  }

  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}
