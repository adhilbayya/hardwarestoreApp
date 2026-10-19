import { useEffect, useMemo, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";

import AddProductModal from "./AddProductModal";
import EditProductModal from "./EditProductModal";

import {
  getProducts,
  deactivateProduct,
  type Product,
} from "../../database/product";

type StockFilterType = "all" | "in_stock" | "low_stock" | "out_of_stock";
type SortField =
  | "name"
  | "stock_quantity"
  | "purchase_price"
  | "selling_price"
  | "mrp";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBrand, setSearchBrand] = useState("");
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [stockFilter, setStockFilter] = useState<StockFilterType>("all");

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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
    let confirmed = false;
    try {
      confirmed = await confirm(
        `Are you sure you want to deactivate "${product.name}"? This product will be hidden from billing searches.`,
        { title: "Deactivate Product", kind: "warning" }
      );
    } catch {
      confirmed = window.confirm(
        `Are you sure you want to deactivate "${product.name}"?`
      );
    }

    if (!confirmed) return;

    try {
      await deactivateProduct(product.id);
      await loadProducts();
    } catch (error) {
      console.error("Failed to deactivate product:", error);
    }
  }

  // Summary statistics for KPI cards
  const stats = useMemo(() => {
    let totalStockQty = 0;
    let totalValuation = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const stock = p.stock_quantity ?? 0;
      const minStock = p.minimum_stock ?? 0;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
        totalStockQty += stock;
        totalValuation += stock * (p.purchase_price || 0);
      } else {
        inStockCount++;
        totalStockQty += stock;
        totalValuation += stock * (p.purchase_price || 0);
      }
    }

    return {
      totalProducts: products.length,
      totalStockQty,
      totalValuation,
      inStockCount,
      lowStockCount,
      outOfStockCount,
    };
  }, [products]);

  // Derived unique brands for autocomplete dropdown
  const brandDropdownOptions = useMemo(() => {
    const brandSet = new Set<string>();
    products.forEach((p) => {
      const b = p.brand;
      if (b && b.trim() !== "") {
        brandSet.add(b.trim());
      }
    });
    const uniqueBrands = Array.from(brandSet);
    const q = searchBrand.trim().toLowerCase();
    return uniqueBrands.filter((b) => b.toLowerCase().includes(q)).sort();
  }, [products, searchBrand]);

  // Filtered products based on stock status, brand, and search term
  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const brandQ = searchBrand.trim().toLowerCase();

    return products.filter((product) => {
      const stock = product.stock_quantity ?? 0;
      const minStock = product.minimum_stock ?? 0;

      // 1. Stock Status Filter
      if (stockFilter === "out_of_stock" && stock > 0) {
        return false;
      }
      if (stockFilter === "low_stock" && (stock <= 0 || stock > minStock)) {
        return false;
      }
      if (stockFilter === "in_stock" && stock <= minStock) {
        return false;
      }

      // 2. Brand filter
      if (brandQ) {
        const pBrand = (product.brand || "").toLowerCase();
        if (!pBrand.includes(brandQ)) {
          return false;
        }
      }

      // 3. Search term filter (tokenized across name, HSN, barcode)
      if (!search) return true;
      return search.split(/\s+/).every((token) => {
        const cleanedToken = token.replace(/\s+/g, "");
        const cleanedName = product.name.toLowerCase().replace(/\s+/g, "");
        const cleanedHsn = (product.hsn_sac ?? "").toLowerCase().replace(/\s+/g, "");
        const cleanedBarcode = (product.barcode ?? "").toLowerCase().replace(/\s+/g, "");

        return (
          cleanedName.includes(cleanedToken) ||
          cleanedHsn.includes(cleanedToken) ||
          cleanedBarcode.includes(cleanedToken)
        );
      });
    });
  }, [products, searchTerm, searchBrand, stockFilter]);

  // Sorting
  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [filteredProducts, sortBy, sortOrder]);

  // Reset pagination on filter or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchBrand, stockFilter, pageSize, sortBy, sortOrder]);

  // Paginated items
  const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    if (pageSize === 0) return sortedProducts;
    const startIdx = (currentPage - 1) * pageSize;
    return sortedProducts.slice(startIdx, startIdx + pageSize);
  }, [sortedProducts, currentPage, pageSize]);

  function getStockStatus(product: Product) {
    const stock = product.stock_quantity ?? 0;
    const minStock = product.minimum_stock ?? 0;

    if (stock <= 0) {
      return {
        label: "Out of Stock",
        className: "stock-out",
        dot: "🔴",
      };
    }

    if (stock <= minStock) {
      return {
        label: `Low (${stock}/${minStock})`,
        className: "stock-low",
        dot: "🟡",
      };
    }

    return {
      label: "In Stock",
      className: "stock-in",
      dot: "🟢",
    };
  }

  const hasActiveFilters =
    searchTerm !== "" || searchBrand !== "" || stockFilter !== "all";

  function handleResetFilters() {
    setSearchTerm("");
    setSearchBrand("");
    setStockFilter("all");
    setCurrentPage(1);
  }

  return (
    <div className="products-page-container">
      {/* Header Row */}
      <div className="products-header-row">
        <div>
          <h3>Products & Inventory</h3>
          <p>Manage product catalog, stock levels, pricing, brands, and HSN codes.</p>
        </div>

        <div className="products-header-actions">
          <div className="products-summary-badge">
            <span>📦</span>
            <span>
              {products.length} {products.length === 1 ? "Product" : "Products"} Catalog
            </span>
          </div>

          <button
            type="button"
            className="products-add-btn"
            onClick={() => setShowAddProduct(true)}
          >
            <span>+</span>
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="products-stats-grid">
        <div
          className={`product-stat-card ${stockFilter === "all" ? "active-filter" : ""}`}
          onClick={() => setStockFilter("all")}
          title="Filter: Show all products"
        >
          <div>
            <div className="stat-label">Total Catalog</div>
            <div className="stat-value">{stats.totalProducts}</div>
            <div className="stat-sub">{stats.inStockCount} active in stock</div>
          </div>
          <div className="product-stat-icon stat-icon-blue">📦</div>
        </div>

        <div
          className="product-stat-card"
          title="Total purchase cost valuation of stock"
        >
          <div>
            <div className="stat-label">Stock Valuation</div>
            <div className="stat-value">{formatCurrency(stats.totalValuation)}</div>
            <div className="stat-sub">Across {stats.totalStockQty.toLocaleString()} total units</div>
          </div>
          <div className="product-stat-icon stat-icon-green">💼</div>
        </div>

        <div
          className={`product-stat-card ${stockFilter === "low_stock" ? "active-filter" : ""}`}
          onClick={() => setStockFilter(stockFilter === "low_stock" ? "all" : "low_stock")}
          title="Filter: Show low stock products"
        >
          <div>
            <div className="stat-label">Low Stock Alert</div>
            <div className="stat-value" style={{ color: stats.lowStockCount > 0 ? "#d97706" : undefined }}>
              {stats.lowStockCount}
            </div>
            <div className="stat-sub">At or below reorder level</div>
          </div>
          <div className="product-stat-icon stat-icon-amber">⚠️</div>
        </div>

        <div
          className={`product-stat-card ${stockFilter === "out_of_stock" ? "active-filter" : ""}`}
          onClick={() => setStockFilter(stockFilter === "out_of_stock" ? "all" : "out_of_stock")}
          title="Filter: Show out of stock products"
        >
          <div>
            <div className="stat-label">Out of Stock</div>
            <div className="stat-value" style={{ color: stats.outOfStockCount > 0 ? "#dc2626" : undefined }}>
              {stats.outOfStockCount}
            </div>
            <div className="stat-sub">Depleted inventory items</div>
          </div>
          <div className="product-stat-icon stat-icon-red">🚫</div>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="products-filter-card">
        {/* Stock Status Pills */}
        <div className="products-status-tabs">
          <div className="products-filter-label">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "inline-block", verticalAlign: "middle" }}
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span style={{ lineHeight: "1", display: "inline-block", verticalAlign: "middle" }}>Filter:</span>
          </div>
          <button
            type="button"
            className={`products-status-tab-btn ${stockFilter === "all" ? "active" : ""}`}
            onClick={() => setStockFilter("all")}
          >
            All Products <span className="tab-count">{stats.totalProducts}</span>
          </button>
          <button
            type="button"
            className={`products-status-tab-btn ${stockFilter === "in_stock" ? "active" : ""}`}
            onClick={() => setStockFilter("in_stock")}
          >
            🟢 In Stock <span className="tab-count">{stats.inStockCount}</span>
          </button>
          <button
            type="button"
            className={`products-status-tab-btn ${stockFilter === "low_stock" ? "active" : ""}`}
            onClick={() => setStockFilter("low_stock")}
          >
            🟡 Low Stock <span className="tab-count">{stats.lowStockCount}</span>
          </button>
          <button
            type="button"
            className={`products-status-tab-btn ${stockFilter === "out_of_stock" ? "active" : ""}`}
            onClick={() => setStockFilter("out_of_stock")}
          >
            🔴 Out of Stock <span className="tab-count">{stats.outOfStockCount}</span>
          </button>
        </div>

        {/* Search & Brand Row */}
        <div className="products-search-row">
          {/* Main Full-text Search Box */}
          <div className="products-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search product name or HSN code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-btn"
                title="Clear search"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Brand Autocomplete Box */}
          <div className="products-brand-box">
            <span className="brand-icon">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Filter by brand..."
              value={searchBrand}
              onChange={(e) => {
                setSearchBrand(e.target.value);
                setShowBrandDropdown(true);
              }}
              onFocus={() => setShowBrandDropdown(true)}
              onBlur={() => {
                setTimeout(() => setShowBrandDropdown(false), 200);
              }}
            />
            {searchBrand && (
              <button
                type="button"
                className="clear-btn"
                title="Clear brand"
                onClick={() => setSearchBrand("")}
              >
                ✕
              </button>
            )}

            {showBrandDropdown && brandDropdownOptions.length > 0 && (
              <div className="products-brand-dropdown">
                {brandDropdownOptions.map((brand, idx) => (
                  <div
                    key={idx}
                    className="products-brand-option"
                    onMouseDown={() => {
                      setSearchBrand(brand);
                      setShowBrandDropdown(false);
                    }}
                  >
                    🏷️ {brand}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="products-reset-btn"
              onClick={handleResetFilters}
            >
              <span>✕</span>
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Products Table Card */}
      <div className="products-table-card">
        <div className="products-table-header">
          <div>
            <h4>Product Catalog</h4>
            <span>
              Showing {sortedProducts.length === 0 ? 0 : (currentPage - 1) * (pageSize || sortedProducts.length) + 1}–
              {pageSize === 0 ? sortedProducts.length : Math.min(currentPage * pageSize, sortedProducts.length)} of{" "}
              {sortedProducts.length} {sortedProducts.length === 1 ? "item" : "items"}
              {hasActiveFilters && ` (filtered from ${products.length} total)`}
            </span>
          </div>

          <div className="products-page-size-select">
            <span>Show per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>⏳</div>
            Loading product inventory...
          </div>
        ) : sortedProducts.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>📦</div>
            <h5 style={{ margin: "0 0 6px", fontSize: "16px", color: "#1e293b" }}>
              {products.length === 0
                ? "No products added yet"
                : "No products match your filters"}
            </h5>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
              {products.length === 0
                ? "Click below to add your first product to the inventory catalog."
                : "Try resetting your search query or switching stock status filters."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="secondary-button"
                onClick={handleResetFilters}
              >
                Reset All Filters
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowAddProduct(true)}
              >
                + Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>#</th>
                  <th
                    className="sortable"
                    onClick={() => handleSort("name")}
                  >
                    Product Details
                    {sortBy === "name" && (
                      <span className="sort-indicator">
                        {sortOrder === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                  <th style={{ width: "100px" }}>HSN/SAC</th>
                  <th style={{ width: "130px" }}>Unit / Pack</th>
                  <th
                    className="sortable"
                    style={{ width: "110px", textAlign: "right" }}
                    onClick={() => handleSort("purchase_price")}
                  >
                    Purchase (₹)
                    {sortBy === "purchase_price" && (
                      <span className="sort-indicator">
                        {sortOrder === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                  <th
                    className="sortable"
                    style={{ width: "115px", textAlign: "right" }}
                    onClick={() => handleSort("selling_price")}
                  >
                    Sale (Net)
                    {sortBy === "selling_price" && (
                      <span className="sort-indicator">
                        {sortOrder === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                  <th style={{ width: "85px", textAlign: "center" }}>GST</th>
                  <th
                    className="sortable"
                    style={{ width: "115px", textAlign: "right" }}
                    onClick={() => handleSort("mrp")}
                  >
                    Retail MRP
                    {sortBy === "mrp" && (
                      <span className="sort-indicator">
                        {sortOrder === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                  <th
                    className="sortable"
                    style={{ width: "140px", textAlign: "center" }}
                    onClick={() => handleSort("stock_quantity")}
                  >
                    Stock Level
                    {sortBy === "stock_quantity" && (
                      <span className="sort-indicator">
                        {sortOrder === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                  <th style={{ width: "150px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product, idx) => {
                  const rowNumber =
                    pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const status = getStockStatus(product);

                  return (
                    <tr key={product.id} className="product-row">
                      <td style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                        {rowNumber}
                      </td>

                      <td>
                        <div className="product-cell-main">
                          <span className="product-cell-name">{product.name}</span>
                          <div className="product-cell-badges">
                            {product.brand && (
                              <span className="product-brand-tag">
                                🏷️ {product.brand}
                              </span>
                            )}
                            {product.barcode && (
                              <span className="product-barcode-tag" title="Barcode">
                                ║ {product.barcode}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        {product.hsn_sac ? (
                          <span className="product-hsn-tag">{product.hsn_sac}</span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: "12px", color: "#334155", fontWeight: 500 }}>
                          {product.unit_symbol || product.unit_name || product.uom || "Unit"}
                        </div>
                        {product.has_bulk === 1 && product.bulk_unit && (
                          <div className="product-bulk-badge" title="Bulk Pack Configuration">
                            📦 {product.bulk_conversion_rate} {product.unit_symbol || ""} / {product.bulk_unit}
                            {product.bulk_price ? ` @ ₹${product.bulk_price}` : ""}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        ₹{product.purchase_price.toFixed(2)}
                      </td>

                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                        ₹{product.selling_price.toFixed(2)}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <span className="product-tax-badge">
                          {product.tax_rate > 0 ? `${product.tax_rate}%` : "0%"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <span className="product-mrp-price">
                          ₹{product.mrp.toFixed(2)}
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                            {product.stock_quantity}{" "}
                            <span style={{ fontSize: "11px", fontWeight: 400, color: "#64748b" }}>
                              {product.unit_symbol || ""}
                            </span>
                          </span>
                          <span className={`stock-badge-pill ${status.className}`}>
                            <span>{status.dot}</span>
                            <span>{status.label}</span>
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="product-actions-cell">
                          <button
                            type="button"
                            className="product-action-btn edit"
                            onClick={() => setEditingProduct(product)}
                            title="Edit product details & pricing"
                          >
                            <span>✏️</span>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="product-action-btn deactivate"
                            onClick={() => handleDeactivate(product)}
                            title="Deactivate product"
                          >
                            <span>🗑️</span>
                            <span>Deactivate</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="products-pagination">
            <div>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </div>

            <div className="products-pagination-controls">
              <button
                type="button"
                className="products-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                « First
              </button>
              <button
                type="button"
                className="products-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ‹ Prev
              </button>

              <span className="products-page-indicator">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                className="products-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next ›
              </button>
              <button
                type="button"
                className="products-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onProductAdded={loadProducts}
          existingProducts={products}
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
