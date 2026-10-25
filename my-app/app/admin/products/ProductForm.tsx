"use client";

import { useActionState, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { isValidProductId, MAX_IMAGE_BYTES, type FieldName } from "@/lib/product-form";
import { CATEGORIES } from "@/lib/products";
import type { AdminProduct } from "@/lib/admin-products";
import ProductImage from "@/app/components/ProductImage";
import { requestImageUpload, type ProductFormState } from "./actions";

const UPLOAD_FAILED = "Photo upload failed. Try again.";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const initialState: ProductFormState = { errors: {} };

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

const dollars = (cents: number | undefined) =>
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
}: {
  mode: "create" | "update";
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: AdminProduct;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const [id, setId] = useState(product?.id ?? "");
  const [imagePath, setImagePath] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const errors: Partial<Record<FieldName | "form", string>> = state.errors;

  // Uploads straight to Storage with a one-time signed URL from the server, so
  // the photo never passes through a size-limited Server Action body.
  async function handleFile(file: File | undefined) {
    setUploadError(null);
    setImagePath("");
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setUploadError(UPLOAD_FAILED);
      return;
    }
    if (!isValidProductId(id)) {
      setUploadError("Enter a valid ID before adding a photo.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const signed = await requestImageUpload(id, file.type, file.size);
      if ("error" in signed) throw new Error(signed.error);
      const { error } = await createClient()
        .storage.from("product-images")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      setImagePath(signed.path);
    } catch (error) {
      console.error("photo upload failed", error);
      setPreview(null);
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
        <Field label="Price (USD)" error={errors.price}>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={dollars(product?.price)}
            placeholder="28.00"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Sale price (optional)" error={errors.salePrice}>
          <input
            name="salePrice"
            inputMode="decimal"
            defaultValue={dollars(product?.salePrice)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Category" error={errors.category}>
        <select
          name="category"
          defaultValue={product?.category ?? CATEGORIES[0]}
          className={inputClass}
        >
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
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

      <Field label="Sizes (comma-separated)" error={errors.sizes}>
        <input
          name="sizes"
          defaultValue={product?.sizes.join(", ")}
          placeholder="XS, S, M, L, XL"
          className={inputClass}
          required
        />
      </Field>

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
        <span className="eyebrow text-muted">Photo</span>
        <div className="mt-2 flex items-center gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-line">
            {preview ? (
              // A local blob: URL, which next/image can't optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="New photo preview" className="h-full w-full object-cover" />
            ) : product ? (
              <ProductImage product={product} sizes="96px" className="h-full w-full" />
            ) : null}
          </div>
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="text-sm"
          />
        </div>
        {uploading && <p className="mt-2 text-sm text-muted">Uploading…</p>}
        {uploadError && <p className="mt-2 text-sm text-blaze">{uploadError}</p>}
        <input type="hidden" name="imagePath" value={imagePath} />
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
