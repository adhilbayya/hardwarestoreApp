import { getDatabase } from "./db";

export type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
};

export async function getSuppliers(): Promise<Supplier[]> {
  const db = await getDatabase();

  return await db.select<Supplier[]>(
    `
    SELECT
      id,
      name,
      phone,
      address,
      gstin,
      created_at,
      updated_at
    FROM suppliers
    ORDER BY name ASC
    `,
  );
}

export async function createSupplier(supplier: {
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
}) {
  const db = await getDatabase();

  await db.execute(
    `
    INSERT INTO suppliers (
      name,
      phone,
      address,
      gstin
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      supplier.name.trim(),
      supplier.phone?.trim() || null,
      supplier.address?.trim() || null,
      supplier.gstin?.trim() || null,
    ],
  );
}

export async function updateSupplier(
  id: number,
  supplier: {
    name: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  },
) {
  const db = await getDatabase();

  await db.execute(
    `
    UPDATE suppliers
    SET
      name = ?,
      phone = ?,
      address = ?,
      gstin = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [
      supplier.name.trim(),
      supplier.phone?.trim() || null,
      supplier.address?.trim() || null,
      supplier.gstin?.trim() || null,
      id,
    ],
  );
}

export async function getSupplierByPhone(
  phone: string,
): Promise<Supplier | null> {
  const db = await getDatabase();

  const suppliers = await db.select<Supplier[]>(
    `
    SELECT
      id,
      name,
      phone,
      address,
      gstin,
      created_at,
      updated_at
    FROM suppliers
    WHERE phone = ?
    LIMIT 1
    `,
    [phone.trim()],
  );

  return suppliers[0] ?? null;
}

export async function getSupplierById(id: number): Promise<Supplier | null> {
  const db = await getDatabase();

  const suppliers = await db.select<Supplier[]>(
    `
    SELECT
      id,
      name,
      phone,
      address,
      gstin,
      created_at,
      updated_at
    FROM suppliers
    WHERE id = ?
    LIMIT 1
    `,
    [id],
  );

  return suppliers[0] ?? null;
}
