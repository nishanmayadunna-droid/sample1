"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CHAT_FEATURES, LINK_ALLOWLIST, type ChatTopic } from "@/lib/chat";
import { deleteTopicAction, moveTopicAction, resetTopicsAction, saveTopicAction, type ChatFormState } from "./actions";

const initialState: ChatFormState = { errors: [], saved: false };
const input = "mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 outline-none focus:border-ink";

const MESSAGES: Record<string, string> = {
  id: "The id can only use lowercase letters, digits and dashes.",
  title: "Give the question a Sinhala and an English title.",
  answer: "Write the answer in Sinhala and English.",
  keywords: "Add at least one keyword.",
  links: `Links must be one per line as "/path|Sinhala label|English label", from the allowed paths, at most 4.`,
  follow_ups: "Follow-ups are up to 4 topic ids separated by commas.",
  requires: "Pick a feature from the list or leave it empty.",
  sort_order: "Order must be a whole number.",
  server: "Something went wrong, please try again.",
};

function TopicForm({ topic, onDone }: { topic: ChatTopic | null; onDone: () => void }) {
  const router = useRouter();
  const [state, submit, pending] = useActionState(saveTopicAction, initialState);
  const [, startTransition] = useTransition();
  const editing = topic !== null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          await submit(formData);
          router.refresh();
        });
      }}
      className="mt-3 rounded-md border border-line p-4"
    >
      {state.errors.length > 0 && (
        <ul role="alert" className="mb-3 list-disc pl-5 text-sm text-blaze">
          {state.errors.map((code) => (
            <li key={code}>{MESSAGES[code] ?? code}</li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Id
          <input name="id" defaultValue={topic?.id ?? ""} readOnly={editing} className={`${input} font-mono ${editing ? "opacity-60" : ""}`} />
        </label>
        <label className="block text-sm">
          Only show while this feature is on
          <select name="requires" defaultValue={topic?.requires ?? ""} className={input}>
            <option value="">Always</option>
            {CHAT_FEATURES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Question (Sinhala)
          <input name="title_si" defaultValue={topic?.title.si ?? ""} maxLength={80} className={input} />
        </label>
        <label className="block text-sm">
          Question (English)
          <input name="title_en" defaultValue={topic?.title.en ?? ""} maxLength={80} className={input} />
        </label>
        <label className="block text-sm">
          Answer (Sinhala)
          <textarea name="answer_si" rows={5} maxLength={600} defaultValue={topic?.answer.si ?? ""} className={input} />
        </label>
        <label className="block text-sm">
          Answer (English)
          <textarea name="answer_en" rows={5} maxLength={600} defaultValue={topic?.answer.en ?? ""} className={input} />
        </label>
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        Facts: {"{shippingFee} {freeShippingFrom} {returnDays} {phone} {whatsapp} {email} {reviewCount} {averageRating}"}. A sentence with a
        missing fact is left out. Start a line with [card] [advance] [sms] [email] [push] or [points] to show it only while that feature is on.
      </p>
      <label className="mt-4 block text-sm">
        Keywords (commas or new lines; Sinhala, English and Singlish)
        <textarea name="keywords" rows={2} defaultValue={topic?.keywords.join(", ") ?? ""} className={input} />
      </label>
      <label className="mt-4 block text-sm">
        Link buttons (one per line: /path|Sinhala label|English label)
        <textarea
          name="links"
          rows={2}
          defaultValue={topic?.links.map((l) => `${l.href}|${l.label.si}|${l.label.en}`).join("\n") ?? ""}
          className={`${input} font-mono`}
        />
      </label>
      <p className="mt-1 font-mono text-xs text-muted">Allowed paths: {LINK_ALLOWLIST.join("  ")}</p>
      <label className="mt-4 block text-sm">
        Follow-up topics (ids separated by commas)
        <input name="follow_ups" defaultValue={topic?.followUps.join(", ") ?? ""} className={`${input} font-mono`} />
      </label>
      <input type="hidden" name="sort_order" value={topic?.sortOrder ?? 9000} />
      <label className="mt-4 flex items-center gap-3 text-sm">
        <input type="checkbox" name="visible" defaultChecked={topic?.visible ?? true} />
        Visible to customers
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-blaze px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save topic"}
        </button>
        <button type="button" onClick={onDone} className="text-sm underline">
          Close
        </button>
        {state.saved && <span role="status" className="text-sm text-muted">Saved.</span>}
      </div>
    </form>
  );
}

export default function TopicsEditor({ topics, isDefault }: { topics: ChatTopic[]; isDefault: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<unknown>) {
    startTransition(async () => {
      await task();
      router.refresh();
    });
  }

  return (
    <div>
      {isDefault && (
        <p className="mb-3 text-sm text-muted">
          These are the built-in topics. The first time you change one, they are copied so you can edit each of them.
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {topics.map((topic, index) => (
          <li key={topic.id} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{topic.title.en}</span>
                <span className="ml-2 font-mono text-xs text-muted">
                  {topic.id}
                  {topic.requires ? ` · needs ${topic.requires}` : ""}
                  {topic.visible ? "" : " · hidden"}
                </span>
              </span>
              <button type="button" disabled={pending || index === 0} onClick={() => run(() => moveTopicAction(topic.id, "up"))} aria-label="Move up" className="px-2 disabled:opacity-30">
                ↑
              </button>
              <button type="button" disabled={pending || index === topics.length - 1} onClick={() => run(() => moveTopicAction(topic.id, "down"))} aria-label="Move down" className="px-2 disabled:opacity-30">
                ↓
              </button>
              <button type="button" onClick={() => setOpen(open === topic.id ? null : topic.id)} className="text-sm underline">
                {open === topic.id ? "Close" : "Edit"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Delete "${topic.title.en}"?`)) run(() => deleteTopicAction(topic.id));
                }}
                className="text-sm text-blaze underline disabled:opacity-60"
              >
                Delete
              </button>
            </div>
            {open === topic.id && <TopicForm topic={topic} onDone={() => setOpen(null)} />}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-4">
        <button type="button" onClick={() => setOpen(open === "__new" ? null : "__new")} className="rounded-full border border-line px-5 py-2 text-sm hover:border-ink">
          Add a topic
        </button>
        {!isDefault && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Remove your changes and go back to the built-in topics?")) run(() => resetTopicsAction());
            }}
            className="text-sm underline disabled:opacity-60"
          >
            Reset to the built-in topics
          </button>
        )}
      </div>
      {open === "__new" && <TopicForm topic={null} onDone={() => setOpen(null)} />}
    </div>
  );
}
