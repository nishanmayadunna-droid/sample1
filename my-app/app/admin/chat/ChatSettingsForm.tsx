"use client";

import { useActionState, useState, useTransition } from "react";
import type { ParsedChatSettings } from "@/lib/chat";
import MayaMascot from "../../components/MayaMascot";
import { saveChatSettingsAction, type ChatFormState } from "./actions";

const initialState: ChatFormState = { errors: [], saved: false };

const MESSAGES: Record<string, string> = {
  ai_key_missing: "Set ANTHROPIC_API_KEY on the server before choosing the AI engine.",
  assistant_name: "Give the assistant a name.",
  accent: "The accent colour must look like #d9531e.",
  ai_model: "Enter a model name.",
  server: "Something went wrong, please try again.",
};
const message = (code: string) => MESSAGES[code] ?? `Check the value of ${code.replaceAll("_", " ")}.`;

const input = "mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 outline-none focus:border-ink";

export default function ChatSettingsForm({
  settings,
  mascotUrl,
  aiKeySet,
}: {
  settings: ParsedChatSettings;
  mascotUrl: string | null;
  aiKeySet: boolean;
}) {
  const [state, submit, pending] = useActionState(saveChatSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [engine, setEngine] = useState(settings.engine);
  const [name, setName] = useState(settings.assistantName);
  const [accent, setAccent] = useState(settings.accent);
  const [greeting, setGreeting] = useState(settings.greeting.en);
  const aiGreyed = engine !== "ai";
  const ai = settings.ai;

  const num = (label: string, field: string, value: number) => (
    <label className="block text-sm">
      {label}
      <input name={field} type="number" inputMode="numeric" defaultValue={value} className={input} />
    </label>
  );

  return (
    <form
      // onSubmit rather than `action={submit}`: React 19 resets a form after every form action.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="max-w-3xl"
    >
      {state.errors.length > 0 && (
        <ul role="alert" className="mb-4 list-disc pl-5 text-sm text-blaze">
          {state.errors.map((code) => (
            <li key={code}>{message(code)}</li>
          ))}
        </ul>
      )}

      <h3 className="eyebrow text-muted">General</h3>
      <label className="mt-3 flex items-start gap-3">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-1" />
        <span>
          Show the assistant on the shop
          <span className="block text-sm text-muted">Off by default. While off, customers see nothing.</span>
        </span>
      </label>
      <fieldset className="mt-4">
        <legend className="text-sm">Engine</legend>
        <label className="mt-2 flex items-start gap-3">
          <input type="radio" name="engine" value="guided" checked={engine === "guided"} onChange={() => setEngine("guided")} className="mt-1" />
          <span>
            Guided (free)
            <span className="block text-sm text-muted">Question buttons and keyword matching. No AI, no cost, answers only what you wrote.</span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-3">
          <input type="radio" name="engine" value="ai" checked={engine === "ai"} onChange={() => setEngine("ai")} className="mt-1" />
          <span>
            AI
            <span className="block text-sm text-muted">
              Costs money per message. Server key: <span className="font-mono">{aiKeySet ? "set" : "not set"}</span>. Falls back to Guided on any
              error or limit.
            </span>
          </span>
        </label>
      </fieldset>

      <h3 className="eyebrow mt-8 text-muted">Appearance</h3>
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border border-line p-4">
        {mascotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mascotUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <MayaMascot size={56} accent={accent} />
        )}
        <div className="text-sm">
          <p className="font-medium">{name || "Assistant"}</p>
          <p className="mt-1 rounded-md bg-surface px-3 py-1 text-muted">{greeting || "Hi!"}</p>
        </div>
      </div>
      <label className="mt-4 block text-sm">
        Assistant name
        <input
          name="assistant_name"
          defaultValue={settings.assistantName}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
      </label>
      <label className="mt-4 block text-sm">
        Accent colour
        <span className="mt-2 flex items-center gap-3">
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Pick a colour" className="h-10 w-14 rounded border border-line bg-bg" />
          <input name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-32 rounded-md border border-line bg-bg px-3 py-2 font-mono outline-none focus:border-ink" />
        </span>
      </label>
      <label className="mt-4 flex items-center gap-3 text-sm">
        <input type="checkbox" name="show_bubble" defaultChecked={settings.showBubble} />
        Show the greeting speech bubble next to the assistant
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Greeting bubble (Sinhala)
          <input name="greeting_si" defaultValue={settings.greeting.si} maxLength={120} className={input} />
        </label>
        <label className="block text-sm">
          Greeting bubble (English)
          <input
            name="greeting_en"
            defaultValue={settings.greeting.en}
            maxLength={120}
            onChange={(e) => setGreeting(e.target.value)}
            className={input}
          />
        </label>
        <label className="block text-sm">
          First message (Sinhala)
          <input name="first_message_si" defaultValue={settings.firstMessage.si} maxLength={300} className={input} />
        </label>
        <label className="block text-sm">
          First message (English)
          <input name="first_message_en" defaultValue={settings.firstMessage.en} maxLength={300} className={input} />
        </label>
      </div>

      <h3 className="eyebrow mt-8 text-muted">Trust notes</h3>
      <p className="mt-2 text-sm text-muted">Shown when a customer asks whether they can trust the shop. Only write what is true.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Sinhala
          <textarea name="trust_si" rows={3} maxLength={600} defaultValue={settings.trust.si} className={input} />
        </label>
        <label className="block text-sm">
          English
          <textarea name="trust_en" rows={3} maxLength={600} defaultValue={settings.trust.en} className={input} />
        </label>
      </div>

      <h3 className="eyebrow mt-8 text-muted">AI engine</h3>
      <p className="mt-2 text-sm text-muted">
        These only apply when the engine is AI. See the{" "}
        <a href="/admin/chat/token-guide" className="underline">
          token expenditure guide
        </a>{" "}
        to work out what it will cost.
      </p>
      <fieldset disabled={aiGreyed} className={`mt-3 ${aiGreyed ? "opacity-50" : ""}`}>
        <label className="block text-sm">
          Model
          <input name="ai_model" defaultValue={ai.model} className={input} />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {num("Guests: messages per minute", "ai_guest_per_minute", ai.guestPerMinute)}
          {num("Guests: messages per day", "ai_guest_per_day", ai.guestPerDay)}
          {num("Signed-in: messages per minute", "ai_user_per_minute", ai.userPerMinute)}
          {num("Signed-in: messages per day", "ai_user_per_day", ai.userPerDay)}
          {num("Whole shop: messages per day (hard cap)", "ai_shop_daily_cap", ai.shopDailyCap)}
          {num("Longest customer message (characters)", "ai_max_message_chars", ai.maxMessageChars)}
          {num("Longest reply (tokens)", "ai_max_reply_tokens", ai.maxReplyTokens)}
        </div>
      </fieldset>

      <div className="mt-8 flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent disabled:opacity-60">
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.saved && <span role="status" className="text-sm text-muted">Saved.</span>}
      </div>
    </form>
  );
}
