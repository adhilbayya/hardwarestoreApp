import { useEffect, useState } from "react";
import ProductsPage from "./components/products/productsPage";
import CategoryUnitSettings from "./components/settings/CategoryUnitSettings";
import BillingPage from "./components/billing/BillingPage";
import "./App.css";
import CustomersPage from "./components/customers/CustomersPage";
import SuppliersPage from "./components/suppliers/SuppliersPage";
import PurchasesPage from "./components/purchases/PurchasesPage";
import Dashboard from "./components/dashboard/Dashboard";
import ReportsPage from "./components/reports/ReportsPage";
import { weeklyAutoBackup } from "./database/backup";
import CreditsPage from "./components/credits/CreditsPage";
import logo from "./assets/logosquaregreen.jpeg";

type Page =
  | "Dashboard"
  | "Products"
  | "Billing"
  | "Purchases"
  | "Customers"
  | "Suppliers"
  | "Reports"
  | "Settings"
  | "Credit";

const menuItems: { name: Page; icon: string }[] = [
  { name: "Dashboard", icon: "⌂" },
  { name: "Products", icon: "▦" },
  { name: "Billing", icon: "▤" },
  { name: "Purchases", icon: "↓" },
  { name: "Credit", icon: "⏱" },
  { name: "Customers", icon: "♙" },
  { name: "Suppliers", icon: "▣" },
  { name: "Reports", icon: "▥" },
  { name: "Settings", icon: "⚙" },
];

function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");
  const [redoInvoiceId, setRedoInvoiceId] = useState<number | null>(null);
  const [redoPurchaseId, setRedoPurchaseId] = useState<number | null>(null);

  useEffect(() => {
    weeklyAutoBackup().catch((error) => {
      console.error("Automatic backup failed:", error);
    });
  }, []);

  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <img
            src={logo}
            alt="Nilgiri Pumps Logo"
            className="brand-icon"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              objectFit: "cover",
            }}
          />

          <div>
            <h1>NILGIRI PUMPS AND FITTINGS</h1>
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
            <p>{currentDate}</p>
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
            <Dashboard
              onNewBill={() => {
                setRedoInvoiceId(null);
                setActivePage("Billing");
              }}
              onViewSales={() => setActivePage("Reports")}
              onViewStock={() => setActivePage("Products")}
              onViewPurchases={() => setActivePage("Purchases")}
            />
          ) : activePage === "Products" ? (
            <ProductsPage />
          ) : activePage === "Billing" ? (
            <BillingPage
              redoInvoiceId={redoInvoiceId}
              onClearRedo={() => setRedoInvoiceId(null)}
            />
          ) : activePage === "Settings" ? (
            <CategoryUnitSettings />
          ) : activePage === "Customers" ? (
            <CustomersPage />
          ) : activePage === "Suppliers" ? (
            <SuppliersPage />
          ) : activePage === "Purchases" ? (
            <PurchasesPage
              redoPurchaseId={redoPurchaseId}
              onClearRedo={() => setRedoPurchaseId(null)}
            />
          ) : activePage === "Reports" ? (
            <ReportsPage
              onRedoBill={(id: number) => {
                setRedoInvoiceId(id);
                setActivePage("Billing");
              }}
              onRedoPurchase={(id: number) => {
                setRedoPurchaseId(id);
                setActivePage("Purchases");
              }}
            />
          ) : activePage === "Credit" ? (
            <CreditsPage />
          ) : (
            <PlaceholderPage page={activePage} />
          )}
        </div>
      </main>
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
