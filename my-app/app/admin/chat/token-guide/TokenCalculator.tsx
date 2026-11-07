"use client";

import { useState } from "react";
import { estimateCost } from "@/lib/chat-tokens";

const input = "mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 font-mono outline-none focus:border-ink";
const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

export default function TokenCalculator({ defaults }: { defaults: { messagesPerDay: number; inputTokens: number; outputTokens: number } }) {
  const [messages, setMessages] = useState(String(defaults.messagesPerDay));
  const [inTokens, setInTokens] = useState(String(defaults.inputTokens));
  const [outTokens, setOutTokens] = useState(String(defaults.outputTokens));
  const [inPrice, setInPrice] = useState("");
  const [outPrice, setOutPrice] = useState("");

  const toNumber = (value: string) => (value.trim() === "" ? NaN : Number(value));
  const cost = estimateCost({
    messagesPerDay: toNumber(messages),
    inputTokens: toNumber(inTokens),
    outputTokens: toNumber(outTokens),
    inputPricePerMillion: toNumber(inPrice),
    outputPricePerMillion: toNumber(outPrice),
  });
  const ready = inPrice.trim() !== "" && outPrice.trim() !== "";

  return (
    <div className="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          AI messages per day
          <input value={messages} onChange={(e) => setMessages(e.target.value)} inputMode="decimal" className={input} />
        </label>
        <span />
        <label className="block text-sm">
          Input tokens per message
          <input value={inTokens} onChange={(e) => setInTokens(e.target.value)} inputMode="decimal" className={input} />
        </label>
        <label className="block text-sm">
          Output tokens per message
          <input value={outTokens} onChange={(e) => setOutTokens(e.target.value)} inputMode="decimal" className={input} />
        </label>
        <label className="block text-sm">
          Input price per 1,000,000 tokens (your currency)
          <input value={inPrice} onChange={(e) => setInPrice(e.target.value)} inputMode="decimal" placeholder="from your provider's price page" className={input} />
        </label>
        <label className="block text-sm">
          Output price per 1,000,000 tokens (your currency)
          <input value={outPrice} onChange={(e) => setOutPrice(e.target.value)} inputMode="decimal" placeholder="from your provider's price page" className={input} />
        </label>
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Per message", cost.perMessage],
          ["Per day", cost.perDay],
          ["Per 30 days", cost.perMonth],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-md bg-surface px-4 py-3">
            <dt className="eyebrow text-muted">{label}</dt>
            <dd className="mt-1 font-mono text-lg">{ready ? money.format(value as number) : "—"}</dd>
          </div>
        ))}
      </dl>
      {!ready && <p className="mt-3 text-sm text-muted">Enter both prices to see the cost. Prices change, so none are filled in for you.</p>}
    </div>
  );
}
