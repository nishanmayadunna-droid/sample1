import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { safeCallbackUrl } from "@/lib/auth-rules";
import SignInForm from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const destination = safeCallbackUrl(callbackUrl);

  const session = await auth();
  if (session?.user) redirect(destination);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">Northbound account</p>
      <h1 className="display mt-2 text-5xl">Sign in</h1>
      <div className="measure mt-6 text-ink" />
      <SignInForm callbackUrl={destination} error={error ?? null} />
    </div>
  );
}
