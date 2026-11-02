"use client";

import Link from "next/link";
import { SessionProvider } from "next-auth/react";
import { useCart } from "@/app/context/CartContext";
import { openCartDrawer } from "@/app/context/CartDrawerContext";
import { initLangStore, useLang } from "@/app/context/LangContext";
import { tr, type Lang } from "@/lib/i18n";
import type { Category } from "@/lib/products";
import AccountNav from "./AccountNav";
import CartSync from "./CartSync";
import CategoryMenu from "./CategoryMenu";
import L from "./L";
import LangToggle from "./LangToggle";

const navLinkClass = "whitespace-nowrap py-2 transition-colors hover:text-ink";

/** Placeholder search slot; the search box replaces it. */
function SearchSlot() {
  return (
    <Link
      href="/products"
      className="flex h-11 w-full items-center rounded-full border-2 border-ink px-5 text-sm text-muted"
    >
      <L si="භාණ්ඩ සොයන්න" en="Search products" />
    </Link>
  );
}

export default function Header({
  defaultLang,
  bilingual,
  categories,
}: {
  defaultLang: Lang;
  bilingual: boolean;
  categories: Category[];
}) {
  // Header renders before every other client component, so the language
  // store knows the server's language before anything hydrates.
  initLangStore(defaultLang);
  const lang = useLang();
  const { totalItems, hydrated } = useCart();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="display shrink-0 text-2xl leading-none tracking-tight"
          aria-label={tr(lang, "Northbound මුල් පිටුව", "Northbound home")}
        >
          North<span className="text-blaze">·</span>bound
        </Link>
        <div className="hidden flex-1 sm:block">
          <SearchSlot />
        </div>
        <div className="ml-auto flex items-center gap-4 font-mono text-[0.7rem] uppercase tracking-[0.16em] sm:ml-0">
          <LangToggle show={bilingual} />
          <SessionProvider>
            {/* Phones get an account icon instead of the name and admin links. */}
            <span className="hidden items-center gap-4 sm:flex">
              <AccountNav />
            </span>
            <CartSync />
          </SessionProvider>
          <Link
            href="/account"
            aria-label={tr(lang, "මගේ ගිණුම", "My account")}
            className="rounded-full p-1.5 text-ink hover:text-blaze sm:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
              className="h-6 w-6"
            >
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={openCartDrawer}
            aria-label={tr(
              lang,
              `කරත්තය, භාණ්ඩ ${hydrated ? totalItems : 0}`,
              `Cart, ${hydrated ? totalItems : 0} items`,
            )}
            className="relative rounded-full p-1.5 text-ink transition-colors hover:text-blaze"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-6 w-6"
            >
              <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
            </svg>
            {hydrated && totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blaze px-1 font-sans text-[0.65rem] font-semibold tracking-normal text-white">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 sm:hidden">
        <SearchSlot />
      </div>

      <nav
        aria-label={tr(lang, "සාප්පු මෙනුව", "Shop menu")}
        className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted sm:px-6"
      >
        {/* The links scroll sideways on phones; the menu stays outside so its popup isn't clipped. */}
        <div className="flex min-w-0 flex-1 gap-6 overflow-x-auto">
          <Link href="/products?view=deals" className={`${navLinkClass} text-blaze`}>
            ⚡ Flash Deals
          </Link>
          <Link href="/products?view=picks" className={navLinkClass}>
            ⭐ <L si="තෝරාගත් භාණ්ඩ" en="Top Picks" />
          </Link>
          <Link href="/products?view=new" className={navLinkClass}>
            🆕 <L si="අලුතින් ආ" en="New In" />
          </Link>
        </div>
        <CategoryMenu categories={categories} />
      </nav>
    </header>
  );
}
