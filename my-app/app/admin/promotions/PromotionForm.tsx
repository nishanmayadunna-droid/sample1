"use client";

import { useActionState, useState, useTransition } from "react";
import PromoBanner from "@/app/components/PromoBanner";
import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGE_BYTES } from "@/lib/product-form";
import { utcIsoToColombo, type PromotionFieldName } from "@/lib/promotion-form";
import type { Promotion, PromotionBanner } from "@/lib/promotions";
import { requestPromotionImageUpload, type PromotionFormState } from "./actions";
import RulesEditor, { type PickerCategory, type PickerProduct } from "./RulesEditor";

const initialState: PromotionFormState = { errors: {} };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UPLOAD_FAILED = "Banner upload failed. Try again.";
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      {children}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <span className="mt-1 block text-sm text-blaze">{message}</span> : null;
}

type BannerFields = {
  mode: PromotionBanner["mode"];
  headlineSi: string;
  headlineEn: string;
  subtextSi: string;
  subtextEn: string;
  buttonSi: string;
  buttonEn: string;
  colorFrom: string;
  colorTo: string;
  textColor: string;
  altSi: string;
  altEn: string;
};

function initialBanner(promotion: Promotion | undefined): BannerFields {
  const b = promotion?.banner;
  const base: BannerFields = {
    mode: b?.mode ?? "template",
    headlineSi: "",
    headlineEn: "",
    subtextSi: "",
    subtextEn: "",
    buttonSi: "",
    buttonEn: "",
    colorFrom: "#cb4a1c",
    colorTo: "#15231d",
    textColor: "#ffffff",
    altSi: "",
    altEn: "",
  };
  if (b?.mode === "template") return { ...base, ...b, mode: "template" };
  if (b?.mode === "image") return { ...base, mode: "image", altSi: b.altSi, altEn: b.altEn };
  return base;
}

