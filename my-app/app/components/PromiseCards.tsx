import type { PromiseItem } from "@/lib/storefront-form";
import L from "./L";
import PromiseIcon from "./PromiseIcon";

/** The home page's promise row: the same real promises as the strip and footer. */
export default function PromiseCards({ items }: { items: PromiseItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-16 border-y border-line">
      <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 bg-bg px-5 py-6 sm:px-6">
            <PromiseIcon icon={item.icon} className="h-6 w-6 text-blaze" />
            <span className="text-sm">
              <L si={item.si} en={item.en} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
