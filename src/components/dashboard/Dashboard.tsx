import { useEffect, useState } from "react";
import {
  getDashboardStats,
  getRecentSales,
  getRecentPurchases,
  getLowStockProducts,
  type DashboardStats,
  type RecentSale,
  type RecentPurchase,
  type LowStockProduct,
} from "../../database/dashboard";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getPaymentBadgeClass(method: string) {
  const m = (method || "").toLowerCase();
  if (m === "cash") return "payment-badge cash";
  if (m === "credit") return "payment-badge credit";
  if (m === "card") return "payment-badge card";
  return "payment-badge upi";
}

function Dashboard({
  onNewBill,
  onViewSales,
  onViewStock,
  onViewPurchases,
}: {
  onNewBill?: () => void;
  onViewSales?: () => void;
  onViewStock?: () => void;
  onViewPurchases?: () => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProduct, setViewingProduct] = useState<LowStockProduct | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const [dashboardStats, sales, purchases, lowStock] = await Promise.all([
        getDashboardStats(),
        getRecentSales(),
        getRecentPurchases(),
        getLowStockProducts(),
      ]);

      setStats(dashboardStats);
      setRecentSales(sales);
      setRecentPurchases(purchases);
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const currentDateFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="dashboard-page-container">
      {/* Header Row */}
      <div className="dashboard-header-row">
        <div>
          <h3>{getGreeting()} 👋</h3>
          <p>Here's what is happening in your hardware store today.</p>
        </div>

        <div className="dashboard-header-actions">
          <div className="dashboard-date-badge">
            <span>📅</span>
            <span>{currentDateFormatted}</span>
          </div>

          <button
            type="button"
            className="dashboard-new-bill-btn"
            onClick={onNewBill}
          >
            <span>+</span>
            <span>New Bill</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="dashboard-stats-grid">
        {/* Today's Sales */}
        <div
          className="dashboard-stat-card"
          onClick={onViewSales}
          title="Click to view sales reports"
        >
          <div>
            <div className="stat-label">Today's Sales</div>
            <div className="stat-value" style={{ color: "#059669" }}>
              ₹{stats?.todaySales ? stats.todaySales.toFixed(2) : "0.00"}
            </div>
            <div className="stat-sub">Across {stats?.todayBills ?? 0} invoices today</div>
          </div>
          <div className="dashboard-stat-icon stat-icon-emerald">📈</div>
        </div>

        {/* Today's Bills */}
        <div
          className="dashboard-stat-card"
          onClick={onViewSales}
          title="Click to view sales invoices"
        >
          <div>
            <div className="stat-label">Invoices Created</div>
            <div className="stat-value">
              {stats?.todayBills ?? 0}
            </div>
            <div className="stat-sub">Bills generated today</div>
          </div>
          <div className="dashboard-stat-icon stat-icon-blue">🧾</div>
        </div>

        {/* Today's Purchases */}
        <div
          className="dashboard-stat-card"
          onClick={onViewPurchases}
          title="Click to view purchase entries"
        >
          <div>
            <div className="stat-label">Today's Purchases</div>
            <div className="stat-value" style={{ color: "#7c3aed" }}>
              ₹{stats?.todayPurchases ? stats.todayPurchases.toFixed(2) : "0.00"}
            </div>
            <div className="stat-sub">Inward inventory recorded</div>
          </div>
          <div className="dashboard-stat-icon stat-icon-purple">📥</div>
        </div>

        {/* Total Catalog Products */}
        <div
          className="dashboard-stat-card"
          onClick={onViewStock}
          title="Click to view product inventory"
        >
          <div>
            <div className="stat-label">Catalog Products</div>
            <div className="stat-value">
              {stats?.totalProducts ?? 0}
            </div>
            <div className="stat-sub">
              {lowStockProducts.length > 0
                ? `${lowStockProducts.length} low stock warnings`
                : "Inventory levels healthy"}
            </div>
          </div>
          <div className="dashboard-stat-icon stat-icon-amber">📦</div>
        </div>
      </div>

      {/* Main 2-Column Grid: Recent Sales & Low Stock Alert */}
      <div className="dashboard-grid">
        {/* Left Column: Recent Sales */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h4>
                <span>Recent Invoices</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#059669",
                    background: "#ecfdf5",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  Latest {recentSales.length}
                </span>
              </h4>
              <p>Recent sales transactions completed in the store.</p>
            </div>

            <button
              type="button"
              className="dashboard-view-all-btn"
              onClick={onViewSales}
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          <div className="dashboard-table-wrapper">
            {loading ? (
              <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
                Loading recent transactions...
              </div>
            ) : recentSales.length === 0 ? (
              <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>🧾</div>
                No sales recorded yet today.
              </div>
            ) : (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Customer Name</th>
                    <th style={{ textAlign: "right" }}>Grand Total</th>
                    <th style={{ textAlign: "center" }}>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: "#2563eb" }}>
                          {sale.invoice_number}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "#0f172a", fontWeight: 500 }}>
                          {sale.customer_name || "Walk-in Customer"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                        ₹{sale.grand_total.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={getPaymentBadgeClass(sale.payment_method)}>
                          {sale.payment_method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Low Stock Items */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h4>
                <span>Low Stock Alerts</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: lowStockProducts.length > 0 ? "#dc2626" : "#059669",
                    background: lowStockProducts.length > 0 ? "#fef2f2" : "#ecfdf5",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {lowStockProducts.length} {lowStockProducts.length === 1 ? "Item" : "Items"}
                </span>
              </h4>
              <p>Items reaching or falling below reorder threshold.</p>
            </div>

            <button
              type="button"
              className="dashboard-view-all-btn"
              onClick={onViewStock}
            >
              <span>Manage</span>
              <span>→</span>
            </button>
          </div>

          <div className="dashboard-stock-list">
            {loading ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                Checking stock levels...
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center", color: "#64748b" }}>
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>✅</div>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>All stock levels healthy</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                  No items require replenishment right now.
                </div>
              </div>
            ) : (
              lowStockProducts.map((product) => {
                const isCritical =
                  product.stock_quantity <= 0 ||
                  product.stock_quantity <= (product.minimum_stock || 1) / 2;

                const unit = product.unit_symbol ? ` ${product.unit_symbol}` : "";

                return (
                  <div key={product.id} className="dashboard-stock-item">
                    <div className="dashboard-stock-item-left">
                      <div
                        className={`stock-status-dot ${isCritical ? "critical" : "low"}`}
                        title={isCritical ? "Critical stock level" : "Low stock level"}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="dashboard-stock-name" title={product.name}>
                          {product.name}
                        </div>
                        <div className="dashboard-stock-meta">
                          Stock:{" "}
                          <strong style={{ color: isCritical ? "#dc2626" : "#d97706" }}>
                            {product.stock_quantity}{unit}
                          </strong>{" "}
                          (Min: {product.minimum_stock}{unit})
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="dashboard-stock-btn"
                      onClick={() => setViewingProduct(product)}
                    >
                      Inspect
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Full-width Section: Recent Purchases */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <div>
            <h4>
              <span>Recent Inward Purchases</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#7c3aed",
                  background: "#faf5ff",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                Latest {recentPurchases.length}
              </span>
            </h4>
            <p>Incoming stock received from suppliers and vendors.</p>
          </div>

          <button
            type="button"
            className="dashboard-view-all-btn"
            onClick={onViewPurchases}
          >
            <span>View All Purchases</span>
            <span>→</span>
          </button>
        </div>

        <div className="dashboard-table-wrapper">
          {loading ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              Loading purchase entries...
            </div>
          ) : recentPurchases.length === 0 ? (
            <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>📥</div>
              No purchase entries recorded recently.
            </div>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Purchase Entry No</th>
                  <th>Supplier Name</th>
                  <th style={{ textAlign: "right" }}>Grand Total</th>
                  <th style={{ textAlign: "center" }}>Payment Mode</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: "#7c3aed" }}>
                        {purchase.purchase_number}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#0f172a", fontWeight: 500 }}>
                        {purchase.supplier_name || "General Supplier"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                      ₹{purchase.grand_total.toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={getPaymentBadgeClass(purchase.payment_method)}>
                        {purchase.payment_method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Low Stock View Modal */}
      {viewingProduct && (
        <div className="modal-overlay" onClick={() => setViewingProduct(null)}>
          <div
            className="modal product-editor-modal"
            style={{ maxWidth: "440px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Low Stock Warning</h3>
                <p>Inventory level is below recommended safety threshold.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setViewingProduct(null)}
                title="Close"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="product-editor-body" style={{ padding: "20px" }}>
              <div className="product-editor-section">
                <div className="product-editor-section-title">
                  <span>⚠️</span>
                  <span>Stock Discrepancy</span>
                </div>

                <div className="product-editor-field">
                  <label>Product Name</label>
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    {viewingProduct.name}
                  </div>
                </div>

                <div className="product-editor-grid-2" style={{ marginTop: "6px" }}>
                  <div className="product-editor-field">
                    <label>Current Available</label>
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: "8px",
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "#dc2626",
                      }}
                    >
                      {viewingProduct.stock_quantity}{" "}
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                        {viewingProduct.unit_symbol || ""}
                      </span>
                    </div>
                  </div>

                  <div className="product-editor-field">
                    <label>Min Safe Threshold</label>
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {viewingProduct.minimum_stock}{" "}
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                        {viewingProduct.unit_symbol || ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="modal-actions"
              style={{
                padding: "16px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setViewingProduct(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setViewingProduct(null);
                  if (onViewPurchases) onViewPurchases();
                }}
              >
                <span>📥</span>
                <span>Restock in Purchases</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
