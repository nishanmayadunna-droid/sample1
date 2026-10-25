# Auth (NextAuth / Auth.js v5) — Design

Date: 2026-10-25
Status: Approved in brainstorming, pending written-spec review
Scope: Spec 1 of 2. Spec 2 (cart sync to the account) is separate and comes later.

## Goal

Add user accounts to the Northbound storefront with two account types, **user** and
**admin**, so a later spec can add an admin page for uploading and editing products.

Success means:

- Anyone can create an account with email + password, or sign in with Google.
- Signed-in users see their account at `/account` and can sign out.
- Only users whose `role` is `admin` in the database can open `/admin`.
- Catalog pages (`/`, `/products`, `/products/[id]`, `/cart`) stay static/ISR.

## Decisions

| Topic | Decision |
|---|---|
| Library | Auth.js v5, `next-auth@5.0.0-beta.32` pinned exactly |
| Sign-in methods | Google OAuth + email/password (Credentials provider) |
| Session strategy | JWT (required by the Credentials provider) |
| User storage | Own `public.users` table in Supabase, no Auth.js adapter |
| Admin assignment | `role` column, changed in the Supabase dashboard (or a script) |
| Password reset / email verification | Out of scope (later spec) |
| Account linking | Never automatic; email is unique and a conflicting provider is rejected |
| Password hashing | `bcryptjs`, cost 12 |
| Tests | Add Vitest for pure logic; manual checklist for DB/OAuth flows |

## Data

New migration `supabase/migrations/<version>_create_users.sql`, applied to the remote
project and saved locally with the matching version, per the existing workflow.

```sql
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,            -- stored trimmed + lowercased
  name          text,
  image         text,
  password_hash text,                            -- null for Google-only users
  google_id     text unique,                     -- null for password-only users
  role          text not null default 'user' check (role in ('user', 'admin')),
  created_at    timestamptz not null default now(),
  check (password_hash is not null or google_id is not null)
);

alter table public.users enable row level security;
-- No policies. Only the server's secret key can read or write this table.
revoke all on table public.users from anon, authenticated;
```

A user has exactly one sign-in method: either `password_hash` or `google_id` is set,
not both, because accounts are never linked (see Account linking).

## Modules

| File | Responsibility |
|---|---|
| `auth.ts` (project root) | Auth.js config: Google + Credentials providers, `jwt`/`session` callbacks, `signIn` callback applying account-linking rules. Exports `auth`, `signIn`, `signOut`, `handlers`. |
| `app/api/auth/[...nextauth]/route.ts` | Re-exports `handlers` as `GET`/`POST`. |
| `lib/supabase/admin.ts` | Cookie-less supabase-js client using `SUPABASE_SECRET_KEY`. Imports `server-only`. |
| `lib/users.ts` | Server-only data access: `findUserByEmail`, `findUserByGoogleId`, `createPasswordUser`, `createGoogleUser`, `getUserRole`. Maps snake_case rows to a camelCase `AppUser` type, like `lib/catalog.ts`. |
| `lib/auth-rules.ts` | Pure, testable functions: `validateSignUp`, `normalizeEmail`, `resolveGoogleSignIn`, `safeCallbackUrl`. No I/O. |
| `lib/auth-guards.ts` | Server-only `requireUser()` and `requireAdmin()`, the authoritative checks used by pages and Server Actions. |
| `proxy.ts` | Optimistic redirect for `/account` and `/admin` to `/signin?callbackUrl=…` when there is no session. Not a security boundary. |

### Session contents

The JWT carries `id` and `role`, exposed on `session.user`. The `role` in the token is
for display only (for example the Header's Admin link). `requireAdmin()` always re-reads
the role from the database, so removing an admin in the dashboard takes effect on the
next request instead of when the token expires.

### Keeping catalog pages static

The root layout does **not** call `auth()`; doing so would make every route dynamic and
drop ISR. The Header is already a client component, so it reads the session through
`SessionProvider` + `useSession()`, which fetches `/api/auth/session` on the client.
Only `/signin`, `/account` and `/admin` are dynamic.

## UI

| Route | Contents |
|---|---|
| `/signin` | Tabs "Sign in" and "Create account", with "Continue with Google" above both. Honors `?callbackUrl=` (same-origin paths only) and shows messages for `?error=`. |
| `/account` | Guarded by `requireUser()`. Shows name, email, sign-in method (Google or Password), account type, and a Sign out button. |
| `/admin` | Guarded by `requireAdmin()`. Placeholder: "Products management coming soon". |

**Header:** next to the Cart link, show "Sign in" when signed out; the user's name
linking to `/account` when signed in; plus an "Admin" link when `session.user.role` is
`admin`. While `status === "loading"`, render a fixed-width empty slot so the layout
doesn't shift (same idea as the cart's `hydrated` flag).

**Styling:** existing Northbound tokens and classes (`bg-panel`, `text-blaze`,
`.display`, `.eyebrow`, `.measure`). All UI copy is English, like the rest of the store.

## Flows

### Sign up (password)

