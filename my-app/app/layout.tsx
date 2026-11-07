import type { Metadata } from "next";
import AnalyticsGate from "./components/AnalyticsGate";
import {
  Geist,
  Geist_Mono,
  Anton,
  Noto_Sans_Sinhala,
  Playfair_Display,
  Inter,
  Poppins,
  Space_Grotesk,
  DM_Serif_Display,
  DM_Sans,
} from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import PromiseStrip from "./components/PromiseStrip";
import Header from "./components/Header";
import InlineScript from "./components/InlineScript";
import CartDrawer from "./components/CartDrawer";
import ChatWidget from "./components/ChatWidget";
import { getChatConfig } from "@/lib/chat-data";
import {
  getNextPromotionChange,
  getRunningPromotions,
  getStoreSettings,
  getVisiblePromises,
} from "@/lib/storefront";
import PromotionClock from "./components/PromotionClock";
import ThemeStyle from "./components/ThemeStyle";
import { getBrand } from "@/lib/brand-data";
import { DEFAULT_BRAND, FONT_PAIRS, FONT_VARS, brandAssetUrl, resolveTheme, themeCss } from "@/lib/brand";
import { freeShippingThreshold } from "@/lib/promotions";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { toShellProduct, type Category, type ShellProduct } from "@/lib/products";
import { langBootScript } from "@/lib/i18n";
import { Suspense } from "react";
import { siteUrl } from "@/lib/site";

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


// The shop's font pair is a setting (/admin/branding). Fonts must be declared at build time, so the
// owner picks from this fixed list. Only the default pair is preloaded; the others are plain
// @font-face rules, so a visitor downloads the files of the chosen pair only.
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", preload: false });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], display: "swap", preload: false });
const dmSerif = DM_Serif_Display({ variable: "--font-dmserif", subsets: ["latin"], weight: "400", display: "swap", preload: false });
const dmSans = DM_Sans({ variable: "--font-dmsans", subsets: ["latin"], display: "swap", preload: false });

const fontClasses = [playfair, inter, poppins, spaceGrotesk, dmSerif, dmSans].map((f) => f.variable).join(" ");

// Store settings (language) are re-read at most once a minute; admin saves
// revalidate the layout at once.
export const revalidate = 60;

/** Title, description, share card and favicon come from the shop's brand (/admin/branding). */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: brand.seoTitle, template: `%s · ${brand.name}` },
    description: brand.seoDescription,
    openGraph: {
      type: "website",
      siteName: brand.name,
      locale: "si_LK",
      alternateLocale: ["en_US"],
      title: brand.seoTitle,
      description: brand.seoDescription,
    },
    twitter: { card: "summary_large_image" },
    icons: { icon: brand.faviconPath ? brandAssetUrl(brand.faviconPath) : "/default-favicon.ico" },
  };
}

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
  const [settings, products, categories, promises, promotions, nextChange, chat, brand] = await Promise.all([
    getStoreSettings(),
    getShellProducts(),
    getShellCategories(),
    getVisiblePromises(),
    getRunningPromotions(),
    getNextPromotionChange(),
    // Null (unreadable or switched off) means no assistant at all.
    getChatConfig().catch(() => null),
    // Never throws: the built-in Northbound defaults on any failure.
    getBrand().catch(() => DEFAULT_BRAND),
  ]);
  const pair = Object.hasOwn(FONT_PAIRS, brand.fontPair) ? FONT_PAIRS[brand.fontPair] : FONT_PAIRS.northbound;
  const pairVars = Object.hasOwn(FONT_VARS, brand.fontPair) ? FONT_VARS[brand.fontPair] : FONT_VARS.northbound;
  const shippingThreshold = freeShippingThreshold(promotions);

  // Every visitor gets the same HTML in the default language; the boot script
  // switches html[data-lang] to their saved choice before first paint.
  return (
    <html
      lang={settings.defaultLang}
      data-lang={settings.defaultLang}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${sinhala.variable} ${sinhalaBold.variable} ${fontClasses} h-full antialiased`}
      style={{
        ["--font-display-active" as string]: pairVars.display,
        ["--font-body-active" as string]: pairVars.body,
        ["--display-case" as string]: pair.displayCase,
        ["--display-tracking" as string]: pair.tracking,
      }}
    >
      <head>
        <InlineScript html={langBootScript(settings)} />
        <ThemeStyle css={themeCss(resolveTheme(brand))} />
      </head>
      <body className="min-h-full flex flex-col">
        <PromiseStrip promises={promises} freeShippingThreshold={shippingThreshold} />
        <Header
          brand={brand}
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
          brand={brand}
          categories={categories}
          promises={promises}
          freeShippingThreshold={shippingThreshold}
        />
        {chat && (
          <Suspense fallback={null}>
            <ChatWidget config={chat} products={products.map((p) => ({ id: p.id, name: p.name }))} />
          </Suspense>
        )}
        <AnalyticsGate />
      </body>
    </html>
  );
}
