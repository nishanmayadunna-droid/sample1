// Pure delivery rules: the 25 districts, zone fees, courier tracking links and
// shipment details. No I/O; the admin forms and checkout call these.

export const DISTRICTS: readonly { en: string; si: string }[] = [
  { en: "Ampara", si: "අම්පාර" },
  { en: "Anuradhapura", si: "අනුරාධපුර" },
  { en: "Badulla", si: "බදුල්ල" },
  { en: "Batticaloa", si: "මඩකලපුව" },
  { en: "Colombo", si: "කොළඹ" },
  { en: "Galle", si: "ගාල්ල" },
  { en: "Gampaha", si: "ගම්පහ" },
  { en: "Hambantota", si: "හම්බන්තොට" },
  { en: "Jaffna", si: "යාපනය" },
  { en: "Kalutara", si: "කළුතර" },
  { en: "Kandy", si: "මහනුවර" },
  { en: "Kegalle", si: "කෑගල්ල" },
  { en: "Kilinochchi", si: "කිලිනොච්චි" },
  { en: "Kurunegala", si: "කුරුණෑගල" },
  { en: "Mannar", si: "මන්නාරම" },
  { en: "Matale", si: "මාතලේ" },
  { en: "Matara", si: "මාතර" },
  { en: "Monaragala", si: "මොණරාගල" },
  { en: "Mullaitivu", si: "මුලතිව්" },
  { en: "Nuwara Eliya", si: "නුවරඑළිය" },
  { en: "Polonnaruwa", si: "පොලොන්නරුව" },
  { en: "Puttalam", si: "පුත්තලම" },
  { en: "Ratnapura", si: "රත්නපුර" },
  { en: "Trincomalee", si: "ත්‍රිකුණාමලය" },
  { en: "Vavuniya", si: "වවුනියාව" },
];

const DISTRICT_NAMES = new Set(DISTRICTS.map((d) => d.en));

/** True for the exact English name of one of the 25 districts. */
export function isDistrict(value: unknown): value is string {
  return typeof value === "string" && DISTRICT_NAMES.has(value);
}

/** One weight band: orders up to `upToGrams` pay `fee` cents (the bands are ascending). */
export type WeightBand = { upToGrams: number; fee: number };

export type Zone = {
  id: string;
  name: string;
  fee: number; // cents; the flat fee, and the fee when the weight is unknown
  districts: string[];
  sortOrder: number;
  /** Weight bands (cents). Empty or absent = the flat fee always. */
  bands?: WeightBand[];
  /** Cents added per started kilogram above the last band. */
  extraPerKg?: number;
};

/**
 * What one zone charges for a parcel of `weightGrams`. No bands, or a weight
 * that is unknown (some item has no weight), means the flat zone fee. Within
 * the bands the first band that fits wins; above the last band it is the last
 * band's fee plus `extraPerKg` for every started kilogram over it.
 */
export function feeForWeight(zone: Zone, weightGrams: number | null | undefined): number {
  const bands = zone.bands ?? [];
  if (bands.length === 0 || weightGrams == null || !Number.isFinite(weightGrams) || weightGrams < 0) {
    return zone.fee;
  }
  const hit = bands.find((band) => weightGrams <= band.upToGrams);
  if (hit) return hit.fee;
  const last = bands[bands.length - 1];
  const extraKg = Math.ceil((weightGrams - last.upToGrams) / 1000);
  return last.fee + extraKg * (zone.extraPerKg ?? 0);
}

/**
 * Total grams of an order, or null when it can't be known: no lines, or any
 * line whose product has no weight (then the flat zone fee applies).
 */
export function orderWeightGrams(
  lines: { id: string; quantity: number }[],
  products: { id: string; weightGrams?: number | null }[],
): number | null {
  if (lines.length === 0) return null;
  const weights = new Map(products.map((p) => [p.id, p.weightGrams]));
  let total = 0;
  for (const line of lines) {
    const grams = weights.get(line.id);
    if (typeof grams !== "number" || !Number.isFinite(grams) || grams <= 0) return null;
    total += grams * line.quantity;
  }
  return total;
}

/** Fee in cents: the first zone containing the district (by weight if it has bands), else the default. */
export function shippingFeeFor(
  district: string | null,
  zones: Zone[],
  defaultFee: number,
  weightGrams?: number | null,
): number {
  if (district === null) return defaultFee;
  const zone = zones.find((z) => z.districts.includes(district));
  return zone ? feeForWeight(zone, weightGrams) : defaultFee;
}

const ZONE_MAX = 10;
const ZONE_NAME_MAX = 40;
const ZONE_FEE_MAX_RUPEES = 100000;

const BAND_MAX = 6;
const BAND_MAX_GRAMS = 100000;

export type ZoneInput = {
  name: string;
  fee: string | number;
  districts: string[];
  /** Weight bands in rupees: orders up to `upToGrams` pay `fee`. */
  bands?: { upToGrams: string | number; fee: string | number }[];
  /** Rupees per started kilogram above the last band. */
  extraPerKg?: string | number;
};

export type ZoneValue = {
  name: string;
  fee: number;
  districts: string[];
  /** Only present when the zone has weight bands. */
  bands?: WeightBand[];
  extraPerKg?: number;
};

