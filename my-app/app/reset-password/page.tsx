import type { Metadata } from "next";
import Link from "next/link";
import { isTokenShape } from "@/lib/email";
import { AUTH_MESSAGES } from "@/lib/auth-messages";
import L from "../components/L";
import ResetPasswordForm from "./ResetPasswordForm";

// The token is in the URL, so keep it out of Referer headers and search engines.
export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Opening the link never changes anything: only submitting the form does.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <h1 className="display text-5xl">
        <L si="අලුත් මුරපදයක්" en="Choose a new password" />
      </h1>
      <div className="measure mt-6 text-ink" />
      {isTokenShape(token) ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            <L {...AUTH_MESSAGES.linkInvalid} />
          </p>
          <p className="mt-4 text-sm">
            <Link href="/forgot-password" className="text-blaze underline underline-offset-4">
              <L si="අලුත් සබැඳියක් ඉල්ලන්න" en="Ask for a new link" />
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
