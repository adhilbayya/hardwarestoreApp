import type { Invoice, InvoiceItem } from "../../database/invoice";
import type { Customer } from "../../database/customer";

type InvoicePrintProps = {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer | null;
};

function InvoicePrint({ invoice, items, customer }: InvoicePrintProps) {
  return (
    <div className="invoice-print">
      <div className="invoice-header">
        <h1>HARDWARE STORE</h1>
        <p>Sales Invoice</p>
      </div>

      <div className="invoice-info">
        <div>
          <strong>Invoice No:</strong>
          <span>{invoice.invoice_number}</span>
        </div>

        <div>
          <strong>Date:</strong>
          <span>
            {new Date(
              invoice.created_at.replace(" ", "T") + "Z",
            ).toLocaleString("en-IN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
        </div>
      </div>

      {customer && (
        <div className="invoice-customer">
          <h3>Customer</h3>

          <p>
            <strong>{customer.name}</strong>
          </p>

          {customer.phone && <p>Phone: {customer.phone}</p>}

          {customer.address && <p>{customer.address}</p>}

          {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
        </div>
      )}

      {!customer && (
        <div className="invoice-customer">
          <h3>Customer</h3>
          <p>Walk-in Customer</p>
        </div>
      )}

      <table className="invoice-items">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => (
            <tr key={item.product_id}>
              <td>{index + 1}</td>

              <td>{item.product_name}</td>

              <td>{item.quantity}</td>

              <td>₹{item.unit_price.toFixed(2)}</td>

              <td>₹{item.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <div>
          <span>Subtotal</span>
          <strong>₹{invoice.subtotal.toFixed(2)}</strong>
        </div>

        <div>
          <span>Tax</span>
          <strong>₹{invoice.tax_amount.toFixed(2)}</strong>
        </div>

        {invoice.discount_amount > 0 && (
          <div>
            <span>Discount</span>
            <strong>- ₹{invoice.discount_amount.toFixed(2)}</strong>
          </div>
        )}

        <div className="invoice-grand-total">
          <span>Grand Total</span>
          <strong>₹{invoice.grand_total.toFixed(2)}</strong>
        </div>
      </div>

      <div className="invoice-payment">
        <strong>Payment:</strong> {invoice.payment_method}
      </div>

      <div className="invoice-footer">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );
}

export default InvoicePrint;
