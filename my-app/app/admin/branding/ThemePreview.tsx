import type { ThemeMode } from "@/lib/brand";

/** A small header and product card drawn with the given colours and fonts (inline styles, so it works for any theme). */
export default function ThemePreview({
  label,
  theme,
  logoText,
  displayFont,
  bodyFont,
  displayCase,
}: {
  label: string;
  theme: ThemeMode;
  logoText: string;
  displayFont: string;
  bodyFont: string;
  displayCase: string;
}) {
  const parts = logoText.split("·");
  return (
    <div className="overflow-hidden rounded-md border border-line" style={{ background: theme.bg, color: theme.text, fontFamily: bodyFont }}>
      <p className="px-3 pt-2 font-mono text-[0.65rem] uppercase tracking-[0.16em]" style={{ color: theme.muted }}>
        {label}
      </p>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.line}` }}>
        <span style={{ fontFamily: displayFont, textTransform: displayCase as "none" | "uppercase", fontSize: "1.25rem", lineHeight: 1 }}>
          {parts.map((part, index) => (
            <span key={index}>
              {index > 0 && <span style={{ color: theme.accent }}>·</span>}
              {part}
            </span>
          ))}
        </span>
        <span className="text-xs" style={{ color: theme.muted }}>
          Shop · Cart
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3 p-3">
        <div className="rounded p-3" style={{ background: theme.surface }}>
          <p className="text-sm font-medium">Field jacket</p>
          <p className="text-xs" style={{ color: theme.muted }}>
            Rs 12,500.00
          </p>
          <span className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium" style={{ background: theme.accent, color: theme.onAccent }}>
            Add to cart
          </span>
        </div>
        <div className="rounded px-3 py-2 text-xs" style={{ background: theme.panel, color: theme.panelInk }}>
          Footer
          <p style={{ color: theme.panelMuted }}>Panel text</p>
        </div>
      </div>
    </div>
  );
}
