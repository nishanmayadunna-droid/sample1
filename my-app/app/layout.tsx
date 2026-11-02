import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Anton, Noto_Sans_Sinhala } from "next/font/google";
import "./globals.css";
import AnnouncementBar from "./components/AnnouncementBar";
import Header from "./components/Header";
import InlineScript from "./components/InlineScript";
import L from "./components/L";
import { getStoreSettings } from "@/lib/storefront";
import { langBootScript } from "@/lib/i18n";

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

// Sinhala text: regular for body copy, and a bold-only face that the Anton
// headings fall back to (Anton has no Sinhala glyphs).
const sinhala = Noto_Sans_Sinhala({
  variable: "--font-sinhala",
  subsets: ["sinhala"],
  weight: "400",
});

const sinhalaBold = Noto_Sans_Sinhala({
  variable: "--font-sinhala-bold",
  subsets: ["sinhala"],
  weight: "700",
});

// Store settings (language) are re-read at most once a minute; admin saves
// revalidate the layout at once.
export const revalidate = 60;

export const metadata: Metadata = {
  title: {
    default: "Northbound — Hard-wearing field apparel",
    template: "%s · Northbound",
  },
  description:
    "Honest materials, quiet design, and hardware built to outlast the season. Field apparel for the cold miles.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getStoreSettings();

  // Every visitor gets the same HTML in the default language; the boot script
  // switches html[data-lang] to their saved choice before first paint.
  return (
    <html
      lang={settings.defaultLang}
      data-lang={settings.defaultLang}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${sinhala.variable} ${sinhalaBold.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={langBootScript(settings)} />
      </head>
      <body className="min-h-full flex flex-col">
        <AnnouncementBar />
        <Header defaultLang={settings.defaultLang} bilingual={settings.bilingual} />
        <main className="flex-1">{children}</main>
        <footer className="mt-8 bg-panel text-panelmuted">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="display text-2xl text-panelink">
                North<span className="text-blaze">·</span>bound
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed">
                <L
                  si="Demo සාප්පුවකි. ඉවත දමන්න නොව, දිගු කලක් අඳින්නට."
                  en="A demo storefront. Built to be worn out, not thrown out."
                />
              </p>
            </div>
            <nav className="flex gap-6 font-mono text-[0.7rem] uppercase tracking-[0.16em]">
              <Link href="/products" className="hover:text-panelink">
                <L si="සියල්ල බලන්න" en="Shop all" />
              </Link>
              <Link href="/cart" className="hover:text-panelink">
                <L si="කරත්තය" en="Cart" />
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
