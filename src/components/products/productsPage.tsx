import { useEffect, useMemo, useState } from "react";

import AddProductModal from "./AddProductModal";
import EditProductModal from "./EditProductModal";

import {
  getProducts,
  deactivateProduct,
  type Product,
} from "../../database/product";

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);

      const data = await getProducts();

      setProducts(data);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(product: Product) {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${product.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deactivateProduct(product.id);

      await loadProducts();
    } catch (error) {
      console.error("Failed to deactivate product:", error);
    }
  }

  const categories = useMemo(() => {
    const categoryNames = products
      .map((product) => product.category_name)
      .filter((category): category is string => Boolean(category));

    return [...new Set(categoryNames)].sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        search === "" ||
        product.name.toLowerCase().includes(search) ||
        (product.sku ?? "").toLowerCase().includes(search) ||
        (product.barcode ?? "").toLowerCase().includes(search);

      const matchesCategory =
        selectedCategory === "" || product.category_name === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  function getStockStatus(product: Product) {
    if (product.stock_quantity <= 0) {
      return {
        label: "Out of Stock",
        className: "stock-out",
      };
    }

    if (product.stock_quantity <= product.minimum_stock) {
      return {
        label: "Low Stock",
        className: "stock-low",
      };
    }

    return {
      label: "In Stock",
      className: "stock-good",
    };
  }

  return (
    <div>
      {/* Page Header */}
      <div className="welcome">
        <div>
          <h3>Products</h3>
          <p>Manage your hardware store inventory.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowAddProduct(true)}
        >
          + Add Product
        </button>
      </div>

      {/* Product List */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Product List</h3>
            <p>
              Showing {filteredProducts.length} of {products.length} products
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="product-filters">
          <div className="search-box">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search product, SKU or barcode..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <select
            className="category-filter"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="">All Categories</option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Purchase Price</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>Loading products...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    {products.length === 0
                      ? "No products found"
                      : "No products match your search"}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>

                    <td>{product.category_name || "-"}</td>

                    <td>{product.sku || "-"}</td>

                    <td>{product.barcode || "-"}</td>

                    <td>₹{product.purchase_price.toFixed(2)}</td>

                    <td>₹{product.selling_price.toFixed(2)}</td>

                    <td>
                      <div className="stock-cell">
                        <span>
                          {product.stock_quantity} {product.unit_symbol || ""}
                        </span>

                        {(() => {
                          const status = getStockStatus(product);

                          return (
                            <span className={`stock-badge ${status.className}`}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          className="secondary-button"
                          onClick={() => setEditingProduct(product)}
                        >
                          Edit
                        </button>

                        <button
                          className="danger-button"
                          onClick={() => handleDeactivate(product)}
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onProductAdded={loadProducts}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onProductUpdated={loadProducts}
        />
      )}
    </div>
  );
}

export default ProductsPage;
