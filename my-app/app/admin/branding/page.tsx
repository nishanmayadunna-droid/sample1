import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { getBrand } from "@/lib/brand-data";
import AdminTabs from "../AdminTabs";
import BrandForm from "./BrandForm";
import LogoUpload from "./LogoUpload";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminBrandingPage() {
  await requireAdmin("/admin/branding");
  const brand = await getBrand();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="branding" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Branding</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        Your shop&apos;s name, logo, colours and fonts. A change shows on the whole shop (header, footer, share cards, emails,
        SMS and push) within a minute. The home page and About page wording is not changed here.
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Pictures</h2>
        <div className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
          <LogoUpload slot="logo" path={brand.logoPath} />
          <LogoUpload slot="logoDark" path={brand.logoDarkPath} />
          <LogoUpload slot="favicon" path={brand.faviconPath} />
          <LogoUpload slot="share" path={brand.shareImagePath} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Name, colours and fonts</h2>
        <div className="mt-4">
          <BrandForm brand={brand} />
        </div>
      </section>
    </div>
  );
}
