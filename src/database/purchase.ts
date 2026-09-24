import { getDatabase } from "./db";

export type PurchaseItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
};

export type Purchase = {
  id: number;
  purchase_number: string;
  supplier_id: number | null;
  purchase_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
};

export type CreatePurchaseData = {
  supplier_id?: number | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  payment_method: string;
  notes?: string | null;
  items: PurchaseItem[];
};

export async function getNextPurchaseNumber(): Promise<string> {
  const db = await getDatabase();

  const result = await db.select<{ max_number: number | null }[]>(
    `
    SELECT MAX(
      CAST(SUBSTR(purchase_number, 5) AS INTEGER)
    ) AS max_number
    FROM purchases
    WHERE purchase_number LIKE 'PUR-%'
    `,
  );

  const maxNumber = result[0]?.max_number ?? 0;

  return `PUR-${String(maxNumber + 1).padStart(6, "0")}`;
}

export async function createPurchase(
  purchase: CreatePurchaseData,
): Promise<{ purchaseNumber: string; purchaseId: number }> {
  const db = await getDatabase();

  const purchaseNumber = await getNextPurchaseNumber();

  // --------------------------------------------------
  // Validate purchase
  // --------------------------------------------------

  if (purchase.items.length === 0) {
    throw new Error("Purchase must contain at least one item.");
  }

  const productIds = new Set<number>();

  for (const item of purchase.items) {
    if (item.quantity <= 0) {
      throw new Error(`Invalid quantity for: ${item.product_name}`);
    }

    if (item.unit_price < 0) {
      throw new Error(`Invalid price for: ${item.product_name}`);
    }

    if (productIds.has(item.product_id)) {
      throw new Error(`Duplicate product in purchase: ${item.product_name}`);
    }

    productIds.add(item.product_id);
  }

  // --------------------------------------------------
  // Check that every product exists and is active
  // BEFORE writing anything.
  // --------------------------------------------------

  for (const item of purchase.items) {
    const products = await db.select<
      {
        stock_quantity: number;
      }[]
    >(
      `
      SELECT stock_quantity
      FROM products
      WHERE id = ?
        AND is_active = 1
      `,
      [item.product_id],
    );

    if (!products.length) {
      throw new Error(`Product not found: ${item.product_name}`);
    }
  }

  try {
    // --------------------------------------------------
    // Create purchase
    // --------------------------------------------------

    const purchaseResult = await db.execute(
      `
      INSERT INTO purchases (
        purchase_number,
        supplier_id,
        subtotal,
        tax_amount,
        discount_amount,
        grand_total,
        payment_method,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        purchaseNumber,
        purchase.supplier_id ?? null,
        purchase.subtotal,
        purchase.tax_amount,
        purchase.discount_amount,
        purchase.grand_total,
        purchase.payment_method,
        purchase.notes ?? null,
      ],
    );

    const purchaseId = purchaseResult.lastInsertId;

    if (!purchaseId) {
      throw new Error("Failed to create purchase.");
    }

    // --------------------------------------------------
    // Add purchase items and update stock
    // --------------------------------------------------

    for (const item of purchase.items) {
      // Save purchase item
      await db.execute(
        `
        INSERT INTO purchase_items (
          purchase_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          tax_rate,
          tax_amount,
          discount_amount,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          purchaseId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.tax_rate,
          item.tax_amount,
          item.discount_amount,
          item.line_total,
        ],
      );

      // Get current stock and average cost
      const productRows = await db.select<
        {
          stock_quantity: number;
          average_cost: number;
        }[]
      >(
        `
        SELECT
          stock_quantity,
          average_cost
        FROM products
        WHERE id = ?
          AND is_active = 1
        `,
        [item.product_id],
      );

      const product = productRows[0];

      if (!product) {
        throw new Error(`Product not found: ${item.product_name}`);
      }

      const currentStock = Number(product.stock_quantity ?? 0);

      const currentAverageCost = Number(product.average_cost ?? 0);

      const purchaseQuantity = Number(item.quantity);

      const purchasePrice = Number(item.unit_price);

      // --------------------------------------------------
      // Calculate weighted average cost
      // --------------------------------------------------

      const effectiveAverageCost =
        currentAverageCost > 0
          ? currentAverageCost
          : currentStock > 0
            ? purchasePrice
            : 0;

      const newStock = currentStock + purchaseQuantity;

      const newAverageCost =
        newStock > 0
          ? (currentStock * effectiveAverageCost +
              purchaseQuantity * purchasePrice) /
            newStock
          : purchasePrice;

      // --------------------------------------------------
      // Update stock and average cost
      // --------------------------------------------------

      const stockUpdate = await db.execute(
        `
        UPDATE products
        SET
          stock_quantity = ?,
          average_cost = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND is_active = 1
        `,
        [newStock, newAverageCost, item.product_id],
      );

      if (stockUpdate.rowsAffected !== 1) {
        throw new Error(`Stock could not be updated for: ${item.product_name}`);
      }
    }

    return {
      purchaseNumber,
      purchaseId: purchaseId as number,
    };
  } catch (error) {
    console.error("Purchase creation failed:", error);

    throw error;
  }
}

