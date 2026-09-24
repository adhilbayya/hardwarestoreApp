import { getDatabase } from "./db";

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  state_name: string | null;
  state_code: string | null;
  created_at: string;
  updated_at: string;
};

export async function getCustomers(): Promise<Customer[]> {
  const db = await getDatabase();

  return await db.select<Customer[]>(
    `
    SELECT
      id,
      name,
      phone,
      address,
      gstin,
      state_name,
      state_code,
      created_at,
      updated_at
    FROM customers
    ORDER BY name ASC
    `,
  );
}

export async function createCustomer(customer: {
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  state_name?: string | null;
  state_code?: string | null;
}) {
  const db = await getDatabase();

  await db.execute(
    `
    INSERT INTO customers (
      name,
      phone,
      address,
      gstin,
      state_name,
      state_code
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      customer.name.trim(),
      customer.phone ? customer.phone.trim() : null,
      customer.address ? customer.address.trim() : null,
      customer.gstin ? customer.gstin.trim() : null,
      customer.state_name ? customer.state_name.trim() : null,
      customer.state_code ? customer.state_code.trim() : null,
    ],
  );
}

export async function updateCustomer(
  id: number,
  customer: {
    name: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
    state_name?: string | null;
    state_code?: string | null;
  },
) {
  const db = await getDatabase();

  await db.execute(
    `
    UPDATE customers
    SET
      name = ?,
      phone = ?,
      address = ?,
      gstin = ?,
      state_name = ?,
      state_code = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [
      customer.name.trim(),
      customer.phone ? customer.phone.trim() : null,
      customer.address ? customer.address.trim() : null,
      customer.gstin ? customer.gstin.trim() : null,
      customer.state_name ? customer.state_name.trim() : null,
      customer.state_code ? customer.state_code.trim() : null,
      id,
    ],
  );
}

export async function getCustomerByPhone(
  phone: string,
): Promise<Customer | null> {
  const db = await getDatabase();

  const customers = await db.select<Customer[]>(
    `
    SELECT
      id,
      name,
      phone,
      address,
      gstin,
      state_name,
      state_code,
      created_at,
      updated_at
    FROM customers
    WHERE phone = ?
    LIMIT 1
    `,
    [phone.trim()],
  );

  return customers[0] ?? null;
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const db = await getDatabase();

  const customers = await db.select<Customer[]>(
    `
    SELECT
      id,
      name,
      phone,
      address,
      gstin,
      state_name,
      state_code,
      created_at,
      updated_at
    FROM customers
    WHERE id = ?
    LIMIT 1
    `,
    [id],
  );

  return customers[0] ?? null;
}
