"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidMascot } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import { requestMascotUpload, saveMascotAction } from "./actions";

type Message = "saved" | "removed" | "bad_file" | "error" | null;

/** Upload a mascot picture straight to Storage with a signed URL, or go back to the built-in panda. */
export default function MascotUpload({ hasCustom }: { hasCustom: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      if (!isValidMascot(file.type, file.size)) {
        setMessage("bad_file");
        return;
      }
      const signed = await requestMascotUpload(file.type, file.size);
      if ("error" in signed) {
        setMessage(signed.error);
        return;
      }
      const { error } = await createClient()
        .storage.from("chat-assets")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      const saved = await saveMascotAction(signed.path);
      setMessage(saved === "ok" ? "saved" : saved);
      router.refresh();
    } catch (error) {
      console.error("mascot upload failed", error);
      setMessage("error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function useDefault() {
    setBusy(true);
    setMessage(null);
    const result = await saveMascotAction(null);
    setMessage(result === "ok" ? "removed" : "error");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <input
        id="mascot-file"
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
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="mascot-file"
          className={`cursor-pointer rounded-full border border-line px-5 py-2 text-sm hover:border-ink has-[:focus-visible]:border-ink ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? "Working…" : "Upload mascot picture"}
        </label>
        {hasCustom && (
          <button type="button" onClick={useDefault} disabled={busy} className="rounded-full px-4 py-2 text-sm underline disabled:opacity-60">
            Use the default panda
          </button>
        )}
        <span className="font-mono text-xs text-muted">PNG, WebP or JPG, up to 1 MB. No SVG.</span>
      </div>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message === "saved" || message === "removed" ? "text-muted" : "text-blaze"}`}>
          {message === "saved" && "Mascot updated."}
          {message === "removed" && "Back to the default panda."}
          {message === "bad_file" && "That file isn't allowed (PNG, WebP or JPG, up to 1 MB)."}
          {message === "error" && "Something went wrong, please try again."}
        </p>
      )}
    </div>
  );
}
