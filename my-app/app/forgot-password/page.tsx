import type { Metadata } from "next";
import Link from "next/link";
import L from "../components/L";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">
        <L si="Northbound ගිණුම" en="Northbound account" />
      </p>
      <h1 className="display mt-2 text-5xl">
        <L si="මුරපදය අමතකද?" en="Forgot password" />
      </h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 text-sm text-muted">
        <L
          si="ඔබේ ඊමේල් ලිපිනය ඇතුළත් කරන්න. මුරපද ගිණුමක් ඇත්නම්, මුරපදය යළි සකසන සබැඳියක් එවමු."
          en="Enter your email address. If it has a password account, we'll send a link to choose a new one."
        />
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm">
        <Link href="/signin" className="text-blaze underline underline-offset-4">
          <L si="ඇතුළු වීමට ආපසු" en="Back to sign in" />
        </Link>
      </p>
    </div>
  );
}
