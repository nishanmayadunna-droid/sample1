"use client";

import Link from "next/link";
import { useCart } from "@/app/context/CartContext";

export default function Header() {
  const { totalItems, hydrated } = useCart();

  return (
    <header className="sticky top-0 z-20 border-b border-black/[.08] bg-white/80 backdrop-blur dark:border-white/[.12] dark:bg-black/70">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          NORTHBOUND
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/products"
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-300 dark:hover:text-white"
          >
            Shop
          </Link>
          <Link
            href="/cart"
            className="relative text-zinc-600 transition-colors hover:text-black dark:text-zinc-300 dark:hover:text-white"
          >
            Cart
            {hydrated && totalItems > 0 && (
              <span className="absolute -right-4 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-xs font-medium text-background">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </nav>
    </header>
  );
}
