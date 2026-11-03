"use client";

import { useActionState, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { isValidProductId, MAX_IMAGE_BYTES, type FieldName } from "@/lib/product-form";
import { MAX_PHOTOS, moveItem, publicPhotoUrl } from "@/lib/product-photos";
import { categorySelectDefault } from "@/lib/category-form";
import type { Category } from "@/lib/products";
import type { AdminProduct } from "@/lib/admin-products";
import { requestImageUpload, type ProductFormState } from "./actions";

const UPLOAD_FAILED = "Photo upload failed. Try again.";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const initialState: ProductFormState = { errors: {} };

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

// Prices are stored in cents; the form edits rupees.
const rupees = (cents: number | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2);

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-blaze">{error}</span>}
    </label>
  );
}

export default function ProductForm({
  mode,
  action,
  product,
  categories,
}: {
  mode: "create" | "update";
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: AdminProduct;
  /** Options for the category select (value = slug, label = name). */
  categories: Category[];
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const [id, setId] = useState(product?.id ?? "");
  const [sizesText, setSizesText] = useState(product?.sizes.join(", ") ?? "");
  // Typed stock per size; a size with no entry (or "") is not tracked.
  const [stockText, setStockText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(product?.stock ?? {}).map(([size, n]) => [size, String(n)])),
  );
  const sizeList = [...new Set(sizesText.split(",").map((s) => s.trim()).filter(Boolean))];
  const stockJson = JSON.stringify(
    Object.fromEntries(
      sizeList
        .filter((size) => (stockText[size] ?? "").trim() !== "")
        .map((size) => [size, Number(stockText[size])]),
    ),
  );
  // Storage paths of the gallery photos, main photo first.
  const [photos, setPhotos] = useState<string[]>(product?.photoPaths ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const errors: Partial<Record<FieldName | "form", string>> = state.errors;
  const categoryDefault = categorySelectDefault(product?.category, categories);

  // Uploads straight to Storage with a one-time signed URL from the server, so
  // the photo never passes through a size-limited Server Action body.
  async function handleFile(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) {
      setUploadError(`A product can have up to ${MAX_PHOTOS} photos.`);
      return;
    }
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setUploadError(UPLOAD_FAILED);
      return;
    }
    if (!isValidProductId(id)) {
      setUploadError("Enter a valid ID before adding a photo.");
      return;
    }
    setUploading(true);
    try {
      const signed = await requestImageUpload(id, file.type, file.size);
      if ("error" in signed) throw new Error(signed.error);
      const { error } = await createClient()
        .storage.from("product-images")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      setPhotos((current) => [...current, signed.path]);
    } catch (error) {
      console.error("photo upload failed", error);
      setUploadError(UPLOAD_FAILED);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      // Submitted from onSubmit rather than `action={submit}`: React 19 resets a
      // form after every form action, which would wipe (create) or revert
      // (edit) the admin's input whenever validation returns an error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="max-w-2xl"
    >
      {mode === "create" ? (
        <Field label="ID (used in the product URL)" error={errors.id}>
          <input
            name="id"
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder="trail-cap"
            className={`${inputClass} font-mono`}
            required
          />
        </Field>
      ) : (
        <p className="mt-5 font-mono text-sm text-muted">ID: {id}</p>
      )}

      <Field label="Name" error={errors.name}>
        <input name="name" defaultValue={product?.name} className={inputClass} required />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Price (Rs)" error={errors.price}>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={rupees(product?.price)}
            placeholder="850.00"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Sale price (optional)" error={errors.salePrice}>
          <input
            name="salePrice"
            inputMode="decimal"
            defaultValue={rupees(product?.salePrice)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Category" error={errors.category}>
        <select
          name="category"
          defaultValue={categoryDefault.value}
          className={inputClass}
        >
          {categoryDefault.missing !== null && (
            <option value="" disabled>
              {categoryDefault.missing} (missing, pick another)
            </option>
          )}
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Description" error={errors.description}>
        <textarea
          name="description"
          defaultValue={product?.description}
          rows={4}
          className={inputClass}
          required
        />
      </Field>

      {/* The stock this form was opened with: orders change stock meanwhile. */}
      <input type="hidden" name="stockOriginal" value={JSON.stringify(product?.stock ?? {})} />

      <Field label="Sizes (comma-separated)" error={errors.sizes}>
        <input
          name="sizes"
          value={sizesText}
          onChange={(event) => setSizesText(event.target.value)}
          placeholder="XS, S, M, L, XL"
          className={inputClass}
          required
        />
      </Field>

      {sizeList.length > 0 && (
        <div className="mt-5">
          <span className="eyebrow text-muted">Stock per size (blank = not tracked)</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {sizeList.map((size) => (
              <label key={size} className="block">
                <span className="font-mono text-xs text-muted">{size}</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  step={1}
                  value={stockText[size] ?? ""}
                  onChange={(event) =>
                    setStockText((current) => ({ ...current, [size]: event.target.value }))
                  }
                  aria-label={`Stock for size ${size}`}
                  className="mt-1 block w-24 rounded-md border border-line bg-bg px-3 py-2 outline-none focus:border-ink"
                />
              </label>
            ))}
          </div>
          <input type="hidden" name="stock" value={stockJson} />
          {errors.stock && <span className="mt-1 block text-sm text-blaze">{errors.stock}</span>}
        </div>
      )}

      <div className="grid gap-x-4 sm:grid-cols-3">
        <Field label="Material" error={errors.material}>
          <input name="material" defaultValue={product?.spec.material} className={inputClass} required />
        </Field>
        <Field label="Construction" error={errors.construction}>
          <input
            name="construction"
            defaultValue={product?.spec.construction}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Origin" error={errors.origin}>
          <input name="origin" defaultValue={product?.spec.origin} className={inputClass} required />
        </Field>
      </div>

      <div className="mt-5">
        <span className="eyebrow text-muted">
          Photos (up to {MAX_PHOTOS}, the first is the main photo)
        </span>
        <ul className="mt-2 flex flex-wrap gap-3">
          {photos.map((path, index) => (
            <li key={path} className="w-28">
              <div className="h-28 w-28 overflow-hidden rounded-lg border border-line">
                {/* A plain img: admin thumbnails need no optimisation. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, path)}
                  alt={`Photo ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setPhotos((current) => moveItem(current, index, index - 1))}
                  aria-label={`Move photo ${index + 1} earlier`}
                  className="rounded border border-line px-2 disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={index === photos.length - 1}
                  onClick={() => setPhotos((current) => moveItem(current, index, index + 1))}
                  aria-label={`Move photo ${index + 1} later`}
                  className="rounded border border-line px-2 disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => setPhotos((current) => current.filter((p) => p !== path))}
                  aria-label={`Remove photo ${index + 1}`}
                  className="rounded border border-line px-2 text-blaze"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
        {photos.length < MAX_PHOTOS && (
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            // Re-selecting the same file must fire onChange again.
            key={photos.length}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="mt-3 text-sm"
          />
        )}
        {uploading && <p className="mt-2 text-sm text-muted">Uploading…</p>}
        {uploadError && <p className="mt-2 text-sm text-blaze">{uploadError}</p>}
        <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Swatch color 1 (shown without a photo)" error={errors.swatchA}>
          <input
            type="color"
            name="swatchA"
            defaultValue={product?.swatch[0] ?? "#d4d4d4"}
            className="mt-2 h-12 w-full"
          />
        </Field>
        <Field label="Swatch color 2" error={errors.swatchB}>
          <input
            type="color"
            name="swatchB"
            defaultValue={product?.swatch[1] ?? "#737373"}
            className="mt-2 h-12 w-full"
          />
        </Field>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Sort order" error={errors.sortOrder}>
          <input
            name="sortOrder"
            inputMode="numeric"
            defaultValue={product?.sortOrder ?? 0}
            className={inputClass}
          />
        </Field>
        <label className="mt-5 flex items-center gap-3 self-end py-3">
          <input type="checkbox" name="featured" defaultChecked={product?.featured} />
          <span className="eyebrow text-muted">Featured on the home page</span>
        </label>
      </div>

      {errors.form && <p className="mt-6 text-sm text-blaze">{errors.form}</p>}
      <button
        type="submit"
        disabled={pending || uploading}
        className="mt-6 w-full rounded-full bg-blaze py-4 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
      </button>
    </form>
  );
}
