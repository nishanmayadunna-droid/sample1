"use client";

import { useState, useTransition } from "react";
import { AUTH_MESSAGES, type AuthMessage } from "@/lib/auth-messages";
import L from "../components/L";
import { requestPasswordResetAction } from "./actions";

const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setMessage(await requestPasswordResetAction(email)));
      }}
      className="mt-6"
    >
      <label className="block">
        <span className="eyebrow text-muted">
          <L si="ඊමේල් ලිපිනය" en="Email address" />
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={inputClass}
        />
      </label>
      {message && (
        <p role="status" className={`mt-3 text-sm ${message === "resetRequested" ? "text-muted" : "text-blaze"}`}>
          <L {...AUTH_MESSAGES[message]} />
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-blaze py-4 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        <L si="සබැඳිය යවන්න" en="Send the link" />
      </button>
    </form>
  );
}
