import { brandAssetUrl, logoText, type Brand } from "@/lib/brand";

/**
 * The shop's logo: the uploaded picture (with a separate one for dark mode when there is one), or the
 * logo text in the display font, where a · gets the accent colour. Server-safe and hook-free.
 * `onDark` is for the footer panel, which is dark in both modes: it prefers the dark-mode picture.
 */
export default function BrandLogo({ brand, onDark = false, className = "" }: { brand: Brand; onDark?: boolean; className?: string }) {
  const light = brand.logoPath;
  const dark = brand.logoDarkPath;
  const main = onDark ? (dark ?? light) : light;
  if (main) {
    return (
      <picture className={`inline-flex ${className}`}>
        {!onDark && dark && <source media="(prefers-color-scheme: dark)" srcSet={brandAssetUrl(dark)} />}
        {/* A small uploaded picture from our own public bucket; next/image adds nothing here. */}
        <img src={brandAssetUrl(main)} alt={brand.name} height={36} className="h-9 w-auto max-w-[11rem] object-contain sm:max-w-[16rem]" />
      </picture>
    );
  }
  const parts = logoText(brand).split("·");
  return (
    <span className={`display inline-block max-w-[11rem] truncate text-2xl leading-none tracking-tight sm:max-w-[16rem] ${className}`}>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && <span className="text-blaze">·</span>}
          {part}
        </span>
      ))}
    </span>
  );
}
