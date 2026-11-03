"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addQrAction, removeQrAction, requestQrUpload } from "./actions";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const buttonClass =
  "rounded-md border border-line px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

type Qr = { id: string; label: string; url: string };

/** Up to four bank QR images: upload straight to the private bucket, label, remove. */
export default function QrManager({ qr, max }: { qr: Qr[]; max: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    setUploading(true);
    try {
      const signed = await requestQrUpload(file.type, file.size);
      if ("error" in signed) throw new Error(signed.error);
      const { error: uploadError } = await createClient()
        .storage.from("payment-qr")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const result = await addQrAction(signed.path, label);
      if (result.error) setError(result.error);
      else setLabel("");
      router.refresh();
    } catch (caught) {
      console.error("qr upload failed", caught);
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(id: string) {
    if (!window.confirm("Remove this QR image?")) return;
    startTransition(async () => {
      const result = await removeQrAction(id);
      setError(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      {qr.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-4">
          {qr.map((code) => (
            <li key={code.id} className="w-40">
              {/* A short-lived signed URL from a private bucket: next/image can't optimise it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={code.url} alt={code.label || "Bank QR"} className="w-full rounded border border-line bg-white" />
              <p className="mt-1 truncate font-mono text-xs text-muted">{code.label || "(no label)"}</p>
              <button type="button" disabled={pending} onClick={() => remove(code.id)} className={`${buttonClass} mt-1`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {qr.length < max ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="eyebrow text-muted">Label (e.g. the bank)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              className="mt-2 block w-48 rounded-md border border-line bg-bg px-3 py-2 outline-none focus:border-ink"
            />
          </label>
          <label className="block">
            <span className="eyebrow text-muted">Add a QR image ({qr.length}/{max})</span>
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
              className="mt-2 block text-sm"
            />
          </label>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">You have {max} QR images, the most you can keep. Remove one to add another.</p>
      )}
      {error && <p className="mt-2 text-sm text-blaze">{error}</p>}
    </div>
  );
}
