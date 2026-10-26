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
  email: string;
  name: string | null;
  image: string | null;
  passwordHash: string | null;
  googleId: string | null;
  role: Role;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  password_hash: string | null;
  google_id: string | null;
  role: Role;
  created_at: string;
};

const COLUMNS = "id, email, name, image, password_hash, google_id, role, created_at";
const BCRYPT_COST = 12;
// Postgres unique_violation: another row already has this email.
const UNIQUE_VIOLATION = "23505";

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    passwordHash: row.password_hash,
    googleId: row.google_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

function fail(error: unknown): never {
  console.error("users query failed", error);
  throw new Error("users query failed");
}

export function toExistingAccount(user: AppUser | null): ExistingAccount {
  return user ? { googleId: user.googleId, hasPassword: user.passwordHash !== null } : null;
}

async function findOne(column: "id" | "email" | "google_id", value: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(COLUMNS)
    .eq(column, value)
    .maybeSingle<UserRow>();
  if (error) fail(error);
  return data ? toAppUser(data) : null;
}

export function findUserByEmail(email: string): Promise<AppUser | null> {
  return findOne("email", normalizeEmail(email));
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
