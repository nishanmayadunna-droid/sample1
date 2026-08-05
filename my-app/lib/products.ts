export type Category = "Tops" | "Bottoms" | "Outerwear" | "Accessories";

/** Garment spec, shown as the monospace label that runs through the whole UI. */
export type Spec = {
  material: string;
  construction: string;
  origin: string;
};

export type Product = {
  id: string;
  name: string;
  /** Price in cents, to avoid floating-point money bugs. */
  price: number;
  category: Category;
  description: string;
  sizes: string[];
  spec: Spec;
  /** Two hex colors used to render the product's gradient visual. */
  swatch: [string, string];
  featured?: boolean;
};

export const CATEGORIES: Category[] = [
  "Tops",
  "Bottoms",
  "Outerwear",
  "Accessories",
];

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL"];

export const products: Product[] = [
  {
    id: "essential-tee",
    name: "Essential Cotton Tee",
    price: 2800,
    category: "Tops",
    description:
      "A midweight organic-cotton crew that keeps its shape wash after wash. Cut for an easy, everyday fit.",
    sizes: APPAREL_SIZES,
    spec: { material: "Organic cotton", construction: "6.5 oz jersey", origin: "Peru" },
    swatch: ["#f4f4f5", "#d4d4d8"],
    featured: true,
  },
  {
    id: "merino-longsleeve",
    name: "Merino Long Sleeve",
    price: 6400,
    category: "Tops",
    description:
      "Breathable fine-gauge merino wool that regulates temperature from commute to campfire. Naturally odor-resistant.",
    sizes: APPAREL_SIZES,
    spec: { material: "Merino wool", construction: "18.5 micron", origin: "Portugal" },
    swatch: ["#1e293b", "#0f172a"],
    featured: true,
  },
  {
    id: "oxford-shirt",
    name: "Washed Oxford Shirt",
    price: 7200,
    category: "Tops",
    description:
      "A garment-dyed oxford with a lived-in softness on day one. Button-down collar, single chest pocket.",
    sizes: APPAREL_SIZES,
    spec: { material: "Cotton oxford", construction: "Garment dyed", origin: "Portugal" },
    swatch: ["#bfdbfe", "#60a5fa"],
  },
  {
    id: "tapered-chino",
    name: "Tapered Stretch Chino",
    price: 8800,
    category: "Bottoms",
    description:
      "A modern tapered chino with just enough stretch to move in. Clean finish that dresses up or down.",
    sizes: ["28", "30", "32", "34", "36"],
    spec: { material: "Cotton twill", construction: "9 oz · 2% stretch", origin: "Vietnam" },
    swatch: ["#d6d3d1", "#a8a29e"],
    featured: true,
  },
  {
    id: "selvedge-denim",
    name: "Selvedge Denim",
    price: 14800,
    category: "Bottoms",
    description:
      "Raw 13.5oz selvedge denim that fades to your life. Straight leg, button fly, made to last for years.",
    sizes: ["28", "30", "32", "34", "36"],
    spec: { material: "Selvedge denim", construction: "13.5 oz raw", origin: "Japan" },
    swatch: ["#3b82f6", "#1e3a8a"],
  },
  {
    id: "fleece-sweatpant",
    name: "Heavyweight Sweatpant",
    price: 6800,
    category: "Bottoms",
    description:
      "Brushed-back fleece with a relaxed taper and zip pockets. The one you reach for on the cold mornings.",
    sizes: APPAREL_SIZES,
    spec: { material: "Cotton fleece", construction: "14 oz brushed", origin: "Portugal" },
    swatch: ["#71717a", "#3f3f46"],
  },
  {
    id: "field-jacket",
    name: "Waxed Field Jacket",
    price: 22800,
    category: "Outerwear",
    description:
      "A weather-ready waxed-cotton shell with four utility pockets and a corduroy collar. Built for shoulder seasons.",
    sizes: APPAREL_SIZES,
    spec: { material: "Waxed cotton", construction: "8 oz sailcloth", origin: "England" },
    swatch: ["#4d7c0f", "#365314"],
    featured: true,
  },
  {
    id: "puffer-vest",
    name: "Recycled Puffer Vest",
    price: 12800,
    category: "Outerwear",
    description:
      "Packable warmth from recycled down-alternative fill. Layers cleanly under a shell or over a hoodie.",
    sizes: APPAREL_SIZES,
    spec: { material: "Recycled ripstop", construction: "20D shell", origin: "Vietnam" },
    swatch: ["#f97316", "#c2410c"],
  },
  {
    id: "ribbed-beanie",
    name: "Ribbed Wool Beanie",
    price: 3200,
    category: "Accessories",
    description:
      "A snug ribbed knit in soft lambswool with a folded cuff. A quiet staple for the cold months.",
    sizes: ["One Size"],
    spec: { material: "Lambswool", construction: "Ribbed knit", origin: "Scotland" },
    swatch: ["#7f1d1d", "#450a0a"],
  },
  {
    id: "leather-belt",
    name: "Full-Grain Leather Belt",
    price: 5800,
    category: "Accessories",
    description:
      "Vegetable-tanned full-grain leather with a solid brushed-brass buckle. Ages into a rich patina.",
    sizes: ["S", "M", "L"],
    spec: { material: "Full-grain leather", construction: "Veg-tanned", origin: "USA" },
    swatch: ["#92400e", "#451a03"],
  },
  {
    id: "canvas-tote",
    name: "Heavy Canvas Tote",
    price: 4200,
    category: "Accessories",
    description:
      "A structured 18oz canvas tote with reinforced handles and an interior pocket. Carries far more than it looks.",
    sizes: ["One Size"],
    spec: { material: "Cotton canvas", construction: "18 oz", origin: "USA" },
    swatch: ["#fde68a", "#d97706"],
    featured: true,
  },
  {
    id: "crew-socks",
    name: "Cushioned Crew Socks (3-Pack)",
    price: 2400,
    category: "Accessories",
    description:
      "Combed-cotton crew socks with arch support and a cushioned footbed. Sold as a three-pack of neutrals.",
    sizes: ["One Size"],
    spec: { material: "Combed cotton", construction: "Cushioned · 3-pack", origin: "USA" },
    swatch: ["#e5e7eb", "#9ca3af"],
  },
];

export function getAllProducts(): Product[] {
  return products;
}

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured);
}

export function getProductsByCategory(category: Category): Product[] {
  return products.filter((p) => p.category === category);
}

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Format a price given in cents as a USD string, e.g. 2800 -> "$28.00". */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}
