"use client";

import { useState, useTransition } from "react";
import { startOnlinePayment } from "@/app/orders/[number]/online-actions";
import L from "./L";

const MESSAGES = {
  not_available: { si: "ඔන්ලයින් ගෙවීම දැනට ලබාගත නොහැක.", en: "Online payment isn't available right now." },
  not_allowed: { si: "මෙම ඇණවුම ඔන්ලයින් ගෙවිය නොහැක.", en: "This order can't be paid online." },
  busy: { si: "ගොඩක් වතාවක් උත්සාහ කළා. මද වෙලාවකින් නැවත උත්සාහ කරන්න.", en: "Too many tries. Please wait a few minutes." },
  error: { si: "යමක් වැරදුණා, නැවත උත්සාහ කරන්න.", en: "Something went wrong, please try again." },
} as const;

/**
 * Asks the server for a signed PayHere form, then posts it from the browser.
 * The browser never chooses the amount: it only sends the order number.
 */
export default function PayOnlineButton({ orderNumber }: { orderNumber: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<keyof typeof MESSAGES | null>(null);

  function pay() {
    setMessage(null);
    startTransition(async () => {
      const result = await startOnlinePayment(orderNumber);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = result.url;
      for (const [name, value] of Object.entries(result.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? <L si="රැඳී සිටින්න…" en="One moment…" /> : <L si="දැන් ඔන්ලයින් ගෙවන්න" en="Pay online now" />}
      </button>
      {message && (
        <p role="alert" className="mt-2 text-sm text-blaze">
          <L {...MESSAGES[message]} />
        </p>
      )}
    </div>
  );
}
