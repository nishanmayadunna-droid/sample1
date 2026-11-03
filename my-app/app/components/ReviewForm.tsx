"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SessionProvider, useSession } from "next-auth/react";
import { useLang } from "@/app/context/LangContext";
import { tr } from "@/lib/i18n";
import { MAX_REVIEW_LENGTH, type ReviewMessage } from "@/lib/reviews";
import { submitReview } from "@/app/products/[id]/review-actions";
import L from "./L";

function Form({ productId }: { productId: string }) {
  const { status } = useSession();
  const lang = useLang();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<ReviewMessage | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "loading") return null;
  if (status !== "authenticated") {
    return (
      <p className="text-sm">
        <Link
          href={`/signin?callbackUrl=${encodeURIComponent(`/products/${productId}`)}`}
          className="text-blaze underline underline-offset-4"
        >
          <L si="සමාලෝචනයක් ලිවීමට පිවිසෙන්න" en="Sign in to write a review" />
        </Link>
      </p>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitReview(productId, rating, body);
      setMessage(result.message);
      if (result.message === "saved") {
        setRating(0);
        setBody("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3">
      <fieldset>
        <legend className="eyebrow mb-2 text-muted">
          <L si="ඔබේ ඇගයීම" en="Your rating" />
        </legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-pressed={rating === n}
              aria-label={tr(lang, `තරු ${n}`, `${n} stars`)}
              className={`text-2xl leading-none ${n <= rating ? "text-blaze" : "text-line hover:text-muted"}`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="eyebrow text-muted">
          <L si="ඔබේ අදහස" en="Your review" />
        </span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={MAX_REVIEW_LENGTH}
          rows={4}
          className="mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink"
        />
      </label>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-blaze px-6 py-3 font-medium text-white disabled:opacity-40"
        >
          <L si="යවන්න" en="Submit review" />
        </button>
        {message && (
          <span role="status" className={`text-sm ${message === "saved" ? "text-muted" : "text-blaze"}`}>
            {message === "saved" && (
              <L si="ස්තූතියි! අනුමත වූ පසු ඔබේ සමාලෝචනය පෙනේ." en="Thanks! Your review will appear after approval." />
            )}
            {message === "rating" && <L si="තරු ගණනක් තෝරන්න." en="Pick a star rating." />}
            {message === "body" && (
              <L si="අදහසක් ලියන්න (අකුරු 1000 දක්වා)." en="Write a short comment (up to 1000 characters)." />
            )}
            {message === "error" && <L si="යම් දෝෂයක් සිදු විය. නැවත උත්සාහ කරන්න." en="Something went wrong, please try again." />}
          </span>
        )}
      </div>
    </form>
  );
}

/** The page sits outside the Header's SessionProvider, so the form brings its own. */
export default function ReviewForm({ productId }: { productId: string }) {
  return (
    <SessionProvider>
      <Form productId={productId} />
    </SessionProvider>
  );
}
