"use client";

import { signOut } from "next-auth/react";

// Client-side sign-out does a full navigation, so the Header's session state
// is fresh afterwards.
export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectTo: "/" })}
      className="rounded-full border border-line px-6 py-3 font-medium transition-colors hover:border-ink"
    >
      Sign out
    </button>
  );
}
