// Real dependencies for POST /api/chat (server only). The rules and refusal paths live in
// lib/chat-ai.ts and are tested there with fakes.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { allowRequest } from "./email-data";
import { clientIp } from "./email";
import { getAllProducts } from "./catalog";
import { matchesQuery } from "./product-filters";
import { buildSystemPrompt, runModel, toolResultForProducts, type ChatDeps } from "./chat-ai";
import { buildFacts } from "./chat-data";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

export function realChatDeps(request: Request): ChatDeps {
  return {
    settings: async () => {
      const { data, error } = await supabase.from("chat_settings").select("*").maybeSingle();
      return error ? null : data;
    },
    apiKey: () => process.env.ANTHROPIC_API_KEY,
    userId: async () => (await auth())?.user?.id ?? null,
    ip: () => clientIp((name) => request.headers.get(name)),
    allow: allowRequest,
    dailyHit: async (cap) => {
      const { data, error } = await supabaseAdmin.rpc("chat_daily_hit", { p_cap: cap });
      if (error) throw new Error("chat_daily_hit failed");
      return data === true;
    },
    productIds: async () => new Set((await getAllProducts()).map((p) => p.id)),
    model: async ({ settings, messages, productId }) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("no key");
      const [facts, products] = await Promise.all([buildFacts(), getAllProducts()]);
      let system = buildSystemPrompt({ assistantName: settings.assistantName, facts, trust: settings.trust });
      const viewing = productId ? products.find((p) => p.id === productId) : undefined;
      // The name is catalog data, passed as data like any tool result.
      if (viewing) system += `\nThe customer is looking at this product page (data): ${JSON.stringify(viewing.name)}.`;
      return runModel({
        apiKey,
        settings,
        system,
        messages,
        tools: {
          search_products: async (query) => toolResultForProducts(products.filter((p) => matchesQuery(p, query))),
          shop_facts: async () => facts,
        },
      });
    },
  };
}
