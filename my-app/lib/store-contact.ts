export type StoreContact = {
  businessName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  returnDays: number;
};

export const DEFAULT_STORE_CONTACT: StoreContact = {
  businessName: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  hours: "",
  returnDays: 7,
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip spaces and dashes; null unless an optional leading + and 9-15 digits remain. */
function cleanNumber(raw: string): string | null {
  const stripped = raw.replace(/[\s-]/g, "");
  return /^\+?\d{9,15}$/.test(stripped) ? stripped : null;
}

export function parseContactForm(
  fields: Record<string, string | undefined>,
): { ok: true; value: StoreContact } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const get = (k: string) => (fields[k] ?? "").trim();

  const businessName = get("businessName");
  if (businessName.length > 80) errors.businessName = "Business name must be 80 characters or fewer.";

  const numberField = (key: "phone" | "whatsapp", label: string): string => {
    const raw = get(key);
    if (raw === "") return "";
    const cleaned = cleanNumber(raw);
    if (!cleaned) {
      errors[key] = `${label} must be 9-15 digits, with an optional leading +.`;
      return "";
    }
    return cleaned;
  };
  const phone = numberField("phone", "Phone");
  const whatsapp = numberField("whatsapp", "WhatsApp number");

  const email = get("email");
  if (email !== "" && (email.length > 120 || !EMAIL_SHAPE.test(email))) {
    errors.email = "Enter a valid email address (120 characters or fewer).";
  }

  const address = get("address");
  if (address.length > 300) errors.address = "Address must be 300 characters or fewer.";
  const hours = get("hours");
  if (hours.length > 120) errors.hours = "Opening hours must be 120 characters or fewer.";

  const rawDays = get("returnDays");
  let returnDays = DEFAULT_STORE_CONTACT.returnDays;
  if (rawDays !== "") {
    if (!/^\d+$/.test(rawDays) || Number(rawDays) > 60) {
      errors.returnDays = "Return days must be a whole number from 0 to 60.";
    } else {
      returnDays = Number(rawDays);
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { businessName, phone, whatsapp, email, address, hours, returnDays } };
}

export function telHref(phone: string): string | null {
  const cleaned = cleanNumber(phone);
  return cleaned ? `tel:${cleaned}` : null;
}

export function whatsappHref(number: string): string | null {
  const cleaned = cleanNumber(number);
  if (!cleaned) return null;
  let digits = cleaned.replace(/\+/g, "");
  if (digits.startsWith("0") && digits.length === 10) digits = `94${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

export function mailHref(email: string): string | null {
  const e = email.trim();
  return e !== "" && e.length <= 120 && EMAIL_SHAPE.test(e) ? `mailto:${e}` : null;
}
