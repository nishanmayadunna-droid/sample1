import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Northbound — Considered Everyday Apparel",
    template: "%s · Northbound",
  },
  description:
    "Considered, hard-wearing apparel for everyday life. Tops, bottoms, outerwear, and accessories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/[.08] py-8 text-center text-sm text-zinc-500 dark:border-white/[.12] dark:text-zinc-400">
          <p>
            Northbound is a demo storefront. ·{" "}
            <Link href="/products" className="underline underline-offset-4">
              Shop all
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
