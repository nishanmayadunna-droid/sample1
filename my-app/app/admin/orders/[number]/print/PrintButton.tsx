"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-ink px-5 py-2 font-mono text-xs uppercase tracking-[0.14em] text-bg print:hidden"
    >
      Print
    </button>
  );
}
