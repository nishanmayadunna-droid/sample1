// Authoritative access checks for protected pages and Server Actions.
// proxy.ts only does an optimistic redirect; these are the real gate.
import "server-only";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findUserById, getUserRole, type AppUser } from "@/lib/users";

export async function requireUser(callbackPath: string): Promise<AppUser> {
  const session = await auth();
  const user = session?.user?.id ? await findUserById(session.user.id) : null;
  if (!user) {
    redirect("/signin?callbackUrl=" + encodeURIComponent(callbackPath));
  }
  return user;
}

/** Signed-in non-admins get a 404 so the admin area's existence isn't revealed. */
export async function requireAdmin(callbackPath: string): Promise<AppUser> {
  const user = await requireUser(callbackPath);
  // Re-read the role rather than trusting the JWT, so a demotion applies at once.
  if ((await getUserRole(user.id)) !== "admin") notFound();
  return user;
}
