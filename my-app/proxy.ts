// Optimistic redirect only: sends signed-out visitors to /signin before the
// page renders. The real access checks are requireUser()/requireAdmin() in
// lib/auth-guards.ts, which every protected page calls.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (req.auth) return;
  const { pathname, search } = req.nextUrl;
  const url = new URL("/signin", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(url);
});

// Server Actions POST to the current page URL. The auth() wrapper re-sets the
// session cookie on every request it handles, so an action that finishes after
// sign-out would sign the user back in; skip them (they check auth themselves).
// Matcher values must be inline literals: Next ignores variables here.
export const config = {
  matcher: [
    {
      source: "/account/:path*",
      missing: [{ type: "header", key: "next-action" }],
    },
    {
      source: "/admin/:path*",
      missing: [{ type: "header", key: "next-action" }],
    },
  ],
};
