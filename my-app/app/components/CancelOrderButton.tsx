"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/app/context/LangContext";
import { cancelMyOrder } from "@/app/orders/[number]/actions";
import { tr } from "@/lib/i18n";
import L from "./L";

/** Cancel for a pending order: asks first, then refreshes the page. */
export default function CancelOrderButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const lang = useLang();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function cancel() {
    if (!window.confirm(tr(lang, "මෙම ඇණවුම අවලංගු කරන්නද?", "Cancel this order?"))) return;
    startTransition(async () => {
      const result = await cancelMyOrder(orderNumber);
      setFailed(result.message !== "cancelled");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="rounded-full border border-line px-5 py-2 text-sm hover:border-ink disabled:opacity-40"
      >
        <L si="ඇණවුම අවලංගු කරන්න" en="Cancel order" />
      </button>
      {failed && (
        <span role="alert" className="text-sm text-blaze">
          <L si="අවලංගු කළ නොහැක. ඇණවුම දැනටමත් තහවුරු කර ඇත." en="Couldn't cancel. The order may already be confirmed." />
        </span>
      )}
    </div>
  );
}
