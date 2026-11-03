import type { Metadata } from "next";
import { Geist, Geist_Mono, Anton, Noto_Sans_Sinhala } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import PromiseStrip from "./components/PromiseStrip";
import Header from "./components/Header";
import InlineScript from "./components/InlineScript";
import CartDrawer from "./components/CartDrawer";
import {
  getNextPromotionChange,
  getRunningPromotions,
  getStoreSettings,
  getVisiblePromises,
} from "@/lib/storefront";
import PromotionClock from "./components/PromotionClock";
import { freeShippingThreshold } from "@/lib/promotions";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { toShellProduct, type Category, type ShellProduct } from "@/lib/products";
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

/** Products for the search box and cart drawer; none if the catalog can't be read. */
async function getShellProducts(): Promise<ShellProduct[]> {
  try {
    return (await getAllProducts()).map(toShellProduct);
  } catch (error) {
    console.error("shell products query failed", error);
    return [];
  }
}

/** Categories for the menu and footer; none if they can't be read. */
async function getShellCategories(): Promise<Category[]> {
  try {
    return await getCategories();
  } catch (error) {
    console.error("shell categories query failed", error);
    return [];
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Each read falls back on its own, so the shell never fails the page.
  const [settings, products, categories, promises, promotions, nextChange] = await Promise.all([
    getStoreSettings(),
    getShellProducts(),
    getShellCategories(),
    getVisiblePromises(),
    getRunningPromotions(),
    getNextPromotionChange(),
  ]);
  const shippingThreshold = freeShippingThreshold(promotions);

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
        <PromiseStrip promises={promises} freeShippingThreshold={shippingThreshold} />
        <Header
          defaultLang={settings.defaultLang}
          bilingual={settings.bilingual}
          categories={categories}
          products={products}
          promotions={promotions}
        />
        <main className="flex-1">{children}</main>
        <PromotionClock nextChange={nextChange} />
        <CartDrawer
          products={products}
          promotions={promotions}
          shippingFee={settings.shippingFee}
          categories={categories}
        />
        <Footer
          categories={categories}
          promises={promises}
          freeShippingThreshold={shippingThreshold}
        />
      </body>
    </html>
  );
}
