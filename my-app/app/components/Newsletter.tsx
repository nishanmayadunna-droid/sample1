"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("done"); // Demo only — no request is sent.
  }

  return (
    <section className="bg-panel text-panelink">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="eyebrow text-panelmuted">The dispatch</span>
          <h2 className="display mt-3 text-[clamp(1.75rem,4vw,2.75rem)]">
            Field notes, restocks,
            <br />
            and first look at drops.
          </h2>
          <p className="mt-4 max-w-md text-panelmuted">
            One email a month. No noise — just new kit and the occasional repair
            tip. Unsubscribe any time.
          </p>
        </div>

        {status === "done" ? (
          <div className="rounded-xl border border-white/15 p-6">
            <p className="display text-xl text-blaze">You&apos;re on the list</p>
            <p className="mt-2 text-panelmuted">
              Watch your inbox for the next dispatch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="lg:justify-self-end lg:w-full lg:max-w-md">
            <label
              htmlFor="newsletter-email"
              className="eyebrow text-panelmuted"
            >
              Email address
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder="you@example.com"
                aria-invalid={status === "error"}
                className="w-full rounded-full border border-white/20 bg-white/5 px-5 py-3 text-panelink placeholder:text-panelmuted focus:border-blaze focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                Subscribe
              </button>
            </div>
            {status === "error" && (
              <p className="mt-2 font-mono text-xs text-blaze">
                Enter a valid email address to continue.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
