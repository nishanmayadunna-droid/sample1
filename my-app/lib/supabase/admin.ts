import "server-only";
import { createClient } from "@supabase/supabase-js";

// Secret-key client for server-only data such as public.users, which has RLS on
// and no client policies. It bypasses RLS, so never import it from client code
// (the "server-only" import above turns that into a build error). Cookie-less,
// like lib/catalog.ts, so using it doesn't make a route dynamic.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
