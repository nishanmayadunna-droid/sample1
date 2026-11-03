import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { getPaymentSettings, listQrCodes, MAX_QR_CODES, qrSignedUrls } from "@/lib/payments-data";
import AdminTabs from "../AdminTabs";
import PaymentSettingsForm from "./PaymentSettingsForm";
import QrManager from "./QrManager";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPaymentsPage() {
  await requireAdmin("/admin/payments");
  const [settings, qr] = await Promise.all([
    getPaymentSettings(),
    listQrCodes().then(qrSignedUrls),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="payments" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Payments</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Customers you haven&apos;t trusted yet pay a small advance by bank transfer and upload the slip. Approving a slip
        on the order page makes the customer trusted, and trusted customers order with plain cash on delivery. You can
        also trust or untrust customers by hand under Customers.
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Advance and bank details</h2>
        <PaymentSettingsForm settings={settings} />
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl">Bank QR images</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Shown on the order page next to the bank details. They are stored privately and only shown to a customer who
          owes an advance.
        </p>
        <QrManager qr={qr} max={MAX_QR_CODES} />
      </section>
    </div>
  );
}
