"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useLang } from "@/app/context/LangContext";
import { chatVisibleOn, type ChatConfig } from "@/lib/chat";
import { pageContext } from "@/lib/chat-guided";
import { tr } from "@/lib/i18n";
import MayaMascot from "./MayaMascot";

// The window (and its engine code) loads on first open, so ordinary pages stay light.
const ChatWindow = dynamic(() => import("./ChatWindow"), { ssr: false });

const BUBBLE_KEY = "maya:bubble-dismissed";

function bubbleWasDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(BUBBLE_KEY) === "1";
  } catch {
    return false;
  }
}

/** The floating assistant: a mascot button with a greeting bubble that opens the chat window. */
export default function ChatWidget({
  config,
  products,
}: {
  config: ChatConfig;
  products: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const lang = useLang();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Starts hidden and is decided on the client, so server and client HTML match.
  const [bubbleGone, setBubbleGone] = useState(true);
  const [decided, setDecided] = useState(false);

  if (!chatVisibleOn(pathname)) return null;

  const context = pageContext(pathname, new URLSearchParams(search.toString()), products);
  // Above the phone-only sticky "Add to cart" bar on product pages.
  const lift = pathname.startsWith("/products/") ? "bottom-24 sm:bottom-6" : "bottom-4 sm:bottom-6";
  const showBubble = config.showBubble && decided && !bubbleGone && !open;

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  return (
    <div
      className={`fixed right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-6 ${lift}`}
      style={{ ["--maya-accent" as string]: config.accent }}
      ref={(node) => {
        // Runs once on the client after mount.
        if (node && !decided) {
          setDecided(true);
          setBubbleGone(bubbleWasDismissed());
        }
      }}
    >
      {open && (
        <div className="w-[min(22rem,calc(100vw-2rem))]">
          <ChatWindow config={config} context={context} onClose={close} />
        </div>
      )}
      {showBubble && (
        <div className="maya-bubble relative max-w-[16rem] rounded-xl border border-line bg-surface px-4 py-2 pr-8 text-sm shadow-md">
          {context.kind === "product" && context.productName
            ? tr(lang, `${context.productName} ගැන දැනගන්න ඕනද?`, `Want to know about ${context.productName}?`)
            : tr(lang, config.greeting.si, config.greeting.en)}
          <button
            type="button"
            aria-label={tr(lang, "වසන්න", "Dismiss")}
            onClick={() => {
              setBubbleGone(true);
              try {
                window.sessionStorage.setItem(BUBBLE_KEY, "1");
              } catch {
                // Storage can be blocked; the bubble simply returns on the next page.
              }
            }}
            className="absolute right-2 top-1 text-lg leading-none text-muted"
          >
            ×
          </button>
        </div>
      )}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? tr(lang, "chat එක වසන්න", `Close ${config.assistantName}`) : tr(lang, `${config.assistantName} සමඟ chat කරන්න`, `Chat with ${config.assistantName}`)}
        className="maya-launcher flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-white shadow-lg"
        style={{ borderColor: "var(--maya-accent)" }}
      >
        {config.mascotUrl ? (
          <Image src={config.mascotUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
        ) : (
          <MayaMascot size={52} accent={config.accent} />
        )}
      </button>
    </div>
  );
}
