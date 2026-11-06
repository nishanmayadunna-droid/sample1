"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AUTH_MESSAGES, type AuthMessage } from "@/lib/auth-messages";
import L from "../components/L";
import { resetPasswordAction } from "./actions";

const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [pending, startTransition] = useTransition();

  if (message === "passwordChanged") {
    return (
      <div className="mt-6">
        <p role="status" className="text-sm">
          <L {...AUTH_MESSAGES.passwordChanged} />
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          <L si="ඇතුළු වන්න" en="Sign in" />
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (password !== again) {
          setMismatch(true);
          return;
        }
        setMismatch(false);
        startTransition(async () => setMessage(await resetPasswordAction(token, password)));
      }}
      className="mt-6"
    >
      <label className="block">
        <span className="eyebrow text-muted">
          <L si="අලුත් මුරපදය" en="New password" />
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <label className="mt-5 block">
        <span className="eyebrow text-muted">
          <L si="මුරපදය නැවත" en="Repeat the password" />
        </span>
        <input
          type="password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      {mismatch && (
        <p role="alert" className="mt-3 text-sm text-blaze">
          <L si="මුරපද දෙක සමාන නැහැ." en="The two passwords don't match." />
        </p>
      )}
      {message && (
        <p role="alert" className="mt-3 text-sm text-blaze">
          <L {...AUTH_MESSAGES[message]} />
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-blaze py-4 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        <L si="මුරපදය සුරකින්න" en="Save the new password" />
      </button>
    </form>
  );
}
