"use client";

import { signOut } from "next-auth/react";
import { prepareCartForSignOut } from "./CartSync";

// Client-side sign-out does a full navigation, so the Header's session state
// is fresh afterwards. A pending cart save is flushed first so a change made
// just before signing out isn't lost, and in-flight syncs finish so they
// can't restore the session cookie; CartSync then clears the browser cart.
export default function SignOutButton() {
  async function handleSignOut() {
    await prepareCartForSignOut();
    await signOut({ redirectTo: "/" });
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="rounded-full border border-line px-6 py-3 font-medium transition-colors hover:border-ink"
    >
      Sign out
    </button>
  );
}
