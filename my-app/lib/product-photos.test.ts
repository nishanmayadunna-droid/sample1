import { describe, expect, it } from "vitest";
import {
  galleryUrls,
  MAX_PHOTOS,
  moveItem,
  parsePhotosField,
  publicPhotoUrl,
  sortedPhotoPaths,
  validatePhotoList,
} from "./product-photos";

const base = "https://x.supabase.co";
const p = (n: number) => `trail-cap-${1700000000000 + n}.jpg`;

describe("validatePhotoList", () => {
  it("accepts none and up to the maximum", () => {
    expect(validatePhotoList("trail-cap", [])).toBe("ok");
    expect(validatePhotoList("trail-cap", [0, 1, 2, 3, 4].map(p))).toBe("ok");
    expect(MAX_PHOTOS).toBe(5);
  });
  it("rejects a sixth photo", () => {
    expect(validatePhotoList("trail-cap", [0, 1, 2, 3, 4, 5].map(p))).toBe("too-many");
  });
  it("rejects the same path twice", () => {
    expect(validatePhotoList("trail-cap", [p(0), p(0)])).toBe("duplicate");
  });
  it("rejects another product's or a traversing path", () => {
    expect(validatePhotoList("trail-cap", ["other-1700000000000.jpg"])).toBe("invalid-path");
    expect(validatePhotoList("trail-cap", ["../x.jpg"])).toBe("invalid-path");
  });
});

describe("moveItem", () => {
  it("moves an item without mutating the input", () => {
    const input = [1, 2, 3];
    expect(moveItem(input, 0, 2)).toEqual([2, 3, 1]);
    expect(input).toEqual([1, 2, 3]);
  });
  it("returns an unchanged copy for out-of-range indexes", () => {
    const input = [1, 2];
    const out = moveItem(input, 0, 5);
    expect(out).toEqual([1, 2]);
    expect(out).not.toBe(input);
  });
});

describe("sortedPhotoPaths", () => {
  it("orders by sort_order and tolerates null", () => {
    expect(
      sortedPhotoPaths([
        { path: "b.jpg", sort_order: 1 },
        { path: "a.jpg", sort_order: 0 },
      ]),
    ).toEqual(["a.jpg", "b.jpg"]);
    expect(sortedPhotoPaths(null)).toEqual([]);
    expect(sortedPhotoPaths(undefined)).toEqual([]);
  });
});

describe("galleryUrls / publicPhotoUrl", () => {
  it("builds encoded public URLs", () => {
    expect(publicPhotoUrl(base, "a b.jpg")).toBe(
      `${base}/storage/v1/object/public/product-images/a%20b.jpg`,
    );
  });
  it("prefers photo rows, then image_url, then nothing", () => {
    expect(galleryUrls(base, ["a.jpg"], "https://old/x.jpg")).toEqual([
      `${base}/storage/v1/object/public/product-images/a.jpg`,
    ]);
    expect(galleryUrls(base, [], "https://old/x.jpg")).toEqual(["https://old/x.jpg"]);
    expect(galleryUrls(base, [], null)).toEqual([]);
  });
});

describe("parsePhotosField", () => {
  it("parses a JSON array of strings", () => {
    expect(parsePhotosField('["a.jpg"]')).toEqual(["a.jpg"]);
    expect(parsePhotosField(undefined)).toEqual([]);
    expect(parsePhotosField("")).toEqual([]);
  });
  it("rejects anything else", () => {
    expect(parsePhotosField("nope")).toBeNull();
    expect(parsePhotosField("[1]")).toBeNull();
    expect(parsePhotosField('{"a":1}')).toBeNull();
  });
});
