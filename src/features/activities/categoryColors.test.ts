// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import tailwindConfig from "../../../tailwind.config";
import { CATEGORY_STYLE } from "./categoryColors";
import { CATEGORY_KEYS } from "./constants";

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
// Only the first :root block: the palette is light-only.
const rootBlock = css.slice(css.indexOf(":root"), css.indexOf(".dark"));

type Rgb = [number, number, number];

function triplet(name: string): { h: number; s: number; l: number; comment: string } {
  const m = new RegExp(
    `--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%;\\s*/\\*\\s*(#[0-9A-Fa-f]{6})`,
  ).exec(rootBlock);
  if (!m) throw new Error(`missing HSL triplet --${name} in :root`);
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]), comment: m[4]!.toUpperCase() };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbOf(name: string): Rgb {
  const { h, s, l } = triplet(name);
  return hslToRgb(h, s, l);
}

function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

const card = rgbOf("card");

describe("category palette in globals.css", () => {
  it.each(CATEGORY_KEYS)("%s: meets WCAG contrast thresholds", (key) => {
    const k = key.toLowerCase();
    const bg = rgbOf(`cat-${k}-bg`);
    const border = rgbOf(`cat-${k}-border`);
    const fg = rgbOf(`cat-${k}-fg`);
    // Light palette only: the .dark theme is not covered by this bench.
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    // selected state = bg colour as text on the fg colour as background.
    expect(contrast(rgbOf(`cat-${k}-bg`), fg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fg, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(border, card)).toBeGreaterThanOrEqual(3);
    expect(contrast(border, bg)).toBeGreaterThanOrEqual(3);
  });

  it.each(CATEGORY_KEYS)("%s: HSL triplets round-trip to the hex in their comment", (key) => {
    const k = key.toLowerCase();
    for (const part of ["bg", "border", "fg"]) {
      const name = `cat-${k}-${part}`;
      const { comment } = triplet(name);
      const got = toHex(rgbOf(name));
      // One-decimal rounding of the triplet may shift a channel by at most 1/255.
      const diff = [1, 3, 5].map((i) =>
        Math.abs(parseInt(got.slice(i, i + 2), 16) - parseInt(comment.slice(i, i + 2), 16)),
      );
      expect(Math.max(...diff), `${name}: ${got} vs ${comment}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("CATEGORY_STYLE", () => {
  it("has exactly the CATEGORY_KEYS", () => {
    expect(Object.keys(CATEGORY_STYLE).sort()).toEqual([...CATEGORY_KEYS].sort());
  });

  it("only uses category colours declared in tailwind.config.ts", () => {
    const colors = tailwindConfig.theme?.extend?.colors as Record<string, unknown>;
    const category = colors.category as Record<string, Record<string, string>>;
    const utility = /^(?:bg|text|border|border-l)-category-([a-z]+)-(bg|border|fg)$/;
    for (const key of CATEGORY_KEYS) {
      for (const [slot, classes] of Object.entries(CATEGORY_STYLE[key])) {
        for (const raw of classes.split(/\s+/)) {
          const cls = raw.replace(/^(?:[a-z-]+:)+/, "");
          if (!cls.includes("category")) {
            expect(cls, `${key}.${slot}`).toBe("border-l-4");
            continue;
          }
          const m = utility.exec(cls);
          expect(m, `${key}.${slot}: ${raw}`).not.toBeNull();
          expect(m![1], `${key}.${slot}: ${raw}`).toBe(key.toLowerCase());
          expect(category[m![1]!]?.[m![2]!], `${key}.${slot}: ${raw}`).toMatch(
            new RegExp(`^hsl\\(var\\(--cat-${m![1]}-${m![2]}\\)\\)$`),
          );
        }
      }
    }
  });

  it("never falls back on hover:bg-accent", () => {
    for (const key of CATEGORY_KEYS) {
      expect(CATEGORY_STYLE[key].hover).not.toContain("bg-accent");
    }
  });
});
