import Link from "next/link";
import type { Category } from "@/lib/products";
import { promiseItems, type StorePromise } from "@/lib/storefront-form";
import L from "./L";
import PromiseIcon from "./PromiseIcon";

const linkClass = "hover:text-panelink";
const headingClass = "font-mono text-[0.7rem] uppercase tracking-[0.16em] text-panelink";

export default function Footer({
  categories,
  promises,
  freeShippingThreshold,
}: {
  categories: Category[];
  promises: StorePromise[];
  /** From the running promotions; null hides the free-shipping line. */
  freeShippingThreshold: number | null;
}) {
  return (
    <footer className="mt-8 bg-panel text-panelmuted">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="display text-2xl text-panelink">
            North<span className="text-blaze">·</span>bound
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            <L
              si="Demo සාප්පුවකි. ඉවත දමන්න නොව, දිගු කලක් අඳින්නට."
              en="A demo storefront. Built to be worn out, not thrown out."
            />
          </p>
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className={headingClass}>
            <L si="සාප්පුව" en="Shop" />
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            <li>
              <Link href="/products?view=deals" className={linkClass}>
                ⚡ Flash Deals
              </Link>
            </li>
            <li>
              <Link href="/products?view=picks" className={linkClass}>
                ⭐ <L si="තෝරාගත් භාණ්ඩ" en="Top Picks" />
              </Link>
            </li>
            <li>
              <Link href="/products?view=new" className={linkClass}>
                🆕 <L si="අලුතින් ආ" en="New In" />
              </Link>
            </li>
            <li>
              <Link href="/products" className={linkClass}>
                <L si="සියලු භාණ්ඩ" en="All products" />
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-categories">
          <h2 id="footer-categories" className={headingClass}>
            <L si="වර්ග" en="Categories" />
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className={linkClass}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={headingClass}>
            <L si="උදව් සහ ගිණුම" en="Help & account" />
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            <li>
              <Link href="/orders" className={linkClass}>
                <L si="මගේ ඇණවුම්" en="My orders" />
              </Link>
            </li>
            <li>
              <Link href="/account" className={linkClass}>
                <L si="මගේ ගිණුම" en="My account" />
              </Link>
            </li>
            <li>
              <Link href="/cart" className={linkClass}>
                <L si="කරත්තය" en="Cart" />
              </Link>
            </li>
            <li>
              <Link href="/about" className={linkClass}>
                <L si="අප ගැන" en="About" />
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkClass}>
                <L si="සම්බන්ධ වන්න" en="Contact" />
              </Link>
            </li>
            <li>
              <Link href="/returns" className={linkClass}>
                <L si="ආපසු භාර දීම" en="Returns" />
              </Link>
            </li>
            <li>
              <Link href="/size-guide" className={linkClass}>
                <L si="ප්‍රමාණ මාර්ගෝපදේශය" en="Size guide" />
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkClass}>
                <L si="රහස්‍යතා ප්‍රතිපත්තිය" en="Privacy" />
              </Link>
            </li>
            <li>
              <Link href="/terms" className={linkClass}>
                <L si="කොන්දේසි" en="Terms" />
              </Link>
            </li>
          </ul>
          <ul className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-sm">
            {promiseItems(promises, freeShippingThreshold).map((item) => (
              <li key={item.key} className="flex items-start gap-2">
                <PromiseIcon icon={item.icon} className="mt-0.5 h-4 w-4 text-blaze" />
                <L si={item.si} en={item.en} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
