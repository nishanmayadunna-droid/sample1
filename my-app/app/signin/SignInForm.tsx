"use client";

import { startTransition, useActionState, useState } from "react";
import { signIn } from "next-auth/react";
import { requestPhoneCodeAction, signUpAction, type SignUpState } from "./actions";
import { AUTH_MESSAGES, signInErrorMessage, type AuthMessage } from "@/lib/auth-messages";
import L from "@/app/components/L";

type Tab = "signin" | "signup" | "phone";

function Message({ code }: { code: AuthMessage }) {
  return <L {...AUTH_MESSAGES[code]} />;
}

/**
 * Signs in with email + password. On success the browser navigates to the
 * destination (a full load, so the Header's session is fresh); otherwise it
 * returns the message to show.
 */
async function passwordSignIn(
  email: string,
  password: string,
  callbackUrl: string,
): Promise<AuthMessage | null> {
  const result = await signIn("credentials", { email, password, redirect: false });
  if (result?.code === "google_account") return "googleAccount";
  if (!result || result.error) return "invalidCredentials";
  window.location.assign(callbackUrl);
  return null;
}

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";
const submitClass =
  "mt-6 w-full rounded-full bg-blaze py-4 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60";

function Field({
  label,
  error,
  ...input
}: { label: React.ReactNode; error?: AuthMessage } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      <input className={inputClass} {...input} />
      {error && (
        <span className="mt-1 block text-sm text-blaze">
          <Message code={error} />
        </span>
      )}
    </label>
  );
}

function SignInPanel({ callbackUrl }: { callbackUrl: string }) {
  const [message, submit, pending] = useActionState(
    async (_prev: AuthMessage | null, formData: FormData) =>
      passwordSignIn(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
        callbackUrl,
      ),
    null,
  );

  return (
    <form action={submit}>
      <Field label={<L si="ඊමේල්" en="Email" />} name="email" type="email" autoComplete="email" required />
      <Field
        label={<L si="මුරපදය" en="Password" />}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {message && (
        <p className="mt-4 text-sm text-blaze">
          <Message code={message} />
        </p>
      )}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? <L si="ඇතුළු වෙමින්…" en="Signing in…" /> : <L si="ඇතුළු වන්න" en="Sign in" />}
      </button>
    </form>
  );
}

const initialSignUp: SignUpState = { ok: false, errors: {}, formError: null };

function SignUpPanel({ callbackUrl }: { callbackUrl: string }) {
  const [state, submit, pending] = useActionState(
    async (prev: SignUpState, formData: FormData): Promise<SignUpState> => {
      const next = await signUpAction(prev, formData);
      if (!next.ok) return next;
      const message = await passwordSignIn(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
        callbackUrl,
      );
      return message ? { ...next, formError: message } : next;
    },
    initialSignUp,
  );

  return (
    <form action={submit}>
      <Field
        label={<L si="නම (අනිවාර්ය නැත)" en="Name (optional)" />}
        name="name"
        type="text"
        autoComplete="name"
        maxLength={100}
        error={state.errors.name}
      />
      <Field
        label={<L si="ඊමේල්" en="Email" />}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.errors.email}
      />
      <Field
        label={<L si="මුරපදය" en="Password" />}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        error={state.errors.password}
      />
      {state.formError && (
        <p className="mt-4 text-sm text-blaze">
          <Message code={state.formError} />
        </p>
      )}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? (
          <L si="ගිණුම සාදමින්…" en="Creating account…" />
        ) : (
          <L si="ගිණුමක් සාදන්න" en="Create account" />
        )}
      </button>
    </form>
  );
}

