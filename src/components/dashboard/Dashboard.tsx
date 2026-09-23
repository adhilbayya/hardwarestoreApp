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
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      {/* Welcome */}
      <div className="welcome">
        <div>
          <h3>Good evening 👋</h3>
          <p>Here's what's happening in your store today.</p>
        </div>

        <button className="primary-button" onClick={onNewBill}>
          + New Bill
        </button>
      </div>

      {/* Summary Cards */}
      <section className="stats-grid">
        <StatCard
          title="Today's Sales"
          value={`₹${stats?.todaySales.toFixed(2) ?? "0.00"}`}
          description="Today's total sales"
          icon="₹"
          positive
        />

        <StatCard
          title="Today's Bills"
          value={String(stats?.todayBills ?? 0)}
          description="Bills created today"
          icon="#"
          positive
        />

        <StatCard
          title="Today's Purchases"
          value={`₹${stats?.todayPurchases.toFixed(2) ?? "0.00"}`}
          description="Today's total purchases"
          icon="↓"
        />

        <StatCard
          title="Total Products"
          value={String(stats?.totalProducts ?? 0)}
          description="Active products"
          icon="▦"
        />
      </section>

      {/* Dashboard Grid */}
      <section className="dashboard-grid">
        {/* Recent Sales */}
        <div className="panel sales-panel">
          <div className="panel-header">
            <div>
              <h3>Recent Sales</h3>
              <p>Latest sales transactions</p>
            </div>

            <button className="text-button" onClick={onViewSales}>
              View All
            </button>
          </div>

          <div className="table-wrapper">
            {loading ? (
              <div className="empty-page">
                <p>Loading sales...</p>
              </div>
            ) : recentSales.length === 0 ? (
              <div className="empty-page">
                <p>No sales found.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Payment</th>
                  </tr>
                </thead>

                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="invoice-number">{sale.invoice_number}</td>

                      <td>{sale.customer_name || "Walk-in Customer"}</td>

                      <td>₹{sale.grand_total.toFixed(2)}</td>

                      <td>
                        <span
                          className={`badge ${
                            sale.payment_method.toLowerCase() === "cash"
                              ? "paid"
                              : "credit"
                          }`}
                        >
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

        {/* Low Stock */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Low Stock</h3>
              <p>Products that need attention</p>
            </div>

            <button className="text-button" onClick={onViewStock}>
              View All
            </button>
          </div>

          <div className="stock-list">
            {loading ? (
              <div className="empty-page">
                <p>Loading stock...</p>
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div className="empty-page">
                <p>No low-stock products.</p>
              </div>
            ) : (
              lowStockProducts.map((product) => {
                const level =
                  product.stock_quantity <= 0
                    ? "critical"
                    : product.stock_quantity <= product.minimum_stock / 2
                      ? "critical"
                      : "low";

                const unit = product.unit_symbol
                  ? ` ${product.unit_symbol}`
                  : "";

                return (
                  <StockItem
                    key={product.id}
                    name={product.name}
                    stock={`${product.stock_quantity}${unit}`}
                    level={level}
                  />
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Recent Purchases */}
      <section className="panel dashboard-purchases-panel">
        <div className="panel-header">
          <div>
            <h3>Recent Purchases</h3>
            <p>Latest purchases from suppliers</p>
          </div>

          <button className="text-button" onClick={onViewPurchases}>
            View All
          </button>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="empty-page">
              <p>Loading purchases...</p>
            </div>
          ) : recentPurchases.length === 0 ? (
            <div className="empty-page">
              <p>No purchases found.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Supplier</th>
                  <th>Amount</th>
                  <th>Payment</th>
                </tr>
              </thead>

              <tbody>
                {recentPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="invoice-number">
                      {purchase.purchase_number}
                    </td>

                    <td>{purchase.supplier_name || "No Supplier"}</td>

                    <td>₹{purchase.grand_total.toFixed(2)}</td>

                    <td>
                      <span
                        className={`badge ${
                          purchase.payment_method.toLowerCase() === "cash"
                            ? "paid"
                            : "credit"
                        }`}
                      >
                        {purchase.payment_method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  positive = false,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
  positive?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-title">{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>

      <div className="stat-value">{value}</div>

      <div className={`stat-description ${positive ? "positive" : ""}`}>
        {description}
      </div>
    </div>
  );
}

function StockItem({
  name,
  stock,
  level,
}: {
  name: string;
  stock: string;
  level: "low" | "critical";
}) {
  return (
    <div className="stock-item">
      <div className={`stock-indicator ${level}`}></div>

      <div className="stock-info">
        <strong>{name}</strong>
        <span>{stock} remaining</span>
      </div>

      <button className="small-button">View</button>
    </div>
  );
}

export default Dashboard;
