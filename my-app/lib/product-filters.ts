// Catalog filtering shared by /products and the header search. Pure and
// client-safe, so the search dropdown and the results page always agree.
import { productsInCategory } from "./category-form";
import { ruleMatches, type Promotion } from "./promotions";
import type { Category, PricedProduct, Product } from "./products";

export type ProductView = "deals" | "picks" | "new";

const VIEWS: readonly ProductView[] = ["deals", "picks", "new"];

export function parseView(value: string | undefined): ProductView | null {
  return VIEWS.find((view) => view === value) ?? null;
}

/** True when every word of `q` appears in the name, description or category name. */
export function matchesQuery(
  product: Pick<Product, "name" | "description" | "categoryName">,
  q: string,
): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack =
    `${product.name} ${product.description} ${product.categoryName}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function filterProducts<T extends PricedProduct>(
  products: T[],
  opts: {
    q?: string;
    category?: Category | null;
    view?: ProductView | null;
    /** Keep only products this promotion's rules apply to. */
    promo?: Promotion | null;
  },
  categories: Category[],
): T[] {
  let result = opts.category
    ? productsInCategory(products, opts.category, categories)
    : [...products];
  if (opts.q) result = result.filter((p) => matchesQuery(p, opts.q!));
  const promo = opts.promo;
  // A banner-only promotion (no rules) links to the whole shop.
  if (promo && promo.rules.length > 0) {
    result = result.filter((p) => promo.rules.some((r) => ruleMatches(r, p, categories)));
  }

  switch (opts.view) {
    case "deals":
      return result
        // A sale price or a running promotion — whichever makes the price.
        .filter((p) => p.pricing.compareAt != null)
        .sort((a, b) => (b.pricing.discountPercent ?? 0) - (a.pricing.discountPercent ?? 0));
    case "picks":
      return result.filter((p) => p.featured);
    case "new":
      return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    default:
      return result;
  }
}