function PhonePanel({ callbackUrl }: { callbackUrl: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<AuthMessage | null>(null);

  const [, sendCode, sending] = useActionState(
    async (_prev: null, formData: FormData) => {
      const value = String(formData.get("phone") ?? phone);
      setPhone(value);
      const result = await requestPhoneCodeAction(value);
      setMessage(result);
      if (!result) setStep("code");
      return null;
    },
    null,
  );

  const [, verify, verifying] = useActionState(
    async (_prev: null, formData: FormData) => {
      const code = String(formData.get("code") ?? "");
      try {
        const result = await signIn("phone", { phone, code, redirect: false });
        if (!result || result.error) {
          setMessage("codeInvalid");
          return null;
        }
      } catch {
        setMessage("codeInvalid");
        return null;
      }
      window.location.assign(callbackUrl);
      return null;
    },
    null,
  );

  const messageEl = message && (
    <p className="mt-4 text-sm text-blaze">
      <Message code={message} />
    </p>
  );

  if (step === "phone") {
    return (
      <form action={sendCode}>
        <Field
          label={<L si="දුරකථන අංකය" en="Phone number" />}
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          defaultValue={phone}
          placeholder="07XXXXXXXX"
          required
        />
        {messageEl}
        <button type="submit" disabled={sending} className={submitClass}>
          {sending ? <L si="යවමින්…" en="Sending…" /> : <L si="කේතය එවන්න" en="Send code" />}
        </button>
      </form>
    );
  }

  return (
    <form action={verify}>
      <p className="mt-5 text-sm text-muted">
        <L si={`කේතය ${phone} වෙත යැවිණි.`} en={`We sent a code to ${phone}.`} />
      </p>
      <Field
        label={<L si="කේතය" en="Code" />}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="[0-9]{6}"
        required
      />
      {messageEl}
      <button type="submit" disabled={verifying} className={submitClass}>
        {verifying ? <L si="ඇතුළු වෙමින්…" en="Signing in…" /> : <L si="ඇතුළු වන්න" en="Sign in" />}
      </button>
      <div className="mt-4 flex justify-between text-sm">
        <button
          type="button"
          disabled={sending}
          onClick={() => {
            const fd = new FormData();
            fd.set("phone", phone);
            setMessage(null);
            startTransition(() => sendCode(fd));
          }}
          className="text-muted underline hover:text-ink disabled:opacity-60"
        >
          <L si="නැවත යවන්න" en="Send again" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setStep("phone");
          }}
          className="text-muted underline hover:text-ink"
        >
          <L si="අංකය වෙනස් කරන්න" en="Change number" />
        </button>
      </div>
    </form>
  );
}

export default function SignInForm({
  callbackUrl,
  error,
  phoneEnabled,
}: {
  callbackUrl: string;
  error: string | null;
  phoneEnabled: boolean;
}) {
  const [tab, setTab] = useState<Tab>("signin");
  const errorMessage = signInErrorMessage(error);

  const tabClass = (t: Tab) =>
    `flex-1 border-b-2 pb-3 font-mono text-[0.7rem] uppercase tracking-[0.16em] transition-colors ${
      tab === t ? "border-blaze text-ink" : "border-transparent text-muted hover:text-ink"
    }`;

  return (
    <div className="mt-8">
      {errorMessage && (
        <p role="alert" className="mb-6 border border-blaze px-4 py-3 text-sm text-blaze">
          <Message code={errorMessage} />
        </p>
      )}

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: callbackUrl })}
        className="w-full rounded-full border border-line py-4 font-medium transition-colors hover:border-ink"
      >
        <L si="Google හරහා ඉදිරියට" en="Continue with Google" />
      </button>

      <div className="mt-8 flex" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signin"}
          onClick={() => setTab("signin")}
          className={tabClass("signin")}
        >
          <L si="ඇතුළු වන්න" en="Sign in" />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signup"}
          onClick={() => setTab("signup")}
          className={tabClass("signup")}
        >
          <L si="ගිණුමක් සාදන්න" en="Create account" />
        </button>
        {phoneEnabled && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "phone"}
            onClick={() => setTab("phone")}
            className={tabClass("phone")}
          >
            <L si="දුරකථනය" en="Phone" />
          </button>
        )}
      </div>

      {tab === "phone" && phoneEnabled ? (
        <PhonePanel callbackUrl={callbackUrl} />
      ) : tab === "signup" ? (
        <SignUpPanel callbackUrl={callbackUrl} />
      ) : (
        <SignInPanel callbackUrl={callbackUrl} />
      )}
    </div>
  );
}
