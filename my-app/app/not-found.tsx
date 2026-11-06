import type { Metadata } from "next";
import Link from "next/link";
import L from "./components/L";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">404</p>
      <h1 className="display mt-2 text-5xl">
        <L si="පිටුව හමු නොවීය" en="Page not found" />
      </h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-8 text-sm leading-relaxed">
        <L
          si="ඔබ සොයන පිටුව නොපවතී, නැතහොත් ඉවත් කර ඇත."
          en="The page you are looking for doesn't exist or has been removed."
        />
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/" className="bg-ink px-5 py-3 font-medium text-bg">
          <L si="මුල් පිටුව" en="Home" />
        </Link>
        <Link href="/products" className="border border-line px-5 py-3 font-medium">
          <L si="භාණ්ඩ බලන්න" en="Browse products" />
        </Link>
      </div>
    </div>
  );
}
