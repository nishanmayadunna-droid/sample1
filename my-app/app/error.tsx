"use client";

import { useEffect } from "react";
import L from "./components/L";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // The digest matches the server log; never log the message or stack.
    console.error("page error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">500</p>
      <h1 className="display mt-2 text-5xl">
        <L si="යම් දෙයක් වැරදුණා" en="Something went wrong" />
      </h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-8 text-sm leading-relaxed">
        <L
          si="මෙම පිටුව පූරණය කිරීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න."
          en="We couldn't load this page. Please try again."
        />
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 bg-ink px-5 py-3 text-sm font-medium text-bg"
      >
        <L si="නැවත උත්සාහ කරන්න" en="Try again" />
      </button>
    </div>
  );
}
