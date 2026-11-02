"use client";

import Link from "next/link";
import { SessionProvider } from "next-auth/react";
import { useCart } from "@/app/context/CartContext";
import AccountNav from "./AccountNav";
import CartSync from "./CartSync";
import LangToggle from "./LangToggle";
import { initLangStore } from "@/app/context/LangContext";
import type { Lang } from "@/lib/i18n";

export default function Header({
  defaultLang,
  bilingual,
}: {
  defaultLang: Lang;
  bilingual: boolean;
}) {
  // Header renders before every other client component, so the language
  // store knows the server's language before anything hydrates.
  initLangStore(defaultLang);
  const { totalItems, hydrated } = useCart();

  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="display text-2xl leading-none tracking-tight"
          aria-label="Northbound home"
        >
          North<span className="text-blaze">·</span>bound
        </Link>
        <nav className="flex items-center gap-7 font-mono text-[0.7rem] uppercase tracking-[0.16em]">
          <Link
            href="/products"
            className="text-muted transition-colors hover:text-ink"
          >
            Shop
          </Link>
          <LangToggle show={bilingual} />
          <SessionProvider>
            <AccountNav />
            <CartSync />
          </SessionProvider>
          <Link
            href="/cart"
            className="text-muted transition-colors hover:text-ink"
          >
            Cart
            {hydrated && totalItems > 0 && (
              <span className="ml-1 text-blaze">[{totalItems}]</span>
            )}
          </Link>
        </nav>
      </div>
      <div className="measure text-ink" />
    </header>
  );
}
