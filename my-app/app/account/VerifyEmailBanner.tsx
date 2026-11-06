"use client";

import { useState, useTransition } from "react";
import { AUTH_MESSAGES, type AuthMessage } from "@/lib/auth-messages";
import L from "../components/L";
import { resendVerificationAction } from "./email-actions";

/** Shown on /account while the address on the account has not been confirmed by email. */
export default function VerifyEmailBanner() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<AuthMessage | null>(null);

  return (
    <div className="mt-6 rounded-md border border-line px-4 py-3 text-sm">
      <p>
        <L si="ඔබේ ඊමේල් ලිපිනය තවම තහවුරු කර නැත." en="Your email address isn't confirmed yet." />
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setMessage(await resendVerificationAction()))}
        className="mt-2 text-blaze underline underline-offset-4 disabled:opacity-60"
      >
        <L si="තහවුරු කරන සබැඳිය යවන්න" en="Send me the confirmation link" />
      </button>
      {message && (
        <p role="status" className="mt-2 text-muted">
          <L {...AUTH_MESSAGES[message]} />
        </p>
      )}
    </div>
  );
}
