import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guards";
import SignOutButton from "../components/SignOutButton";
import L from "../components/L";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");

  const details: { key: string; label: React.ReactNode; value: React.ReactNode }[] = [
    { key: "email", label: <L si="ඊමේල්" en="Email" />, value: user.email },
    {
      key: "method",
      label: <L si="ඇතුළු වන ක්‍රමය" en="Sign-in method" />,
      value: user.googleId ? "Google" : <L si="මුරපදය" en="Password" />,
    },
    {
      key: "role",
      label: <L si="ගිණුම් වර්ගය" en="Account type" />,
      value:
        user.role === "admin" ? <L si="පරිපාලක" en="Admin" /> : <L si="පාරිභෝගික" en="Customer" />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">
        <L si="ඔබේ ගිණුම" en="Your account" />
      </p>
      <h1 className="display mt-2 text-5xl">{user.name ?? user.email}</h1>
      <div className="measure mt-6 text-ink" />
      <dl className="mt-8 divide-y divide-line border-y border-line">
        {details.map(({ key, label, value }) => (
          <div key={key} className="flex justify-between gap-4 py-4">
            <dt className="eyebrow text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
