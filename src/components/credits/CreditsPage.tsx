import { useEffect, useState } from "react";
import {
  getCreditInvoices,
  closeCredit,
  type CreditInvoice,
} from "../../database/invoice";
import { confirm } from "@tauri-apps/plugin-dialog";

export default function CreditsPage() {
  const [credits, setCredits] = useState<CreditInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCredits();
  }, []);

  async function loadCredits() {
    try {
      setLoading(true);
      const data = await getCreditInvoices();
      setCredits(data);
    } catch (error) {
      console.error("Failed to load credits:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseCredit(invoice: CreditInvoice) {
    const confirmed = await confirm(
      `Are you sure you want to close the credit for ${invoice.customer_name || "this customer"} (Invoice: ${invoice.invoice_number})?`,
      { title: "Close Credit", kind: "warning" },
    );

    if (confirmed) {
      try {
        await closeCredit(invoice.id);
        await loadCredits();
      } catch (error) {
        console.error("Failed to close credit:", error);
      }
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN");
  }

  return (
    <div>
      <div className="welcome">
        <div>
          <h3>Credits</h3>
          <p>Manage customer credit records and settlements.</p>
        </div>
      </div>

      <div className="panel report-section">
        <div className="panel-header">
          <div>
            <h3>Active Credits</h3>
            <p>Customers with outstanding balances.</p>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="empty-page">
              <p>Loading credit records...</p>
            </div>
          ) : credits.length === 0 ? (
            <div className="empty-page">
              <p>No active credit sales found.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((credit) => (
                  <tr key={credit.id}>
                    <td className="invoice-number">{credit.invoice_number}</td>
                    <td>{credit.customer_name || "Walk-in Customer"}</td>
                    <td>{formatDate(credit.invoice_date)}</td>
                    <td>₹{credit.grand_total.toFixed(2)}</td>
                    <td>
                      <button
                        className="small-button"
                        onClick={() => handleCloseCredit(credit)}
                      >
                        Close Credit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
