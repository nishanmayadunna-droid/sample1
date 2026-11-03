"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/app/context/LangContext";
import { attachPaymentSlip, requestSlipUpload } from "@/app/orders/[number]/payment-actions";
import { SLIP_MAX_BYTES, SLIP_TYPES } from "@/lib/advance";
import { tr } from "@/lib/i18n";
import { formatPrice } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import L from "./L";

type Bank = { bankName: string; accountName: string; accountNumber: string; branch: string; note: string };
type SlipView = { id: string; status: "pending" | "approved" | "rejected"; rejectReason: string | null; createdAt: string };

const STATUS_TEXT: Record<SlipView["status"], { si: string; en: string }> = {
  pending: { si: "පරීක්ෂා කරමින්", en: "Being checked" },
  approved: { si: "අනුමත", en: "Approved" },
  rejected: { si: "ප්‍රතික්ෂේප", en: "Rejected" },
};

/** The advance to pay now: bank details, QR images, the customer's slips and the uploader. */
export default function PaymentPanel({
  orderNumber,
  advanceAmount,
  total,
  bank,
  qr,
  slips,
  canUpload,
}: {
  orderNumber: string;
  advanceAmount: number;
  total: number;
  bank: Bank;
  qr: { id: string; label: string; url: string }[];
  slips: SlipView[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | "bad_file" | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const signed = await requestSlipUpload(orderNumber, file.type, file.size);
      if ("error" in signed) {
        setMessage(signed.error === "bad_file" ? "bad_file" : "error");
        return;
      }
      const { error } = await createClient()
        .storage.from("payment-slips")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      const result = await attachPaymentSlip(orderNumber, signed.path);
      setMessage(result.message === "saved" ? "saved" : result.message === "bad_file" ? "bad_file" : "error");
      router.refresh();
    } catch (error) {
      console.error("slip upload failed", error);
      setMessage("error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const rows: { key: string; label: React.ReactNode; value: string }[] = [
    { key: "bank", label: <L si="බැංකුව" en="Bank" />, value: bank.bankName },
    { key: "name", label: <L si="ගිණුම් නම" en="Account name" />, value: bank.accountName },
    { key: "number", label: <L si="ගිණුම් අංකය" en="Account number" />, value: bank.accountNumber },
    ...(bank.branch ? [{ key: "branch", label: <L si="ශාඛාව" en="Branch" />, value: bank.branch }] : []),
  ];

  return (
    <section className="mt-8 border border-line bg-surface p-5" aria-labelledby="advance-heading">
      <h2 id="advance-heading" className="eyebrow text-muted">
        <L si="advance ගෙවීම" en="Advance payment" />
      </h2>
      <p className="mt-3 text-sm leading-relaxed">
        <L
          si={`දැන් ගෙවන්න: ${formatPrice(advanceAmount)}. ඉතිරි ${formatPrice(Math.max(total - advanceAmount, 0))} බඩු ලැබෙන විට ගෙවන්න. ඔබේ advance එක තහවුරු වූ පසු අපි ඇණවුම තහවුරු කරමු.`}
          en={`Pay now: ${formatPrice(advanceAmount)}. The remaining ${formatPrice(Math.max(total - advanceAmount, 0))} is paid when it arrives. We confirm your order once your advance is checked.`}
        />
      </p>

      <dl className="mt-4 grid gap-1 font-mono text-sm">
        {rows.map(({ key, label, value }) => (
          <div key={key} className="flex justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            <L si="යොමුව" en="Reference" />
          </dt>
          <dd className="text-right">{orderNumber}</dd>
        </div>
      </dl>
      {bank.note && <p className="mt-3 whitespace-pre-line text-sm text-muted">{bank.note}</p>}

      {qr.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-4">
          {qr.map((code) => (
            <li key={code.id} className="w-36">
              {/* A short-lived signed URL from a private bucket: next/image can't optimise it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={code.url} alt={code.label || tr(lang, "බැංකු QR", "Bank QR")} className="w-full rounded border border-line bg-white" />
              {code.label && <p className="mt-1 text-center font-mono text-xs text-muted">{code.label}</p>}
            </li>
          ))}
        </ul>
      )}

      {slips.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {slips.map((slip, index) => (
            <li key={slip.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
              <span>
                <L si={`Slip ${index + 1}`} en={`Slip ${index + 1}`} />{" "}
                <span className="font-mono text-xs text-muted">
                  {new Date(slip.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                </span>
              </span>
              <span className={`font-mono text-xs uppercase tracking-[0.14em] ${slip.status === "rejected" ? "text-blaze" : "text-muted"}`}>
                <L si={STATUS_TEXT[slip.status].si} en={STATUS_TEXT[slip.status].en} />
              </span>
              {slip.status === "rejected" && slip.rejectReason && (
                <span className="w-full text-xs text-blaze">{slip.rejectReason}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="mt-5">
          <label className="eyebrow block text-muted" htmlFor="slip-file">
            <L si="slip එක upload කරන්න (JPG, PNG, WebP හෝ PDF, 5MB දක්වා)" en="Upload your slip (JPG, PNG, WebP or PDF, up to 5MB)" />
          </label>
          <input
            id="slip-file"
            ref={inputRef}
            type="file"
            accept={SLIP_TYPES.join(",")}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > SLIP_MAX_BYTES) {
                setMessage("bad_file");
                event.target.value = "";
                return;
              }
              void upload(file);
            }}
            className="mt-2 block text-sm"
          />
          {message && (
            <p role="status" className={`mt-2 text-sm ${message === "saved" ? "text-muted" : "text-blaze"}`}>
              {message === "saved" && <L si="ස්තූතියි! ඔබේ slip එක ලැබුණා. අපි පරීක්ෂා කරන්නෙමු." en="Thanks! We've received your slip and will check it." />}
              {message === "bad_file" && <L si="ගොනුව වලංගු නැත (JPG, PNG, WebP, PDF, 5MB දක්වා)." en="That file isn't allowed (JPG, PNG, WebP or PDF, up to 5MB)." />}
              {message === "error" && <L si="upload කිරීම අසාර්ථකයි. නැවත උත්සාහ කරන්න." en="Upload failed. Please try again." />}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
