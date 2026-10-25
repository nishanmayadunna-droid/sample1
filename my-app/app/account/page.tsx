import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guards";
import SignOutButton from "../components/SignOutButton";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");

  const details = [
    ["Email", user.email],
    ["Sign-in method", user.googleId ? "Google" : "Password"],
    ["Account type", user.role === "admin" ? "Admin" : "Customer"],
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">Your account</p>
      <h1 className="display mt-2 text-5xl">{user.name ?? user.email}</h1>
      <div className="measure mt-6 text-ink" />
      <dl className="mt-8 divide-y divide-line border-y border-line">
        {details.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-4">
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
