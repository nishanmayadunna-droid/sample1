import { getAllProducts, getCategories } from "@/lib/catalog";
import { dealProducts, soonestDealEnd } from "@/lib/home-sections";
import { freeShippingThreshold, withPricing } from "@/lib/promotions";
import { getRunningPromotions, getVisiblePromises } from "@/lib/storefront";
import { promiseItems } from "@/lib/storefront-form";
import { getStoreContact } from "@/lib/store-contact-data";
import { absoluteUrl, siteUrl } from "@/lib/site";
import { jsonLdScript, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import CategoryShelf from "./components/CategoryShelf";
import DealsRow from "./components/DealsRow";
import HomeHero from "./components/HomeHero";
import Newsletter from "./components/Newsletter";
import PromiseCards from "./components/PromiseCards";
import PromoBanners from "./components/PromoBanners";

// Re-fetch catalog data from Supabase at most once a minute (ISR).
export const revalidate = 60;

export default async function Home() {
  // One catalog query; every section below is a slice of it.
  const [catalog, categories, promotions, promises] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getRunningPromotions(),
    getVisiblePromises(),
  ]);
  const products = withPricing(catalog, promotions, categories);
  const deals = dealProducts(products);
  // The brand hero steps aside while a promotion has a banner to show.
  const hasBanner = promotions.some((p) => p.banner.mode !== "none");
  const hero = products.find((p) => p.id === "field-jacket") ?? products.find((p) => p.featured);

  let phone: string | undefined;
  let email: string | undefined;
  try {
    const contact = await getStoreContact();
    phone = contact.phone || undefined;
    email = contact.email || undefined;
  } catch {
    // contact details are optional in the structured data
  }
  const structured = [
    organizationJsonLd({ name: "Northbound", url: absoluteUrl("/"), phone, email }),
    websiteJsonLd({ name: "Northbound", url: siteUrl() }),
  ];

  return (
    <div>
      {structured.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
        />
      ))}
      <PromoBanners promotions={promotions} />
      {!hasBanner && <HomeHero hero={hero} />}
      <DealsRow deals={deals} endsAt={soonestDealEnd(deals, promotions)} />
      <CategoryShelf products={products} categories={categories} />
      <PromiseCards items={promiseItems(promises, freeShippingThreshold(promotions))} />
      <Newsletter />
    </div>
  );
}
