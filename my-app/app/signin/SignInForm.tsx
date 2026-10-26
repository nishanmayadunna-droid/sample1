"use client";

import { useActionState, useState } from "react";
import { signIn } from "next-auth/react";
import { signUpAction, type SignUpState } from "./actions";

type Tab = "signin" | "signup";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "This email uses a password. Sign in with your password.",
  CredentialsSignin: "Invalid email or password.",
};

function messageForError(code: string | null): string | null {
  if (!code) return null;
  // hasOwn: `?error=constructor` must not resolve to Object.prototype members.
  return Object.hasOwn(ERROR_MESSAGES, code)
    ? ERROR_MESSAGES[code]
    : "Sign-in failed. Please try again.";
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
): Promise<string | null> {
  const result = await signIn("credentials", { email, password, redirect: false });
  if (result?.code === "google_account") return "This account uses Google sign-in.";
  if (!result || result.error) return "Invalid email or password.";
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
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      <input className={inputClass} {...input} />
      {error && <span className="mt-1 block text-sm text-blaze">{error}</span>}
    </label>
  );
}

function SignInPanel({ callbackUrl }: { callbackUrl: string }) {
  const [message, submit, pending] = useActionState(
    async (_prev: string | null, formData: FormData) =>
      passwordSignIn(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
        callbackUrl,
      ),
    null,
  );

  return (
    <form action={submit}>
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {message && <p className="mt-4 text-sm text-blaze">{message}</p>}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Signing in…" : "Sign in"}
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
        label="Name (optional)"
        name="name"
        type="text"
        autoComplete="name"
        maxLength={100}
        error={state.errors.name}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.errors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        error={state.errors.password}
      />
      {state.formError && <p className="mt-4 text-sm text-blaze">{state.formError}</p>}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export default function SignInForm({
  callbackUrl,
  error,
}: {
  callbackUrl: string;
  error: string | null;
}) {
  const [tab, setTab] = useState<Tab>("signin");
  const errorMessage = messageForError(error);

  const tabClass = (t: Tab) =>
    `flex-1 border-b-2 pb-3 font-mono text-[0.7rem] uppercase tracking-[0.16em] transition-colors ${
      tab === t ? "border-blaze text-ink" : "border-transparent text-muted hover:text-ink"
    }`;

  return (
    <div className="mt-8">
      {errorMessage && (
        <p role="alert" className="mb-6 border border-blaze px-4 py-3 text-sm text-blaze">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: callbackUrl })}
        className="w-full rounded-full border border-line py-4 font-medium transition-colors hover:border-ink"
      >
        Continue with Google
      </button>

      <div className="mt-8 flex" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signin"}
          onClick={() => setTab("signin")}
          className={tabClass("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signup"}
          onClick={() => setTab("signup")}
          className={tabClass("signup")}
        >
          Create account
        </button>
      </div>

      {tab === "signin" ? (
        <SignInPanel callbackUrl={callbackUrl} />
      ) : (
        <SignUpPanel callbackUrl={callbackUrl} />
      )}
    </div>
  );
}
