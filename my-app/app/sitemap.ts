import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import { sitemapEntries } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let productIds: string[] = [];
  try {
    productIds = (await getAllProducts()).map((p) => p.id);
  } catch (error) {
    console.error("sitemap products query failed", error);
  }
  return sitemapEntries({ base: siteUrl(), productIds, now: new Date() });
}
