import type { MetadataRoute } from "next";
import { isProductionDeploy, siteUrl } from "@/lib/site";
import { robotsRules } from "@/lib/seo";

export const revalidate = 3600;

export default function robots(): MetadataRoute.Robots {
  return robotsRules({ production: isProductionDeploy(), base: siteUrl() });
}
