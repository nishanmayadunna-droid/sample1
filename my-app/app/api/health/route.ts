import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

// Uptime probe: 200 when the database answers, 503 otherwise. No details leak.
export async function GET() {
  try {
    // Cookie-less client, same as lib/storefront.ts.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { error } = await supabase.from("store_settings").select("id").limit(1);
    if (error) return Response.json({ ok: false }, { status: 503, headers: HEADERS });
    return Response.json({ ok: true }, { headers: HEADERS });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: HEADERS });
  }
}
