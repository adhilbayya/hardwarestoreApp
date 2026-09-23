import { getDatabase } from "./db";

export type Unit = {
  id: number;
  name: string;
  symbol: string | null;
};

export async function getUnits(): Promise<Unit[]> {
  const db = await getDatabase();

  return await db.select<Unit[]>(
    `
    SELECT id, name, symbol
    FROM units
    ORDER BY name ASC
    `,
  );
}

export async function createUnit(name: string, symbol?: string | null) {
  const db = await getDatabase();

  await db.execute(
    `
    INSERT INTO units (name, symbol)
    VALUES (?, ?)
    `,
    [name.trim(), symbol?.trim() || null],
  );
}

export async function deleteUnit(id: number) {
  const db = await getDatabase();
  await db.execute(`DELETE FROM units WHERE id = ?`, [id]);
}
