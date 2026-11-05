import { describe, expect, it } from "vitest";
import {
  jsonLdScript,
  organizationJsonLd,
  productJsonLd,
  robotsRules,
  sitemapEntries,
  websiteJsonLd,
} from "./seo";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const baseProduct = {
  name: "Tee",
  description: "A tee",
  url: "https://shop.lk/products/tee",
  images: ["https://shop.lk/a.jpg"],
  price: 150000,
  inStock: true,
  rating: null,
};

describe("jsonLdScript", () => {
  it("escapes angle brackets and round-trips", () => {
    const data = { a: "</script><!--", b: "x & y  " };
    const out = jsonLdScript(data);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out)).toEqual(data);
  });
});

describe("productJsonLd", () => {
  it("builds the offer from cents", () => {
    const j = productJsonLd(baseProduct) as Rec;
    expect(j["@type"]).toBe("Product");
    expect(j.offers.price).toBe("1500.00");
    expect(j.offers.priceCurrency).toBe("LKR");
    expect(j.offers.availability).toBe("https://schema.org/InStock");
    expect(j.image).toEqual(["https://shop.lk/a.jpg"]);
    expect("aggregateRating" in j).toBe(false);
  });
  it("marks out of stock", () => {
    const j = productJsonLd({ ...baseProduct, inStock: false }) as Rec;
    expect(j.offers.availability).toBe("https://schema.org/OutOfStock");
  });
  it("adds the rating as numbers", () => {
    const j = productJsonLd({ ...baseProduct, rating: { average: 4.5, count: 3 } }) as Rec;
    expect(j.aggregateRating.ratingValue).toBe(4.5);
    expect(j.aggregateRating.reviewCount).toBe(3);
  });
  it("rounds cents and omits offers for bad prices", () => {
    expect((productJsonLd({ ...baseProduct, price: 199999 }) as Rec).offers.price).toBe("1999.99");
    expect((productJsonLd({ ...baseProduct, price: 1999.6 }) as Rec).offers.price).toBe("20.00");
    expect("offers" in productJsonLd({ ...baseProduct, price: NaN })).toBe(false);
    expect("offers" in productJsonLd({ ...baseProduct, price: -1 })).toBe(false);
    expect("offers" in productJsonLd({ ...baseProduct, price: Infinity })).toBe(false);
  });
  it("omits an empty description", () => {
    expect("description" in productJsonLd({ ...baseProduct, description: "  " })).toBe(false);
  });
  it("omits image when there are none", () => {
    const j = productJsonLd({ ...baseProduct, images: [] });
    expect("image" in j).toBe(false);
  });
});

describe("organizationJsonLd", () => {
  it("omits empty phone and email", () => {
    const j = organizationJsonLd({ name: "NB", url: "https://shop.lk", phone: "", email: "" });
    expect("telephone" in j).toBe(false);
    expect("email" in j).toBe(false);
    expect(j.name).toBe("NB");
  });
  it("includes them when set", () => {
    const j = organizationJsonLd({ name: "NB", url: "https://shop.lk", phone: "0771234567", email: "a@b.lk", logo: "https://shop.lk/l.png" });
    expect(j.telephone).toBe("0771234567");
    expect(j.email).toBe("a@b.lk");
    expect(j.logo).toBe("https://shop.lk/l.png");
  });
});

describe("websiteJsonLd", () => {
  it("has a search action", () => {
    const j = websiteJsonLd({ name: "NB", url: "https://shop.lk" }) as Rec;
    expect(j["@type"]).toBe("WebSite");
    expect(j.potentialAction["@type"]).toBe("SearchAction");
    expect(j.potentialAction.target).toBe("https://shop.lk/products?q={search_term_string}");
  });
});

describe("robotsRules", () => {
  it("allows crawling in production", () => {
    const r = robotsRules({ production: true, base: "https://shop.lk" });
    expect(r.rules[0].userAgent).toBe("*");
    expect(r.rules[0].allow).toEqual(["/"]);
    expect(r.rules[0].disallow).toEqual(["/admin", "/account", "/checkout", "/cart", "/orders", "/signin", "/unsubscribe", "/api"]);
    expect(r.sitemap).toBe("https://shop.lk/sitemap.xml");
  });
  it("blocks everything elsewhere", () => {
    const r = robotsRules({ production: false, base: "https://shop.lk" });
    expect(r.rules[0].disallow).toEqual(["/"]);
    expect(r.sitemap).toBeUndefined();
  });
});

describe("sitemapEntries", () => {
  it("lists home, products, store pages and each product", () => {
    const e = sitemapEntries({ base: "https://shop.lk", productIds: ["tee", "a b"] });
    const urls = e.map((x) => x.url);
    expect(urls).toContain("https://shop.lk");
    expect(urls).toContain("https://shop.lk/products");
    for (const p of ["about", "contact", "privacy", "terms", "returns", "size-guide"]) {
      expect(urls).toContain(`https://shop.lk/${p}`);
    }
    expect(urls).toContain("https://shop.lk/products/tee");
    expect(urls).toContain("https://shop.lk/products/a%20b");
    expect(new Set(urls).size).toBe(urls.length);
    expect(e).toHaveLength(2 + 6 + 2);
    expect(e.find((x) => x.url === "https://shop.lk")).toMatchObject({ priority: 1, changeFrequency: "daily" });
    expect(e.find((x) => x.url === "https://shop.lk/products/tee")).toMatchObject({ priority: 0.7, changeFrequency: "weekly" });
  });
  it("dedupes repeated ids", () => {
    const e = sitemapEntries({ base: "https://shop.lk", productIds: ["x", "x"] });
    expect(e.filter((x) => x.url.endsWith("/products/x"))).toHaveLength(1);
  });
});
