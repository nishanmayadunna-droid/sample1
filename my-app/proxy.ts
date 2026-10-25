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

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
