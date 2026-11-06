import type { Metadata } from "next";
import { isTokenShape } from "@/lib/email";
import { AUTH_MESSAGES } from "@/lib/auth-messages";
import ConfirmLinkButton from "../components/ConfirmLinkButton";
import L from "../components/L";
import { confirmEmailAction } from "./actions";

// The token is in the URL, so keep it out of Referer headers and search engines.
export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <h1 className="display text-4xl">
        <L si="ඊමේල් එක තහවුරු කරන්න" en="Confirm your email" />
      </h1>
      {isTokenShape(token) ? (
        <ConfirmLinkButton
          token={token}
          action={confirmEmailAction}
          label={{ si: "තහවුරු කරන්න", en: "Confirm my email" }}
          done={AUTH_MESSAGES.emailVerified}
        />
      ) : (
        <p className="mt-6 text-muted">
          <L {...AUTH_MESSAGES.linkInvalid} />
        </p>
      )}
    </div>
  );
}
