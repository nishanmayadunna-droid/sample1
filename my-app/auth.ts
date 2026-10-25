// Auth.js v5 config. JWT sessions, no adapter: accounts live in public.users
// (lib/users.ts). The JWT's role is for display only; lib/auth-guards.ts
// re-reads it from the database for anything that grants access.
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { resolveGoogleSignIn } from "@/lib/auth-rules";
import {
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  toExistingAccount,
  verifyPassword,
} from "@/lib/users";

/** Password sign-in attempted on an account that only has Google sign-in. */
export class GoogleAccountError extends CredentialsSignin {
  code = "google_account";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const { email, password } = credentials;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await findUserByEmail(email);
        if (!user) return null;
        if (!user.passwordHash) throw new GoogleAccountError();
        if (!(await verifyPassword(user, password))) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email) return false;

      const googleId = account.providerAccountId;
      const [byGoogleId, byEmail] = await Promise.all([
        findUserByGoogleId(googleId),
        findUserByEmail(profile.email),
      ]);
      const decision = resolveGoogleSignIn(
        toExistingAccount(byGoogleId),
        toExistingAccount(byEmail),
        {
          email: profile.email,
          emailVerified: profile.email_verified === true,
          googleId,
        },
      );

      if (decision.action === "allow") return true;
      if (decision.action === "create") {
        await createGoogleUser({
          email: decision.email,
          name: typeof profile.name === "string" ? profile.name : null,
          image: typeof profile.picture === "string" ? profile.picture : null,
          googleId,
        });
        return true;
      }
      if (decision.reason === "password_account") {
        return "/signin?error=OAuthAccountNotLinked";
      }
      return false;
    },

    // Runs on sign-in (with `user`/`account`) and on every session read
    // (token only). Only sign-in touches the database.
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        const dbUser = await findUserByGoogleId(account.providerAccountId);
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      } else if (account?.provider === "credentials" && user?.id) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
});
