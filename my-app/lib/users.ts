// Server-side access to the public.users table (app accounts for Auth.js).
import "server-only";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeEmail,
  type ExistingAccount,
  type Role,
  type SignUpInput,
} from "@/lib/auth-rules";

export type AppUser = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  image: string | null;
  passwordHash: string | null;
  googleId: string | null;
  role: Role;
  createdAt: string;
  /** When the owner of the address confirmed it by email; Google accounts count as verified. */
  emailVerifiedAt: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  image: string | null;
  password_hash: string | null;
  google_id: string | null;
  role: Role;
  created_at: string;
  email_verified_at: string | null;
};

const COLUMNS = "id, email, phone, name, image, password_hash, google_id, role, created_at, email_verified_at";
const BCRYPT_COST = 12;
// Postgres unique_violation: another row already has this email.
const UNIQUE_VIOLATION = "23505";

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    name: row.name,
    image: row.image,
    passwordHash: row.password_hash,
    googleId: row.google_id,
    role: row.role,
    createdAt: row.created_at,
    emailVerifiedAt: row.email_verified_at,
  };
}

function fail(error: unknown): never {
  console.error("users query failed", error);
  throw new Error("users query failed");
}

/** Phone queries: the error details can contain the phone number, so log only the code. */
function failPhone(error: { code?: string }): never {
  console.error("users phone query failed", error.code ?? "unknown");
  throw new Error("users query failed");
}

export function toExistingAccount(user: AppUser | null): ExistingAccount {
  return user ? { googleId: user.googleId, hasPassword: user.passwordHash !== null } : null;
}

async function findOne(column: "id" | "email" | "google_id" | "phone", value: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(COLUMNS)
    .eq(column, value)
    .maybeSingle<UserRow>();
  if (error) return column === "phone" ? failPhone(error) : fail(error);
  return data ? toAppUser(data) : null;
}

export function findUserByEmail(email: string): Promise<AppUser | null> {
  return findOne("email", normalizeEmail(email));
}

export function findUserByPhone(phone: string): Promise<AppUser | null> {
  return findOne("phone", phone);
}

export function findUserById(id: string): Promise<AppUser | null> {
  return findOne("id", id);
}

export function findUserByGoogleId(googleId: string): Promise<AppUser | null> {
  return findOne("google_id", googleId);
}

export async function createPasswordUser(
  input: SignUpInput,
): Promise<AppUser | "exists"> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      email: normalizeEmail(input.email),
      name: input.name,
      password_hash: passwordHash,
    })
    .select(COLUMNS)
    .single<UserRow>();
  if (error?.code === UNIQUE_VIOLATION) return "exists";
  if (error) fail(error);
  return toAppUser(data);
}

export async function createGoogleUser(input: {
  email: string;
  name: string | null;
  image: string | null;
  googleId: string;
}): Promise<AppUser> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      email: normalizeEmail(input.email),
      name: input.name,
      image: input.image,
      google_id: input.googleId,
    })
    .select(COLUMNS)
    .single<UserRow>();
  if (error) fail(error);
  return toAppUser(data);
}

/** Creates a phone-only account; on a race with another sign-in, returns the existing row. */
export async function createPhoneUser(phone: string): Promise<AppUser> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({ phone })
    .select(COLUMNS)
    .single<UserRow>();
  if (error?.code === UNIQUE_VIOLATION) {
    const existing = await findUserByPhone(phone);
    if (existing) return existing;
  }
  if (error) failPhone(error);
  return toAppUser(data);
}

export async function verifyPassword(
  user: AppUser,
  password: string,
): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function getUserRole(id: string): Promise<Role | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", id)
    .maybeSingle<{ role: Role }>();
  if (error) fail(error);
  return data?.role ?? null;
}

/** True when the account's email is confirmed (Google confirms it itself). */
export function isEmailVerified(user: Pick<AppUser, "emailVerifiedAt" | "googleId">): boolean {
  return user.emailVerifiedAt !== null || user.googleId !== null;
}

/** Sets a new password hash (the caller hashed it with the same cost as sign-up). */
export async function setPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const { error } = await supabaseAdmin
    .from("users")
    // Resetting by email proves the owner reads this inbox, so the address counts as verified.
    .update({ password_hash: passwordHash, email_verified_at: new Date().toISOString() })
    .eq("id", userId)
    .not("password_hash", "is", null);
  if (error) fail(error);
}

export async function markEmailVerified(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("users")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", userId)
    .is("email_verified_at", null);
  if (error) fail(error);
}
