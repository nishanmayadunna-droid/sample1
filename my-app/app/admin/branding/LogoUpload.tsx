"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { brandAssetUrl, isBrandImage, type BrandSlot } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import { requestBrandUpload, saveBrandImageAction } from "./actions";

type Message = "saved" | "removed" | "bad_file" | "error" | null;

const SLOT_TEXT: Record<BrandSlot, { title: string; hint: string }> = {
  logo: { title: "Logo", hint: "Shown in the header. Without one, the logo text is used." },
  logoDark: { title: "Logo for dark mode", hint: "Optional. Used in dark mode and in the footer; without it the logo above is used." },
  favicon: { title: "Favicon", hint: "The small icon in the browser tab. Square works best." },
  share: { title: "Share image", hint: "Shown when a link is shared (1200 × 630 works best). Without one, a card with the logo text is made." },
};

/** One image slot: upload straight to Storage with a signed URL, preview on a light and a dark swatch. */
export default function LogoUpload({ slot, path }: { slot: BrandSlot; path: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const id = `brand-${slot}`;

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      if (!isBrandImage(file.type, file.size)) {
        setMessage("bad_file");
        return;
      }
      const signed = await requestBrandUpload(slot, file.type, file.size);
      if ("error" in signed) {
        setMessage(signed.error);
        return;
      }
      const { error } = await createClient()
        .storage.from("brand-assets")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      const saved = await saveBrandImageAction(slot, signed.path);
      setMessage(saved === "ok" ? "saved" : saved);
      router.refresh();
    } catch (error) {
      console.error("brand upload failed", error);
      setMessage("error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    const result = await saveBrandImageAction(slot, null);
    setMessage(result === "ok" ? "removed" : "error");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-line p-4">
      <p className="text-sm font-medium">{SLOT_TEXT[slot].title}</p>
      <p className="mt-1 text-sm text-muted">{SLOT_TEXT[slot].hint}</p>
      {path && (
        <div className="mt-3 grid max-w-xs grid-cols-2 gap-2">
          {["#ffffff", "#111111"].map((background) => (
            <div key={background} className="flex h-16 items-center justify-center rounded" style={{ background }}>
              {/* A small preview from our own public bucket. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandAssetUrl(path)} alt="" className="max-h-12 max-w-full object-contain" />
            </div>
          ))}
        </div>
      )}
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          className={`cursor-pointer rounded-full border border-line px-5 py-2 text-sm hover:border-ink has-[:focus-visible]:border-ink ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? "Working…" : path ? "Replace" : "Upload"}
        </label>
        {path && (
          <button type="button" onClick={remove} disabled={busy} className="text-sm underline disabled:opacity-60">
            Remove
          </button>
        )}
        <span className="font-mono text-xs text-muted">PNG, WebP or JPG, up to 1 MB. No SVG.</span>
      </div>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message === "saved" || message === "removed" ? "text-muted" : "text-blaze"}`}>
          {message === "saved" && "Saved."}
          {message === "removed" && "Removed."}
          {message === "bad_file" && "That file isn't allowed (PNG, WebP or JPG, up to 1 MB)."}
          {message === "error" && "Something went wrong, please try again."}
        </p>
      )}
    </div>
  );
}
