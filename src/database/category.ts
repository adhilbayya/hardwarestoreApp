import { getDatabase } from "./db";

export type Category = {
  id: number;
  name: string;
};

export async function getCategories(): Promise<Category[]> {
  const db = await getDatabase();

  return await db.select<Category[]>(
    `
    SELECT id, name
    FROM categories
    ORDER BY name ASC
    `,
  );
}

export async function createCategory(name: string) {
  const db = await getDatabase();

  await db.execute(
    `
    INSERT INTO categories (name)
    VALUES (?)
    `,
    [name.trim()],
  );
}
