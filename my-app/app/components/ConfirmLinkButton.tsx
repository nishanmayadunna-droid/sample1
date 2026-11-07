"use client";

import { useState, useTransition } from "react";
import L from "./L";

type Result = "ok" | "invalid" | "error";

/**
 * The button on a link from an email. Opening the link changes nothing (mail
 * scanners open links); only this click, a POST to a Server Action, does.
 */
export default function ConfirmLinkButton({
  token,
  action,
  label,
  done,
}: {
  token: string;
  action: (token: string) => Promise<Result>;
  label: { si: string; en: string };
  done: { si: string; en: string };
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  if (result === "ok") {
    return (
      <p role="status" className="mt-6">
        <L {...done} />
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
              setResult(await action(token));
            } catch {
              setResult("error");
            }
          })
        }
        className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent disabled:opacity-60"
      >
        <L {...label} />
      </button>
      {result === "invalid" && (
        <p role="alert" className="mt-3 text-sm text-blaze">
          <L si="මෙම සබැඳිය වලංගු නැත හෝ කල් ඉකුත් වී ඇත." en="This link is invalid or has expired." />
        </p>
      )}
      {result === "error" && (
        <p role="alert" className="mt-3 text-sm text-blaze">
          <L si="යමක් වැරදුණා. නැවත උත්සාහ කරන්න." en="Something went wrong. Please try again." />
        </p>
      )}
    </div>
  );
}
