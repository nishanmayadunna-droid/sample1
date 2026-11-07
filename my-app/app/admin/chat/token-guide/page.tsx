import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { getChatSettingsForAdmin } from "@/lib/admin-chat";
import AdminTabs from "../../AdminTabs";
import TokenCalculator from "./TokenCalculator";

export const metadata: Metadata = { title: "Admin" };

export default async function TokenGuidePage() {
  await requireAdmin("/admin/chat/token-guide");
  const { ai } = await getChatSettingsForAdmin();
  // A rough starting point: about 4 characters a token, a short system prompt, up to 10 history messages and tool results.
  const defaults = { messagesPerDay: Math.min(ai.shopDailyCap, 500), inputTokens: 1500, outputTokens: Math.min(ai.maxReplyTokens, 300) };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="chat" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Token expenditure guide</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Only the AI engine costs money. The free Guided engine never calls a model. This page helps you estimate the AI
        engine&apos;s bill. <Link href="/admin/chat" className="underline">Back to the assistant settings</Link>.
      </p>

      <section className="mt-8 max-w-prose text-sm leading-relaxed">
        <h2 className="display text-2xl">What uses tokens</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Input</strong> is everything sent to the model on every message: the instructions, the last 10
            messages of the chat, and any product search or shop facts the model asked for. Longer chats cost more per
            message because the history is sent again.
          </li>
          <li>
            <strong>Output</strong> is the reply. You cap it with &quot;Longest reply (tokens)&quot;, currently {ai.maxReplyTokens}.
          </li>
          <li>
            A token is roughly 4 English characters; Sinhala usually takes more tokens for the same length, so test with real
            Sinhala messages before trusting an estimate.
          </li>
          <li>
            Your hard limits keep the bill bounded: at most {ai.shopDailyCap} AI messages a day for the whole shop, {ai.guestPerDay} per guest and {ai.userPerDay} per
            signed-in customer, and no message longer than {ai.maxMessageChars} characters.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="display text-2xl">Calculator</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          The token numbers are a starting guess from your current limits. Replace them with what you see in your provider&apos;s usage page.
        </p>
        <div className="mt-4">
          <TokenCalculator defaults={defaults} />
        </div>
        <p className="mt-6 max-w-prose text-sm text-muted">
          Worst case a day: your shop-wide cap ({ai.shopDailyCap}) times the cost per message. Set that cap to a number you are comfortable paying for every day.
        </p>
      </section>
    </div>
  );
}
