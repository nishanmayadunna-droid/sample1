// Storefront settings and promises: shared types and pure form rules.
// Safe to import from client components.

export type PromiseIcon = "truck" | "box" | "return" | "shield" | "tag";

/** A line in the promise strip and footer, written in both languages. */
export type StorePromise = {
  id: string;
  icon: PromiseIcon;
  textSi: string;
  textEn: string;
  sortOrder: number;
  visible: boolean;
};
