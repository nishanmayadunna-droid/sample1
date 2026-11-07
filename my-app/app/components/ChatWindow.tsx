"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/app/context/LangContext";
import { isAllowedLink, type ChatConfig, type ChatLink, type ChatReply } from "@/lib/chat";
import { answerFor, greetingFor, replyForTopicId, type PageContext } from "@/lib/chat-guided";
import { tr } from "@/lib/i18n";
import MayaMascot from "./MayaMascot";

type MessageBody = { role: "user"; text: string } | { role: "maya"; reply: ChatReply };
type Message = MessageBody & { id: number };

const AI_HISTORY = 10;

/** Only allowlisted internal paths and the shop's own call / WhatsApp links are ever rendered as links. */
function safeHref(href: string): "internal" | "external" | null {
  if (isAllowedLink(href)) return "internal";
  if (href.startsWith("tel:") || href.startsWith("https://wa.me/")) return "external";
  return null;
}

function LinkButton({ link, onNavigate }: { link: ChatLink; onNavigate: () => void }) {
  const lang = useLang();
  const kind = safeHref(link.href);
  const className = "rounded-full px-4 py-1.5 text-sm font-medium text-white";
  const style = { backgroundColor: "var(--maya-accent)" };
  const label = tr(lang, link.label.si, link.label.en);
  if (kind === "internal") {
    return (
      <Link href={link.href} onClick={onNavigate} className={className} style={style}>
        {label} →
      </Link>
    );
  }
  if (kind === "external") {
    return (
      <a href={link.href} target={link.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer" className={className} style={style}>
        {label} →
      </a>
    );
  }
  return null;
}

export default function ChatWindow({
  config,
  context,
  lifted,
  onClose,
}: {
  config: ChatConfig;
  context: PageContext;
  /** On phones the launcher sits above the sticky add bar, so the window must be shorter to keep its header on screen. */
  lifted: boolean;
  onClose: () => void;
}) {
  const lang = useLang();
  const nextId = useRef(2);
  const listRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const greeting = greetingFor(context, config);
    return [{ id: 1, role: "maya", reply: { text: greeting.text, links: [], chips: greeting.chips } }];
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, thinking]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function push(message: MessageBody) {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...message, id }]);
  }

  async function askAi(typed: string): Promise<ChatReply | null> {
    try {
      const history = [...messages, { id: 0, role: "user" as const, text: typed }]
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.role === "user" ? m.text : tr(lang, m.reply.text.si, m.reply.text.en) }))
        .slice(-AI_HISTORY);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, productId: context.productId }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { reply?: ChatReply; fallback?: boolean };
      return body.fallback || !body.reply ? null : body.reply;
    } catch {
      return null;
    }
  }

  async function ask(typed: string, answer: () => ChatReply, useAi: boolean) {
    push({ role: "user", text: typed });
    setThinking(true);
    // Any AI failure, limit or timeout silently continues with the guided answer.
    const reply = (useAi && config.engine === "ai" ? await askAi(typed) : null) ?? answer();
    // A moment of "typing" so a reply does not appear to jump in; purely cosmetic.
    await new Promise((resolve) => setTimeout(resolve, 300));
    setThinking(false);
    push({ role: "maya", reply });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const typed = input.trim().slice(0, 300);
    if (typed === "" || thinking) return;
    setInput("");
    void ask(typed, () => answerFor(typed, config), true);
  }

  function chip(id: string, label: string) {
    if (thinking) return;
    // A tapped question has a vetted, owner-written answer: no model call, no cost.
    void ask(label, () => replyForTopicId(id, config) ?? answerFor(label, config), false);
  }

  const showAiNote = config.engine === "ai";

  return (
    <div
      role="dialog"
      aria-label={config.assistantName}
      className={`maya-pop flex w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl ${
        lifted
          ? "max-h-[min(34rem,calc(100dvh-13rem))] sm:max-h-[min(34rem,calc(100dvh-9rem))]"
          : "max-h-[min(34rem,calc(100dvh-9rem))]"
      }`}
    >
      <div className="flex items-center gap-3 bg-black px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white">
          {config.mascotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.mascotUrl} alt="" width={36} height={36} className="h-9 w-9 object-cover" />
          ) : (
            <MayaMascot size={30} accent={config.accent} />
          )}
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="flex-1 text-base font-medium outline-none">
          {config.assistantName}
        </h2>
        <button type="button" onClick={onClose} aria-label={tr(lang, "වසන්න", "Close chat")} className="px-2 text-xl leading-none">
          ×
        </button>
      </div>

      <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {messages.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-xl px-3 py-2 text-white" style={{ backgroundColor: "var(--maya-accent)" }}>
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              <p className="w-fit whitespace-pre-line rounded-xl bg-bg px-3 py-2 leading-relaxed">
                {tr(lang, m.reply.text.si, m.reply.text.en)}
              </p>
              {m.reply.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.reply.links.map((link) => (
                    <LinkButton key={link.href} link={link} onNavigate={onClose} />
                  ))}
                </div>
              )}
              {m.reply.chips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.reply.chips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => chip(c.id, tr(lang, c.label.si, c.label.en))}
                      className="rounded-full border border-line bg-bg px-3 py-1 text-left hover:border-ink"
                    >
                      {tr(lang, c.label.si, c.label.en)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {thinking && (
          <p className="w-fit rounded-xl bg-bg px-3 py-2 text-muted" aria-label={tr(lang, "ටයිප් කරමින්", "Typing")}>
            …
          </p>
        )}
      </div>

      {showAiNote && (
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          {tr(lang, "AI පිළිතුරු වැරදිය හැක. මුරපද හෝ කාඩ් අංක යවන්න එපා.", "AI answers can be wrong. Don't share passwords or card numbers.")}
        </p>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-line px-3 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          aria-label={tr(lang, "ඔයාගේ ප්‍රශ්නය", "Your question")}
          placeholder={tr(lang, "ඔයාගේ ප්‍රශ්නය type කරන්න…", "Type your question…")}
          className="min-w-0 flex-1 rounded-md bg-bg px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={thinking || input.trim() === ""}
          aria-label={tr(lang, "යවන්න", "Send")}
          className="rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--maya-accent)" }}
        >
          →
        </button>
      </form>
    </div>
  );
}
