// Pure validation for the admin product form and photo paths. No I/O, so it is
// shared by the Server Actions, the form and the unit tests.
import { CATEGORIES, type Category } from "@/lib/products";

export type FieldName =
  | "id"
  | "name"
  | "price"
  | "salePrice"
  | "category"
  | "description"
  | "sizes"
  | "material"
  | "construction"
  | "origin"
  | "swatchA"
  | "swatchB"
  | "sortOrder";

/** Column-shaped (snake_case) so it can be written to public.products as is. */
export type ProductInput = {
  name: string;
  price: number;
  sale_price: number | null;
  category: Category;
  description: string;
  sizes: string[];
  material: string;
  construction: string;
  origin: string;
  swatch: [string, string];
  featured: boolean;
  sort_order: number;
};

const MAX_PRICE_CENTS = 10_000_000; // exclusive: prices stay under $100,000
const PRICE_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_SIZES = 12;
const MAX_SIZE_LENGTH = 20;

/** Dollars ("28", "28.5", "28.50") → integer cents, or null if invalid. */
export function parsePriceToCents(raw: string | undefined): number | null {
  const match = PRICE_PATTERN.exec((raw ?? "").trim());
  if (!match) return null;
  // Integer arithmetic only: 19.99 * 100 in floating point is 1998.999….
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 && cents < MAX_PRICE_CENTS ? cents : null;
}

export function isValidProductId(id: string): boolean {
  return id.length <= 60 && ID_PATTERN.test(id);
}

function text(raw: string | undefined, max: number): string | null {
  const value = (raw ?? "").trim();
  return value.length >= 1 && value.length <= max ? value : null;
}

function parseSizes(raw: string | undefined): string[] | null {
  const sizes: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const size = part.trim();
    if (size === "") continue;
    if (size.length > MAX_SIZE_LENGTH) return null;
    if (!sizes.includes(size)) sizes.push(size);
  }
  return sizes.length >= 1 && sizes.length <= MAX_SIZES ? sizes : null;
}

export function parseProductForm(
  fields: Record<string, string | undefined>,
  mode: "create" | "update",
):
  | { ok: true; id: string | null; value: ProductInput }
  | { ok: false; errors: Partial<Record<FieldName, string>> } {
  const errors: Partial<Record<FieldName, string>> = {};

  let id: string | null = null;
  if (mode === "create") {
    id = (fields.id ?? "").trim();
    if (!isValidProductId(id)) errors.id = "Use lowercase letters, numbers and dashes.";
  }

  const name = text(fields.name, 100);
  if (name === null) errors.name = "Name is required (max 100 characters).";

  const price = parsePriceToCents(fields.price);
  if (price === null) errors.price = "Enter a price like 28.00.";

  let salePrice: number | null = null;
  if ((fields.salePrice ?? "").trim() !== "") {
    salePrice = parsePriceToCents(fields.salePrice);
    if (salePrice === null) errors.salePrice = "Enter a price like 28.00.";
    else if (price !== null && salePrice >= price) {
      errors.salePrice = "Sale price must be lower than the price.";
    }
  }

  const category = CATEGORIES.find((c) => c === fields.category);
  if (!category) errors.category = "Pick a category.";

  const description = text(fields.description, 2000);
  if (description === null) {
    errors.description = "Description is required (max 2000 characters).";
  }

  const sizes = parseSizes(fields.sizes);
  if (sizes === null) errors.sizes = "Enter 1–12 sizes separated by commas.";

  const spec = {} as Record<"material" | "construction" | "origin", string>;
  for (const field of ["material", "construction", "origin"] as const) {
    const value = text(fields[field], 200);
    if (value === null) errors[field] = "Required (max 200 characters).";
    else spec[field] = value;
  }

  const swatch: string[] = [];
  for (const field of ["swatchA", "swatchB"] as const) {
    const value = (fields[field] ?? "").trim();
    if (!HEX_PATTERN.test(value)) errors[field] = "Pick a color.";
    else swatch.push(value.toLowerCase());
  }

  const rawSort = (fields.sortOrder ?? "").trim();
  const sortOrder = rawSort === "" ? 0 : Number(rawSort);
  if (!/^-?\d+$/.test(rawSort || "0") || !Number.isSafeInteger(sortOrder)) {
    errors.sortOrder = "Enter a whole number.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    id,
    value: {
      name: name!,
      price: price!,
      sale_price: salePrice,
      category: category!,
      description: description!,
      sizes: sizes!,
      material: spec.material,
      construction: spec.construction,
      origin: spec.origin,
      swatch: [swatch[0], swatch[1]],
      featured: fields.featured === "on",
      sort_order: sortOrder,
    },
  };
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** `<id>-<now>.<ext>`: a new name per upload so caches never serve the old photo. */
export function imagePathFor(id: string, contentType: string, now: number): string | null {
  const ext = Object.hasOwn(IMAGE_EXTENSIONS, contentType)
    ? IMAGE_EXTENSIONS[contentType]
    : undefined;
  return ext ? `${id}-${now}.${ext}` : null;
}

/** True only for this product's own upload names; rejects other ids, slashes and `..`. */
export function isValidImagePath(id: string, path: string): boolean {
  if (!isValidProductId(id)) return false;
  // id is a validated slug, so it has no regex metacharacters.
  return new RegExp(`^${id}-\\d+\\.(jpg|png|webp)$`).test(path);
}
