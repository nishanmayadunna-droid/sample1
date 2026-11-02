import type { PromiseIcon as Icon } from "@/lib/storefront-form";

// Simple line icons (24px grid, currentColor). Decorative: the promise text
// beside each one says what it means.
const PATHS: Record<Icon, string> = {
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  box: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
  return: "M9 14l-5-5 5-5M4 9h11a5 5 0 0 1 0 10h-3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
};

export default function PromiseIcon({ icon, className = "h-4 w-4" }: { icon: Icon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[icon]} />
    </svg>
  );
}
