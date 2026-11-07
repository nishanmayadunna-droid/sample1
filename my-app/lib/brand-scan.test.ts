import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Source scans that keep the shop's branding honest: the colours and the name are settings,
// so code must not assume them.

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (ext.test(name)) out.push(full);
  }
  return out;
}

const root = process.cwd();

describe("accent colour", () => {
  // White text is only right on a fixed dark surface (a photo overlay, the black chat header).
  // On the shop's accent colour the text colour follows the theme (text-onaccent), so any other
  // text-white is a bug waiting for a light accent. Counted per file so a new one is noticed.
  const ALLOWED_WHITE: Record<string, number> = {
    "/app/components/ProductImage.tsx": 2,
    "/app/components/ChatWindow.tsx": 1,
  };

  it("text-white appears only on fixed dark surfaces (use text-onaccent on the accent colour)", () => {
    const found: Record<string, number> = {};
    for (const file of walk(join(root, "app"), /\.tsx$/)) {
      const count = (readFileSync(file, "utf8").match(/(^|[^\w-])text-white(?![\w-])/g) ?? []).length;
      if (count > 0) found[file.replace(root, "").replaceAll("\\", "/")] = count;
    }
    expect(found).toEqual(ALLOWED_WHITE);
  });
});

describe("source hygiene", () => {
  it("has no raw control characters (git would treat the file as binary); write them as escapes", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "lib"]) {
      for (const file of walk(join(root, dir), /\.(ts|tsx)$/)) {
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(readFileSync(file, "utf8"))) {
          offenders.push(file.replace(root, "").replaceAll("\\", "/"));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("shop name", () => {
  // These files may name the default shop: the brand defaults and presets, the seeded chat copy.
  const ALLOWED = new Set(["/lib/brand.ts", "/lib/brand-presets.ts", "/lib/chat-defaults.ts", "/app/layout.tsx"]);

  it("is never written into pages, messages or templates (it comes from the brand settings)", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "lib"]) {
      for (const file of walk(join(root, dir), /\.(ts|tsx)$/)) {
        const rel = file.replace(root, "").replaceAll("\\", "/");
        if (/\.test\.tsx?$/.test(rel) || ALLOWED.has(rel)) continue;
        if (/Northbound|NORTH·?BOUND/.test(readFileSync(file, "utf8"))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