export default function PromotionForm({
  mode,
  action,
  promotion,
  existingImageUrl,
  categories,
  products,
}: {
  mode: "create" | "update";
  action: (prev: PromotionFormState, formData: FormData) => Promise<PromotionFormState>;
  promotion?: Promotion;
  existingImageUrl: string | null;
  categories: PickerCategory[];
  products: PickerProduct[];
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const errors: Partial<Record<PromotionFieldName, string>> = state.errors;

  const [slug, setSlug] = useState(promotion?.slug ?? "");
  const [nameSi, setNameSi] = useState(promotion?.nameSi ?? "");
  const [nameEn, setNameEn] = useState(promotion?.nameEn ?? "");
  const [banner, setBanner] = useState<BannerFields>(() => initialBanner(promotion));
  const [imagePath, setImagePath] = useState("");
  const [preview, setPreview] = useState<string | null>(existingImageUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = (patch: Partial<BannerFields>) => setBanner((b) => ({ ...b, ...patch }));

  // Uploads straight to Storage with a one-time signed URL from the server, so
  // the image never passes through a size-limited Server Action body.
  async function handleFile(file: File | undefined) {
    setUploadError(null);
    setImagePath("");
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setUploadError("Use a JPEG, PNG or WebP image up to 5 MB.");
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setUploadError("Enter a valid slug before adding an image.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const signed = await requestPromotionImageUpload(slug, file.type, file.size);
      if ("error" in signed) throw new Error(signed.error);
      const { error } = await createClient()
        .storage.from("promotion-images")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      setImagePath(signed.path);
    } catch (error) {
      console.error("banner upload failed", error);
      setPreview(existingImageUrl);
      setUploadError(UPLOAD_FAILED);
    } finally {
      setUploading(false);
    }
  }

  const previewPromotion: Promotion = {
    id: promotion?.id ?? "preview",
    slug: slug || "preview",
    nameSi,
    nameEn,
    startsAt: promotion?.startsAt ?? new Date(0).toISOString(),
    endsAt: null,
    active: true,
    sortOrder: 0,
    rules: [],
    banner:
      banner.mode === "template"
        ? { ...banner, mode: "template", imageUrl: preview }
        : banner.mode === "image" && preview
          ? { mode: "image", imageUrl: preview, altSi: banner.altSi, altEn: banner.altEn }
          : { mode: "none" },
  };

  return (
    <form
      // onSubmit rather than `action={submit}`: React 19 resets a form after
      // every form action, which would wipe the input on a validation error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="max-w-3xl"
    >
      <h2 className="display mt-8 text-2xl">Basics</h2>
      {mode === "create" ? (
        <Field label="Slug (used in links like /products?promo=…, can't be changed later)">
          <input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="halloween-2026"
            className={`${inputClass} font-mono`}
            required
          />
          <ErrorText message={errors.slug} />
        </Field>
      ) : (
        <p className="mt-5 font-mono text-sm text-muted">Slug: {slug}</p>
      )}
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Name — සිංහල">
          <input name="nameSi" value={nameSi} onChange={(e) => setNameSi(e.target.value)} maxLength={60} className={inputClass} />
        </Field>
        <Field label="Name — English">
          <input name="nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={60} className={inputClass} />
        </Field>
      </div>
      <ErrorText message={errors.name} />

      <h2 className="display mt-10 text-2xl">Schedule</h2>
      <p className="mt-1 text-sm text-muted">Sri Lanka time. Changes reach the shop within about a minute.</p>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Starts">
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={promotion ? utcIsoToColombo(promotion.startsAt) : ""}
            className={inputClass}
            required
          />
          <ErrorText message={errors.startsAt} />
        </Field>
        <Field label="Ends (empty = no end)">
          <input
            type="datetime-local"
            name="endsAt"
            defaultValue={promotion?.endsAt ? utcIsoToColombo(promotion.endsAt) : ""}
            className={inputClass}
          />
          <ErrorText message={errors.endsAt} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="active" defaultChecked={promotion?.active ?? true} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          Order
          <input
            name="sortOrder"
            type="number"
            defaultValue={promotion?.sortOrder ?? 0}
            className="w-20 rounded-md border border-line bg-bg px-3 py-2"
          />
        </label>
      </div>

      <h2 className="display mt-10 text-2xl">Banner</h2>
      <input type="hidden" name="bannerMode" value={banner.mode} />
      <input type="hidden" name="imagePath" value={imagePath} />
      <input type="hidden" name="hasImage" value={existingImageUrl ? "1" : ""} />
      <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Banner type">
        {(["none", "template", "image"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={banner.mode === m}
            onClick={() => set({ mode: m })}
            className={`rounded-full border px-4 py-2 text-sm ${
              banner.mode === m ? "border-blaze bg-blaze text-onaccent" : "border-line hover:border-ink"
            }`}
          >
            {m === "none" ? "No banner" : m === "template" ? "Template" : "Own image"}
          </button>
        ))}
      </div>

      {banner.mode === "template" && (
        <>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Headline — සිංහල">
              <input name="headlineSi" value={banner.headlineSi} onChange={(e) => set({ headlineSi: e.target.value })} maxLength={80} className={inputClass} />
            </Field>
            <Field label="Headline — English">
              <input name="headlineEn" value={banner.headlineEn} onChange={(e) => set({ headlineEn: e.target.value })} maxLength={80} className={inputClass} />
            </Field>
            <Field label="Sub-text — සිංහල">
              <input name="subtextSi" value={banner.subtextSi} onChange={(e) => set({ subtextSi: e.target.value })} maxLength={160} className={inputClass} />
            </Field>
            <Field label="Sub-text — English">
              <input name="subtextEn" value={banner.subtextEn} onChange={(e) => set({ subtextEn: e.target.value })} maxLength={160} className={inputClass} />
            </Field>
            <Field label="Button — සිංහල">
              <input name="buttonSi" value={banner.buttonSi} onChange={(e) => set({ buttonSi: e.target.value })} maxLength={30} placeholder="දැන් බලන්න" className={inputClass} />
            </Field>
            <Field label="Button — English">
              <input name="buttonEn" value={banner.buttonEn} onChange={(e) => set({ buttonEn: e.target.value })} maxLength={30} placeholder="Shop now" className={inputClass} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-6">
            {(
              [
                ["colorFrom", "Colour 1"],
                ["colorTo", "Colour 2"],
                ["textColor", "Text colour"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="color" name={key} value={banner[key]} onChange={(e) => set({ [key]: e.target.value })} className="h-10 w-14" />
                {label}
              </label>
            ))}
          </div>
        </>
      )}

      {banner.mode !== "none" && (
        <Field label={banner.mode === "template" ? "Photo (optional)" : "Banner image (wide, about 3:1)"}>
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            onChange={(e) => void handleFile(e.target.files?.[0])}
            className="mt-2 block text-sm"
          />
          {uploading && <span className="mt-1 block text-sm text-muted">Uploading…</span>}
          <ErrorText message={uploadError ?? undefined} />
        </Field>
      )}

      {banner.mode === "image" && (
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Image description — සිංහල">
            <input name="altSi" value={banner.altSi} onChange={(e) => set({ altSi: e.target.value })} maxLength={160} className={inputClass} />
          </Field>
          <Field label="Image description — English">
            <input name="altEn" value={banner.altEn} onChange={(e) => set({ altEn: e.target.value })} maxLength={160} className={inputClass} />
          </Field>
        </div>
      )}
      <ErrorText message={errors.banner} />

      {previewPromotion.banner.mode !== "none" && (
        <div className="mt-6">
          <p className="eyebrow mb-2 text-muted">Preview</p>
          <div className="pointer-events-none">
            <PromoBanner promotion={previewPromotion} />
          </div>
        </div>
      )}

      <h2 className="display mt-10 text-2xl">Rules</h2>
      <p className="mt-1 text-sm text-muted">
        Each item gets the lowest of its normal price, its sale price and these rules — they never stack.
      </p>
      <RulesEditor initial={promotion?.rules ?? []} categories={categories} products={products} />
      <ErrorText message={errors.rules} />

      {errors.form && <p className="mt-6 text-sm text-blaze">{errors.form}</p>}
      <button
        type="submit"
        disabled={pending || uploading}
        className="mt-8 rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create promotion" : "Save changes"}
      </button>
    </form>
  );
}