export type PurchaseWithSupplier = Purchase & {
  supplier_name: string | null;
};

export async function getPurchases(): Promise<PurchaseWithSupplier[]> {
  const db = await getDatabase();

  return await db.select<PurchaseWithSupplier[]>(
    `
    SELECT
      p.id,
      p.purchase_number,
      p.supplier_id,
      s.name AS supplier_name,
      p.purchase_date,
      p.subtotal,
      p.tax_amount,
      p.discount_amount,
      p.grand_total,
      p.payment_method,
      p.notes,
      p.created_at
    FROM purchases p
    LEFT JOIN suppliers s
      ON p.supplier_id = s.id
    ORDER BY p.purchase_date DESC, p.id DESC
    `,
  );
}

export async function getPurchaseById(id: number): Promise<{
  purchase: Purchase;
  items: PurchaseItem[];
}> {
  const db = await getDatabase();

  const purchases = await db.select<Purchase[]>(
    `
    SELECT
      id,
      purchase_number,
      supplier_id,
      purchase_date,
      subtotal,
      tax_amount,
      discount_amount,
      grand_total,
      payment_method,
      notes,
      created_at
    FROM purchases
    WHERE id = ?
    LIMIT 1
    `,
    [id],
  );

  if (!purchases.length) {
    throw new Error("Purchase not found.");
  }

  const items = await db.select<PurchaseItem[]>(
    `
    SELECT
      product_id,
      product_name,
      quantity,
      unit_price,
      tax_rate,
      tax_amount,
      discount_amount,
      line_total
    FROM purchase_items
    WHERE purchase_id = ?
    ORDER BY id ASC
    `,
    [id],
  );

  return {
    purchase: purchases[0],
    items,
  };
}

export async function deletePurchase(purchaseId: number): Promise<void> {
  const db = await getDatabase();
  const { items } = await getPurchaseById(purchaseId);

  // 1. Revert stock for all items by subtracting the purchased quantity
  for (const item of items) {
    await db.execute(
      `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [item.quantity, item.product_id],
    );
  }

  // 2. Delete purchase items
  await db.execute(`DELETE FROM purchase_items WHERE purchase_id = ?`, [
    purchaseId,
  ]);

  // 3. Delete purchase
  await db.execute(`DELETE FROM purchases WHERE id = ?`, [purchaseId]);
}

export async function updatePurchase(
  purchaseId: number,
  purchase: CreatePurchaseData,
): Promise<void> {
  const db = await getDatabase();
  const { items: oldItems } = await getPurchaseById(purchaseId);

  // 1. Revert old stock
  for (const item of oldItems) {
    await db.execute(
      `UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1`,
      [item.quantity, item.product_id],
    );
  }

  // 2. Delete old items
  await db.execute(`DELETE FROM purchase_items WHERE purchase_id = ?`, [
    purchaseId,
  ]);

  // 3. Update purchase record
  await db.execute(
    `
    UPDATE purchases
    SET
      supplier_id = ?,
      subtotal = ?,
      tax_amount = ?,
      discount_amount = ?,
      grand_total = ?,
      payment_method = ?,
      notes = ?
    WHERE id = ?
    `,
    [
      purchase.supplier_id ?? null,
      purchase.subtotal,
      purchase.tax_amount,
      purchase.discount_amount,
      purchase.grand_total,
      purchase.payment_method,
      purchase.notes ?? null,
      purchaseId,
    ],
  );

  // 4. Insert new items and update stock
  for (const item of purchase.items) {
    await db.execute(
      `
      INSERT INTO purchase_items (
        purchase_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        tax_rate,
        tax_amount,
        discount_amount,
        line_total
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        purchaseId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.tax_rate,
        item.tax_amount,
        item.discount_amount,
        item.line_total,
      ],
    );

    const productRows = await db.select<
      { stock_quantity: number; average_cost: number }[]
    >(
      `SELECT stock_quantity, average_cost FROM products WHERE id = ? AND is_active = 1`,
      [item.product_id],
    );

    const product = productRows[0];
    if (!product) continue;

    const currentStock = Number(product.stock_quantity ?? 0);
    const currentAverageCost = Number(product.average_cost ?? 0);
    const purchaseQuantity = Number(item.quantity);
    const purchasePrice = Number(item.unit_price);

    const effectiveAverageCost =
      currentAverageCost > 0
        ? currentAverageCost
        : currentStock > 0
          ? purchasePrice
          : 0;
    const newStock = currentStock + purchaseQuantity;
    const newAverageCost =
      newStock > 0
        ? (currentStock * effectiveAverageCost +
            purchaseQuantity * purchasePrice) /
          newStock
        : purchasePrice;

    await db.execute(
      `UPDATE products SET stock_quantity = ?, average_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1`,
      [newStock, newAverageCost, item.product_id],
    );
  }
}
