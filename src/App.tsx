import { useState } from "react";
import ProductsPage from "./components/products/productsPage";
import CategoryUnitSettings from "./components/settings/CategoryUnitSettings";
import BillingPage from "./components/billing/BillingPage";
import "./App.css";
import CustomersPage from "./components/customers/CustomersPage";

type Page =
  | "Dashboard"
  | "Products"
  | "Billing"
  | "Purchases"
  | "Customers"
  | "Suppliers"
  | "Reports"
  | "Settings";

const menuItems: { name: Page; icon: string }[] = [
  { name: "Dashboard", icon: "⌂" },
  { name: "Products", icon: "▦" },
  { name: "Billing", icon: "▤" },
  { name: "Purchases", icon: "↓" },
  { name: "Customers", icon: "♙" },
  { name: "Suppliers", icon: "▣" },
  { name: "Reports", icon: "▥" },
  { name: "Settings", icon: "⚙" },
];

function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">H</div>

          <div>
            <h1>Hardware Store</h1>
            <span>Management System</span>
          </div>
        </div>

        <nav className="navigation">
          <div className="nav-section-title">MENU</div>

          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? "active" : ""}`}
              onClick={() => setActivePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="store-status">
            <span className="status-dot"></span>

            <div>
              <strong>System Online</strong>
              <small>Local Database</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="main">
        <header className="topbar">
          <div>
            <h2>{activePage}</h2>
            <p>Wednesday, September 16, 2026</p>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" title="Notifications">
              ♧
            </button>

            <div className="user-profile">
              <div className="avatar">O</div>

              <div className="user-info">
                <strong>Owner</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
          {activePage === "Dashboard" ? (
            <Dashboard />
          ) : activePage === "Products" ? (
            <ProductsPage />
          ) : activePage === "Billing" ? (
            <BillingPage />
          ) : activePage === "Settings" ? (
            <CategoryUnitSettings />
          ) : activePage === "Customers" ? (
            <CustomersPage />
          ) : (
            <PlaceholderPage page={activePage} />
          )}
        </div>
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <div className="welcome">
        <div>
          <h3>Good evening 👋</h3>
          <p>Here's what's happening in your store today.</p>
        </div>

        <button className="primary-button">+ New Bill</button>
      </div>

      {/* Summary cards */}
      <section className="stats-grid">
        <StatCard
          title="Today's Sales"
          value="₹24,850"
          description="+12.5% from yesterday"
          icon="₹"
          positive
        />

        <StatCard
          title="Today's Bills"
          value="32"
          description="8 more than yesterday"
          icon="#"
          positive
        />

        <StatCard
          title="Total Products"
          value="1,248"
          description="18 products low in stock"
          icon="▦"
        />

        <StatCard
          title="Outstanding"
          value="₹84,500"
          description="12 customers"
          icon="₹"
        />
      </section>

      <section className="dashboard-grid">
        {/* Recent sales */}
        <div className="panel sales-panel">
          <div className="panel-header">
            <div>
              <h3>Recent Sales</h3>
              <p>Today's latest transactions</p>
            </div>

            <button className="text-button">View All</button>
          </div>

          <div className="table-wrapper">
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
                <tr>
                  <td className="invoice-number">INV-00124</td>
                  <td>Ramesh</td>
                  <td>₹4,250</td>
                  <td>
                    <span className="badge paid">Paid</span>
                  </td>
                </tr>

                <tr>
                  <td className="invoice-number">INV-00123</td>
                  <td>ABC Constructions</td>
                  <td>₹8,700</td>
                  <td>
                    <span className="badge credit">Credit</span>
                  </td>
                </tr>

                <tr>
                  <td className="invoice-number">INV-00122</td>
                  <td>Sameer</td>
                  <td>₹1,850</td>
                  <td>
                    <span className="badge paid">Paid</span>
                  </td>
                </tr>

                <tr>
                  <td className="invoice-number">INV-00121</td>
                  <td>Rahman Traders</td>
                  <td>₹6,420</td>
                  <td>
                    <span className="badge paid">Paid</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Low stock */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Low Stock</h3>
              <p>Products that need attention</p>
            </div>

            <button className="text-button">View All</button>
          </div>

          <div className="stock-list">
            <StockItem name="PVC Pipe 1 inch" stock="8 pieces" level="low" />

            <StockItem
              name="Asian Paints 20L"
              stock="5 cans"
              level="critical"
            />

            <StockItem name="Electrical Wire" stock="14 meters" level="low" />

            <StockItem name="Cement" stock="18 bags" level="low" />
          </div>
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

function PlaceholderPage({ page }: { page: Page }) {
  return (
    <div className="empty-page">
      <div className="empty-icon">▦</div>

      <h3>{page}</h3>

      <p>This section will be built next.</p>
    </div>
  );
}

export default App;
