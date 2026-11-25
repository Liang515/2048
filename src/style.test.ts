import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 長輩模式的方塊文字對比必須 ≥ 4.5（WCAG AA 一般文字標準）
const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const TILES = ["2", "4", "8", "16", "32", "64", "128", "256", "512", "1024", "2048", "higher"];

function vars(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`找不到 ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  淺色長輩模式: { ...vars(":root"), ...vars("body.senior-mode:not(.dark-mode)") },
  深色長輩模式: { ...vars(":root"), ...vars("body.dark-mode"), ...vars("body.dark-mode.senior-mode") },
};

describe("長輩模式方塊對比", () => {
  for (const [name, palette] of Object.entries(themes)) {
    it.each(TILES)(`${name} %s`, (tile) => {
      const bg = palette[`--tile-${tile}-bg`];
      const fg = palette[`--tile-${tile}-color`];
      expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
