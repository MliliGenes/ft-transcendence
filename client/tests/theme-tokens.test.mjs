import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const design = JSON.parse(await readFile(new URL("../NOOK_DESIGN_SYSTEM.json", import.meta.url), "utf8"));
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((first, second) => second - first);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const [mode, theme] of Object.entries(design.themes)) {
  test(mode + " CSS and documented theme tokens agree", () => {
    const selector = mode === "light" ? ":root" : ".dark";
    const block = css.slice(css.indexOf(selector + " {")).split("}")[0];
    const variables = Object.fromEntries([...block.matchAll(/(--[\w-]+): ([^;]+);/g)].map(match => [match[1], match[2]]));
    assert.deepEqual(variables, theme.cssVariables);
    assert.equal(theme.colors.accent, "#F16B3A");
    assert.equal(design.shadcn[mode].primary, "#F16B3A");
  });

  test(mode + " text, actions, inputs and focus meet contrast targets", () => {
    const colors = theme.colors;
    const textRoles = ["text", "textSecondary", "textMuted", "accentText", "success", "warning", "danger"];
    const surfaces = ["background", "surface", "surfaceRaised", "surfaceHover"];
    for (const foreground of textRoles) {
      for (const background of surfaces) {
        assert.ok(contrast(colors[foreground], colors[background]) >= 4.5, mode + ": " + foreground + " on " + background);
      }
    }
    for (const background of ["accent", "accentHover", "accentPressed"]) {
      assert.ok(contrast(colors.onAccent, colors[background]) >= 4.5);
    }
    for (const foreground of ["focus", "controlBorder"]) {
      for (const background of surfaces) {
        assert.ok(contrast(colors[foreground], colors[background]) >= 3, mode + ": " + foreground + " on " + background);
      }
    }
    console.log(mode + " muted text contrast: " + contrast(colors.textMuted, colors.surfaceHover).toFixed(2) + ":1");
  });
}
