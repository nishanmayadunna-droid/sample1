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
const STRING_LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;

describe("accent colour", () => {
  it("no element puts text-white on the accent colour (use text-onaccent, which follows the theme)", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "app"), /\.tsx$/)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(STRING_LITERAL)) {
        const text = match[1] ?? match[2] ?? match[3] ?? "";
        if (/(^|[\s:])bg-blaze(?=$|[\s/])/.test(text) && /(^|[\s:])text-white(?=$|[\s/])/.test(text)) {
          offenders.push(file.replace(root, "").replaceAll("\\", "/"));
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