/** A whole number from a plain digits string or an integer, else NaN. */
function wholeNumber(raw: string | number | undefined): number {
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (typeof value === "string") return /^\d+$/.test(value) ? Number(value) : Number.NaN;
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
}

export function validateZones(
  zones: ZoneInput[],
): { ok: true; value: ZoneValue[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (zones.length > ZONE_MAX) errors.push(`At most ${ZONE_MAX} zones.`);

  const seen = new Set<string>();
  const value: ZoneValue[] = [];
  zones.forEach((zone, i) => {
    const label = `Zone ${i + 1}`;
    const name = (zone.name ?? "").trim();
    if (name.length < 1 || name.length > ZONE_NAME_MAX) {
      errors.push(`${label}: name is required (max ${ZONE_NAME_MAX} characters).`);
    }

    const raw = typeof zone.fee === "string" ? zone.fee.trim() : zone.fee;
    const rupees =
      typeof raw === "string" ? (/^\d+$/.test(raw) ? Number(raw) : NaN) : raw;
    if (!Number.isInteger(rupees) || rupees < 0 || rupees > ZONE_FEE_MAX_RUPEES) {
      errors.push(`${label}: fee must be a whole number from 0 to ${ZONE_FEE_MAX_RUPEES}.`);
    }

    for (const district of zone.districts) {
      if (!isDistrict(district)) {
        errors.push(`${label}: unknown district "${district}".`);
      } else if (seen.has(district)) {
        errors.push(`${label}: ${district} is already in a zone.`);
      }
      seen.add(district);
    }

    const entry: ZoneValue = { name, fee: rupees * 100, districts: [...zone.districts] };

    const rawBands = zone.bands ?? [];
    if (rawBands.length > BAND_MAX) errors.push(`${label}: at most ${BAND_MAX} weight bands.`);
    const bands: WeightBand[] = [];
    let previous = 0;
    rawBands.forEach((band, j) => {
      const bandLabel = `${label}, band ${j + 1}`;
      const grams = wholeNumber(band.upToGrams);
      const fee = wholeNumber(band.fee);
      if (!(grams >= 1 && grams <= BAND_MAX_GRAMS)) {
        errors.push(`${bandLabel}: weight must be a whole number of grams from 1 to ${BAND_MAX_GRAMS}.`);
      } else if (grams <= previous) {
        errors.push(`${bandLabel}: each band must be heavier than the one before it.`);
      } else {
        previous = grams;
      }
      if (!(fee >= 0 && fee <= ZONE_FEE_MAX_RUPEES)) {
        errors.push(`${bandLabel}: fee must be a whole number from 0 to ${ZONE_FEE_MAX_RUPEES}.`);
      }
      bands.push({ upToGrams: grams, fee: fee * 100 });
    });

    const rawExtra = zone.extraPerKg;
    const hasExtra = rawExtra !== undefined && String(rawExtra).trim() !== "";
    const extra = hasExtra ? wholeNumber(rawExtra) : 0;
    if (hasExtra && !(extra >= 0 && extra <= ZONE_FEE_MAX_RUPEES)) {
      errors.push(`${label}: the fee per extra kilogram must be a whole number from 0 to ${ZONE_FEE_MAX_RUPEES}.`);
    }
    if (bands.length === 0 && extra > 0) {
      errors.push(`${label}: add weight bands before setting a fee per extra kilogram.`);
    }

    if (bands.length > 0) {
      entry.bands = bands;
      entry.extraPerKg = extra * 100;
    }
    value.push(entry);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/** The courier's tracking link for a number, or null when the template is unusable. */
export function trackingUrl(template: string | null, number: string): string | null {
  if (template === null) return null;
  if (!template.startsWith("https://") || !template.includes("{number}")) return null;
  return template.split("{number}").join(encodeURIComponent(number));
}

const COURIER_NAME_MIN = 2;
const COURIER_NAME_MAX = 40;
const TEMPLATE_MAX = 200;

export function validateCourier(input: { name: string; template: string }):
  | { ok: true; value: { name: string; template: string | null } }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const name = (input.name ?? "").trim();
  if (name.length < COURIER_NAME_MIN || name.length > COURIER_NAME_MAX) {
    errors.name = "Name must be 2 to 40 characters.";
  }

  const template = (input.template ?? "").trim();
  if (template.length > TEMPLATE_MAX) {
    errors.template = "Link is too long (max 200 characters).";
  } else if (template !== "" && trackingUrl(template, "SAMPLE123") === null) {
    errors.template = "Use a link starting with https:// that contains {number}.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, template: template === "" ? null : template } };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACKING_PATTERN = /^[A-Za-z0-9-]{3,40}$/;

export function parseShipment(fields: { courierId?: string; trackingNumber?: string }):
  | { ok: true; value: { courierId: string; trackingNumber: string } }
  | { ok: false; errors: Record<string, true> } {
  const errors: Record<string, true> = {};
  const courierId = (fields.courierId ?? "").trim();
  const trackingNumber = (fields.trackingNumber ?? "").trim();
  if (!UUID_PATTERN.test(courierId)) errors.courierId = true;
  if (!TRACKING_PATTERN.test(trackingNumber)) errors.trackingNumber = true;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { courierId, trackingNumber } };
}
