import type { ReactNode } from "react";

/** Shared layout of the information pages (About, Contact, Privacy, ...). */
export default function StorePage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow text-muted">{eyebrow}</p>
      <h1 className="display mt-2 text-5xl">{title}</h1>
      <div className="measure mt-6 text-ink" />
      <div className="mt-8 space-y-5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="display text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}