1. Form posts to a Server Action, which uses `useActionState` for field errors.
2. `validateSignUp`: email has a valid format; password is 8–72 characters (bcrypt
   ignores bytes after 72); name is optional, trimmed, at most 100 characters.
3. Normalize email. If a user with that email exists, return
   "This email already has an account."
4. Hash the password and insert a row with `role = 'user'`.
5. Call `signIn("credentials", …)` and redirect to the safe `callbackUrl` or `/account`.

### Sign in (password)

`authorize()` normalizes the email and looks the user up.

- No user, or wrong password: return `null`. The page shows
  "Invalid email or password." for both, so it doesn't reveal which emails exist.
- User exists but has no `password_hash` (Google-only): reject; the page shows
  "This account uses Google sign-in."
- Otherwise return `{ id, email, name, image, role }`.

### Sign in with Google

The `signIn` callback calls `resolveGoogleSignIn(existingUser, profile)`, which returns
one of `allow`, `create` or `reject`:

| Situation | Result |
|---|---|
| `profile.email_verified` is not true | `reject` |
| A user with this `google_id` exists | `allow` |
| A user with this email exists but has no `google_id` (password account) | `reject` → `/signin?error=OAuthAccountNotLinked`, shown as "This email uses a password. Sign in with your password." |
| No user with this email | `create` (insert with `google_id`, `role = 'user'`) |

The same rule applies in reverse: password sign-up rejects an email already used by a
Google account (step 3 of Sign up).

### Sign out

A Server Action form calls `signOut({ redirectTo: "/" })`.

### Access rules

| Visitor | `/account` | `/admin` |
|---|---|---|
| Signed out | Redirect to `/signin?callbackUrl=…` | Redirect to `/signin?callbackUrl=…` |
| Signed in, `role = 'user'` | Allowed | `notFound()` (404), so the page's existence isn't revealed |
| Signed in, `role = 'admin'` | Allowed | Allowed |

## Error handling

- Sign-up validation errors appear under the relevant field.
- Auth.js errors (`CredentialsSignin`, `OAuthAccountNotLinked`, `AccessDenied`) arrive
  as `/signin?error=` and map to the plain English messages above; unknown codes show
  "Sign-in failed. Please try again."
- Supabase errors are logged on the server only. The user sees
  "Something went wrong, please try again."

## Security

- Email is trimmed and lowercased before every lookup and insert.
- `safeCallbackUrl` accepts only paths starting with a single `/` (not `//`), else
  falls back to `/account`, preventing open redirects.
- CSRF protection comes from Auth.js and the Server Actions origin check.
- `SUPABASE_SECRET_KEY` is imported only by `server-only` modules.
- `public.users` has RLS on, no policies and no grants for `anon`/`authenticated`.
- **Known risk, accepted for now:** no login rate limiting, so password guessing is
  not throttled. Listed under Out of scope.

## Configuration

New entries in `.env.local` (git-ignored):

- `AUTH_SECRET` (generated with `npx auth secret` or `openssl rand -base64 32`)
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

`SUPABASE_SECRET_KEY` already exists. The user creates the Google OAuth client in
Google Cloud Console with redirect URI `http://localhost:3000/api/auth/callback/google`
and adds the values to `.env.local` themselves.

New dependencies: `next-auth@5.0.0-beta.32`, `bcryptjs`, `server-only`; dev: `vitest`.
New script: `"test": "vitest run"`.

## Testing

**Unit (Vitest)** on `lib/auth-rules.ts`:

- `validateSignUp`: valid input; bad email; password of 7, 8, 72 and 73 characters;
  long name.
- `normalizeEmail`: trims and lowercases.
- `resolveGoogleSignIn`: every row of the Google table above.
- `safeCallbackUrl`: `/cart` kept; `//evil.com`, `https://evil.com`, empty and missing
  fall back to `/account`.

**Manual checklist** (in-app browser, dev server):

1. Create an account with a password, sign out, sign in again.
2. Wrong password and unknown email both show the same message.
3. Sign in with Google creates a new user.
4. Google sign-in with an email that has a password account is rejected with the
   linking message; password sign-up with a Google account's email is rejected.
5. Signed out, `/account` and `/admin` redirect to `/signin` and return after sign-in.
6. Signed-in non-admin gets 404 on `/admin`.
7. Set `role = 'admin'` in the dashboard: `/admin` opens and the Header shows Admin.
   Set it back to `user`: `/admin` returns 404 on the next request.
8. Header shows no layout jump while the session loads.

**Build checks:** `npm run lint`, `npm test` and `npm run build` pass, and the build
output still lists `/` and `/products/[id]` as static/ISR.

## Out of scope

- Cart sync to the account (Spec 2)
- Admin product upload and editing
- Password reset and email verification
- Login rate limiting
- Users editing their own profile
- Managing roles from inside the app

## Documentation

Update `CLAUDE.md` once implemented: the auth architecture, the `users` table, the new
env vars, `npm test`, and the rule that the root layout must not call `auth()`.
