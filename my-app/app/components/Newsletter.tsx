"use client";

import { useState, useTransition } from "react";
import { subscribeNewsletter } from "../newsletter-actions";
import L from "./L";

type Status = "idle" | "done" | "invalid" | "busy" | "unavailable" | "error";

export default function Newsletter() {
  const [status, setStatus] = useState<Status>("idle");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await subscribeNewsletter(formData);
        setStatus(result.message === "confirm" ? "done" : result.message);
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <section className="bg-panel text-panelink">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="eyebrow text-panelmuted">
            <L si="පුවත් ලිපිය" en="The dispatch" />
          </span>
          <h2 className="display mt-3 text-[clamp(1.75rem,4vw,2.75rem)]">
            <L
              si="අලුත් එකතු, නැවත ආ තොග සහ නව නිකුතු මුලින්ම."
              en="Field notes, restocks, and first look at drops."
            />
          </h2>
          <p className="mt-4 max-w-md text-panelmuted">
            <L
              si="මසකට එක ඊමේල් එකක්. අනවශ්‍ය දේ නැහැ — අලුත් භාණ්ඩ සහ ඉඳහිට උපදෙස්. ඕනෑම වෙලාවක ඉවත් විය හැක."
              en="One email a month. No noise — just new kit and the occasional repair tip. Unsubscribe any time."
            />
          </p>
        </div>

        {status === "done" ? (
          <div className="rounded-xl border border-white/15 p-6">
            <p className="display text-xl text-blaze">
              <L si="ඔබේ ඊමේල් එක පරීක්ෂා කරන්න" en="Check your email" />
            </p>
            <p className="mt-2 text-panelmuted">
              <L
                si="තහවුරු කරන සබැඳියක් යැව්වා. එය ක්ලික් කළ පසු ඔබ ලැයිස්තුවට එක් වේ."
                en="We sent a link to confirm. You join the list once you click it."
              />
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="lg:justify-self-end lg:w-full lg:max-w-md">
            <label
              htmlFor="newsletter-email"
              className="eyebrow text-panelmuted"
            >
              <L si="ඊමේල් ලිපිනය" en="Email address" />
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="newsletter-email"
                name="email"
                type="email"
                onChange={() => {
                  if (status !== "idle") setStatus("idle");
                }}
                placeholder="you@example.com"
                aria-invalid={status === "invalid"}
                className="w-full rounded-full border border-white/20 bg-white/5 px-5 py-3 text-panelink placeholder:text-panelmuted focus:border-blaze focus:outline-none"
              />
              <button
                type="submit"
                disabled={pending}
                className="shrink-0 rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                <L si="ලියාපදිංචි වන්න" en="Subscribe" />
              </button>
            </div>
            {/* Honeypot: hidden from people and assistive tech, still submitted. */}
            <input
              type="text"
              name="nb_hp"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              defaultValue=""
              className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
            />
            {status === "invalid" && (
              <p role="alert" className="mt-2 font-mono text-xs text-blaze">
                <L si="ඉදිරියට යාමට වලංගු ඊමේල් ලිපිනයක් දෙන්න." en="Enter a valid email address to continue." />
              </p>
            )}
            {status === "busy" && (
              <p role="alert" className="mt-2 font-mono text-xs text-blaze">
                <L si="දැන් ඉතා කාර්යබහුලයි. පසුව නැවත උත්සාහ කරන්න." en="We're busy right now. Please try again later." />
              </p>
            )}
            {status === "unavailable" && (
              <p role="alert" className="mt-2 font-mono text-xs text-blaze">
                <L si="දැනට ලියාපදිංචි වීම විවෘත නැත. පසුව බලන්න." en="Sign-ups aren't open yet. Please check back soon." />
              </p>
            )}
            {status === "error" && (
              <p role="alert" className="mt-2 font-mono text-xs text-blaze">
                <L si="යමක් වැරදුණා. නැවත උත්සාහ කරන්න." en="Something went wrong. Please try again." />
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
