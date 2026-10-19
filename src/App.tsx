import { useEffect, useState, type ReactNode } from "react";
import ProductsPage from "./components/products/productsPage";
import CategoryUnitSettings from "./components/settings/CategoryUnitSettings";
import BillingPage from "./components/billing/BillingPage";
import "./App.css";
import CustomersPage from "./components/customers/CustomersPage";
import SuppliersPage from "./components/suppliers/SuppliersPage";
import PurchasesPage from "./components/purchases/PurchasesPage";
import PurchaseHistoryPage from "./components/purchases/PurchaseHistoryPage";
import Dashboard from "./components/dashboard/Dashboard";
import ReportsPage from "./components/reports/ReportsPage";
import InvoicesPage from "./components/invoices/InvoicesPage";
import QuotationsPage from "./components/quotations/QuotationsPage";
import { weeklyAutoBackup } from "./database/backup";
import CreditsPage from "./components/credits/CreditsPage";
import logo from "./assets/logosquaregreen.jpeg";

export type Page =
  | "Dashboard"
  | "Billing"
  | "Quotations"
  | "Invoices"
  | "Products"
  | "Purchases"
  | "Purchase History"
  | "Customers"
  | "Credit"
  | "Suppliers"
  | "Reports"
  | "Settings";

interface NavItemDef {
  name: Page;
  label: string;
  badge?: string;
  icon: (active: boolean) => ReactNode;
}

interface NavSection {
  title: string;
  items: NavItemDef[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        name: "Dashboard",
        label: "Dashboard",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Sales & Invoicing",
    items: [
      {
        name: "Billing",
        label: "POS Billing",
        badge: "New",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2v20l3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2z" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="11" y2="17" />
          </svg>
        ),
      },
      {
        name: "Quotations",
        label: "Quotations / Estimates",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 14h6" />
            <path d="M9 18h6" />
            <path d="M9 10h6" />
          </svg>
        ),
      },
      {
        name: "Invoices",
        label: "Invoice History",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        ),
      },
      {
        name: "Credit",
        label: "Customer Ledger",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Inventory & Purchasing",
    items: [
      {
        name: "Products",
        label: "Products Catalog",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      },
      {
        name: "Purchases",
        label: "New Purchase",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        ),
      },
      {
        name: "Purchase History",
        label: "Purchase History",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <polyline points="23 20 23 14 17 14" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Parties Directory",
    items: [
      {
        name: "Customers",
        label: "Customers",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        name: "Suppliers",
        label: "Suppliers",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Analytics & System",
    items: [
      {
        name: "Reports",
        label: "Reports & GST",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
      },
      {
        name: "Settings",
        label: "Settings & Backup",
        icon: () => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
    ],
  },
];

function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");
  const [redoInvoiceId, setRedoInvoiceId] = useState<number | null>(null);
  const [redoPurchaseId, setRedoPurchaseId] = useState<number | null>(null);
  const [convertQuotation, setConvertQuotation] = useState<{
    quotationId: number;
    quotationData: any;
  } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

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
          />

          <div>
            <h1>NILGIRI PUMPS</h1>
            <span>Hardware ERP</span>
          </div>
        </div>

        <nav className="navigation">
          {navSections.map((section) => (
            <div className="nav-group" key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => {
                const isActive = activePage === item.name;
                return (
                  <button
                    key={item.name}
                    className={`nav-item ${isActive ? "active" : ""}`}
                    onClick={() => setActivePage(item.name)}
                  >
                    <span className="nav-icon">{item.icon(isActive)}</span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="nav-item-badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="store-status">
            <span className="status-dot"></span>

            <div>
              <strong>System Online</strong>
              <small>Local SQLite DB</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title-group">
              <h2>{activePage}</h2>
              <p>
                <span>Hardware Management System</span>
              </p>
            </div>
          </div>

          <div className="topbar-actions">
            {/* Quick POS New Bill Button */}
            {activePage !== "Billing" && (
              <button
                type="button"
                className="topbar-quick-btn"
                onClick={() => {
                  setRedoInvoiceId(null);
                  setActivePage("Billing");
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>New Bill (POS)</span>
              </button>
            )}

            {/* Date Badge */}
            <div className="topbar-date-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{currentDate}</span>
            </div>

            <div className="topbar-divider" />

            {/* Theme Toggle */}
            <button
              className="topbar-theme-toggle"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* User Profile Pill */}
            <div className="user-profile">
              <div className="avatar">O</div>

              <div className="user-info">
                <strong>Store Owner</strong>
                <span>● Active</span>
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
              convertFromQuotation={convertQuotation}
              onClearQuotation={() => setConvertQuotation(null)}
            />
          ) : activePage === "Quotations" ? (
            <QuotationsPage
              onConvertToBill={(quotationId, quotationData) => {
                setRedoInvoiceId(null);
                setConvertQuotation({ quotationId, quotationData });
                setActivePage("Billing");
              }}
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
            <ReportsPage />
          ) : activePage === "Purchase History" ? (
            <PurchaseHistoryPage
              onRedoPurchase={(id: number) => {
                setRedoPurchaseId(id);
                setActivePage("Purchases");
              }}
            />
          ) : activePage === "Credit" ? (
            <CreditsPage />
          ) : activePage === "Invoices" ? (
            <InvoicesPage
              onRedoBill={(id: number) => {
                setRedoInvoiceId(id);
                setActivePage("Billing");
              }}
            />
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
