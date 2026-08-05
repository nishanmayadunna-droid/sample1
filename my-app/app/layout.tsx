import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Anton } from "next/font/google";
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

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "Northbound — Hard-wearing field apparel",
    template: "%s · Northbound",
  },
  description:
    "Honest materials, quiet design, and hardware built to outlast the season. Field apparel for the cold miles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="mt-8 bg-panel text-panelmuted">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="display text-2xl text-panelink">
                North<span className="text-blaze">·</span>bound
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed">
                A demo storefront. Built to be worn out, not thrown out.
              </p>
            </div>
            <nav className="flex gap-6 font-mono text-[0.7rem] uppercase tracking-[0.16em]">
              <Link href="/products" className="hover:text-panelink">
                Shop all
              </Link>
              <Link href="/cart" className="hover:text-panelink">
                Cart
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
