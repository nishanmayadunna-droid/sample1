// Debounced whole-cart saver for account sync. Framework-free so its timing
// rules are unit-tested (lib/cart-saver.test.ts).
import type { CartLine } from "@/lib/cart-rules";

export type CartSaver = {
  /** Remember the latest cart and save it `delayMs` after the last call. */
  schedule(lines: CartLine[]): void;
  /** Save any pending cart now (e.g. before sign-out). */
  flush(): Promise<void>;
  /** True until the latest scheduled cart has been saved successfully. */
  hasPending(): boolean;
  /** Forget any pending cart without saving it. */
  cancel(): void;
};

export function createCartSaver(
  save: (lines: CartLine[]) => Promise<void>,
  delayMs = 1000,
): CartSaver {
  let pending: CartLine[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  async function flush() {
    clearTimer();
    const lines = pending;
    if (lines === null) return;
    try {
      await save(lines);
      // Newer lines may have been scheduled while saving; keep those pending.
      if (pending === lines) pending = null;
    } catch (error) {
      // Stay pending so the next flush/schedule retries.
      console.error("cart save failed", error);
    }
  }

  return {
    schedule(lines) {
      pending = lines;
      clearTimer();
      timer = setTimeout(() => void flush(), delayMs);
    },
    flush,
    hasPending: () => pending !== null,
    cancel() {
      clearTimer();
      pending = null;
    },
  };
}
