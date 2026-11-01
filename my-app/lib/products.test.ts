import { describe, expect, it } from "vitest";
import { formatPrice, formatPriceWhole } from "./products";

describe("formatPrice (Sri Lankan rupees, from cents)", () => {
  it.each([
    [85000, "Rs 850.00"],
    [60000, "Rs 600.00"],
    [2850, "Rs 28.50"],
    [0, "Rs 0.00"],
    [1234500, "Rs 12,345.00"],
    [99999999, "Rs 999,999.99"],
  ])("%i → %s", (cents, text) => expect(formatPrice(cents)).toBe(text));
});

describe("formatPriceWhole (banners)", () => {
  it.each([
    [500000, "Rs 5,000"],
    [35000, "Rs 350"],
    [2850, "Rs 28.50"], // keeps cents when there are any
  ])("%i → %s", (cents, text) => expect(formatPriceWhole(cents)).toBe(text));
});
