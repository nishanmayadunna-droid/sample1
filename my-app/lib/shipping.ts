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

export type Zone = {
  id: string;
  name: string;
  fee: number; // cents
  districts: string[];
  sortOrder: number;
};

/** Fee in cents: the first zone containing the district, else the default. */
export function shippingFeeFor(
  district: string | null,
  zones: Zone[],
  defaultFee: number,
): number {
  if (district === null) return defaultFee;
  return zones.find((z) => z.districts.includes(district))?.fee ?? defaultFee;
}

const ZONE_MAX = 10;
const ZONE_NAME_MAX = 40;
const ZONE_FEE_MAX_RUPEES = 100000;

export function validateZones(
  zones: { name: string; fee: string | number; districts: string[] }[],
):
  | { ok: true; value: { name: string; fee: number; districts: string[] }[] }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (zones.length > ZONE_MAX) errors.push(`At most ${ZONE_MAX} zones.`);

  const seen = new Set<string>();
  const value: { name: string; fee: number; districts: string[] }[] = [];
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

    value.push({ name, fee: rupees * 100, districts: [...zone.districts] });
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
