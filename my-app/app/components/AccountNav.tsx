"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import L from "./L";

const linkClass = "text-muted transition-colors hover:text-ink";

// Session is fetched on the client so the root layout never calls auth(),
// which would make every catalog page dynamic.
export default function AccountNav() {
  const { data: session, status } = useSession();

  // Fixed-width slot while loading, so the nav doesn't jump.
  if (status === "loading") return <span className="inline-block w-20" aria-hidden />;

  if (!session?.user) {
    return (
      <Link href="/signin" className={linkClass}>
        <L si="ඇතුළු වන්න" en="Sign in" />
      </Link>
    );
  }

  return (
    <>
      {session.user.role === "admin" && (
        <Link href="/admin" className={linkClass}>
          Admin
        </Link>
      )}
      <Link href="/orders" className={linkClass}>
        <L si="මගේ ඇණවුම්" en="My orders" />
      </Link>
      <Link href="/account" className={`${linkClass} max-w-32 truncate`}>
        {session.user.name ?? session.user.email ?? <L si="ගිණුම" en="Account" />}
      </Link>
    </>
  );
}
