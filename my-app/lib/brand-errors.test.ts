import { describe, expect, it } from "vitest";
import { brandErrorMessage } from "./brand-errors";

describe("brandErrorMessage", () => {
  it("explains a dark-mode accent failure and where to fix it", () => {
    const text = brandErrorMessage("dark_accent_bg");
    expect(text).toContain("dark mode");
    expect(text).toContain("Advanced");
  });
  it("explains a light-mode accent failure and where to fix it", () => {
    const text = brandErrorMessage("light_accent_surface");
    expect(text).toContain("light mode");
    expect(text).toContain("Advanced");
  });
  it("explains the other contrast rules, form fields and unknown codes without throwing", () => {
    expect(brandErrorMessage("light_text_bg")).toContain("light mode");
    expect(brandErrorMessage("ov_dark_bg")).toContain("#");
    expect(brandErrorMessage("name")).toMatch(/name/i);
    expect(brandErrorMessage("totally_unknown")).not.toBe("");
  });
});
