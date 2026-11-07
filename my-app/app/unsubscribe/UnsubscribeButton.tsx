"use client";

import { useState, useTransition } from "react";
import L from "../components/L";
import { unsubscribeAction } from "./actions";

export default function UnsubscribeButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"ok" | "not_found" | "error" | null>(null);

  if (result === "ok") {
    return (
      <p className="mt-6">
        <L si="ඔබ ලැයිස්තුවෙන් ඉවත් කළා." en="You've been unsubscribed." />
      </p>
    );
  }
  if (result === "not_found") {
    return (
      <p className="mt-6 text-muted">
        <L si="මෙම සබැඳිය වලංගු නැත." en="This link isn't valid." />
      </p>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const r = await unsubscribeAction(token);
              setResult(r.message);
            } catch {
              setResult("error");
            }
          })
        }
        className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent disabled:opacity-60"
      >
        <L si="ඉවත් වන්න" en="Unsubscribe" />
      </button>
      {result === "error" && (
        <p role="alert" className="mt-3 font-mono text-xs text-blaze">
          <L si="යමක් වැරදුණා. නැවත උත්සාහ කරන්න." en="Something went wrong. Please try again." />
        </p>
      )}
    </div>
  );
}
