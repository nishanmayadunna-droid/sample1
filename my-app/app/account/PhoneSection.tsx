"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AUTH_MESSAGES, type AuthMessage } from "@/lib/auth-messages";
import L from "../components/L";
import { confirmPhoneChangeAction, requestPhoneChangeAction } from "./phone-actions";

const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";
const buttonClass =
  "rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-60";

/** Add a phone number to this account, or change the one it has: SMS code to the new number, then confirm. */
export default function PhoneSection({ phone }: { phone: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"number" | "code">("number");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setOpen(false);
    setStep("number");
    setNumber("");
    setCode("");
    setMessage(null);
  }

  function sendCode(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestPhoneChangeAction(number);
      setMessage(result);
      if (result === null) setStep("code");
    });
  }

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await confirmPhoneChangeAction(number, code);
      setMessage(result);
      if (result === null) {
        reset();
        setDone(true);
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-8">
      <h2 className="eyebrow text-muted">
        <L si="දුරකථන අංකය" en="Phone number" />
      </h2>
      <p className="mt-2 text-sm">
        {phone ?? <L si="තවම එකතු කර නැත." en="Not added yet." />}
      </p>
      {done && (
        <p role="status" className="mt-2 text-sm text-muted">
          <L si="දුරකථන අංකය සුරැකුණා." en="Phone number saved." />
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
          className="mt-3 rounded-full border border-line px-5 py-2 text-sm transition-colors hover:border-ink"
        >
          {phone ? <L si="අංකය වෙනස් කරන්න" en="Change number" /> : <L si="අංකයක් එකතු කරන්න" en="Add a number" />}
        </button>
      ) : step === "number" ? (
        <form onSubmit={sendCode} className="mt-3 max-w-sm">
          <label className="block">
            <span className="eyebrow text-muted">
              <L si="නව දුරකථන අංකය" en="New phone number" />
            </span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0771234567"
              className={inputClass}
            />
          </label>
          {message && (
            <p role="alert" className="mt-2 text-sm text-blaze">
              <L {...AUTH_MESSAGES[message]} />
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={pending} className={buttonClass}>
              <L si="කේතය යවන්න" en="Send code" />
            </button>
            <button type="button" onClick={reset} className="rounded-full border border-line px-5 py-3 text-sm hover:border-ink">
              <L si="අවලංගු" en="Cancel" />
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirm} className="mt-3 max-w-sm">
          <p className="text-sm text-muted">
            <L si={`${number} වෙත SMS කේතයක් යැවුවා.`} en={`We sent a code by SMS to ${number}.`} />
          </p>
          <label className="mt-3 block">
            <span className="eyebrow text-muted">
              <L si="කේතය" en="Code" />
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={inputClass}
            />
          </label>
          {message && (
            <p role="alert" className="mt-2 text-sm text-blaze">
              <L {...AUTH_MESSAGES[message]} />
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={pending} className={buttonClass}>
              <L si="තහවුරු කරන්න" en="Confirm" />
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("number");
                setCode("");
                setMessage(null);
              }}
              className="rounded-full border border-line px-5 py-3 text-sm hover:border-ink"
            >
              <L si="ආපසු" en="Back" />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
