import Image from "next/image";
import Link from "next/link";
import type { Promotion } from "@/lib/promotions";
import L from "./L";

/**
 * One promotion's banner: a template (gradient, bilingual text, optional
 * photo, button) or the admin's own artwork. Nothing for banner mode "none".
 */
export default function PromoBanner({
  promotion,
  preload = false,
}: {
  promotion: Promotion;
  preload?: boolean;
}) {
  const { banner } = promotion;
  const href = `/products?promo=${encodeURIComponent(promotion.slug)}`;

  if (banner.mode === "image") {
    return (
      <Link
        href={href}
        className="relative block aspect-[16/9] overflow-hidden rounded-2xl border border-line sm:aspect-[3/1]"
      >
        <Image
          src={banner.imageUrl}
          alt=""
          fill
          sizes="(min-width: 1152px) 1152px, 100vw"
          preload={preload}
          className="object-cover"
        />
        <span className="sr-only">
          <L si={banner.altSi || promotion.nameSi} en={banner.altEn || promotion.nameEn} />
        </span>
      </Link>
    );
  }

  if (banner.mode !== "template") return null;

  return (
    <section
      className="relative grid overflow-hidden rounded-2xl sm:grid-cols-[1.2fr_1fr]"
      style={{
        background: `linear-gradient(135deg, ${banner.colorFrom}, ${banner.colorTo})`,
        color: banner.textColor,
      }}
    >
      <div className="flex flex-col items-start gap-3 p-6 sm:p-10">
        <span className="eyebrow opacity-80">
          <L si={promotion.nameSi} en={promotion.nameEn} />
        </span>
        <h2 className="display text-[clamp(1.75rem,5vw,3.25rem)]">
          <L si={banner.headlineSi} en={banner.headlineEn} />
        </h2>
        {(banner.subtextSi || banner.subtextEn) && (
          <p className="max-w-md opacity-90">
            <L si={banner.subtextSi} en={banner.subtextEn} />
          </p>
        )}
        <Link
          href={href}
          className="mt-2 rounded-full px-6 py-3 font-medium transition-transform hover:-translate-y-0.5"
          style={{ background: banner.textColor, color: banner.colorTo }}
        >
          {banner.buttonSi || banner.buttonEn ? (
            <L si={banner.buttonSi} en={banner.buttonEn} />
          ) : (
            <L si="දැන් බලන්න" en="Shop now" />
          )}
        </Link>
      </div>
      {banner.imageUrl && (
        <div className="relative min-h-48">
          <Image
            src={banner.imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 45vw, 100vw"
            preload={preload}
            className="object-cover"
          />
        </div>
      )}
    </section>
  );
}
