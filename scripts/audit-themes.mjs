// Contrast + palette-system audit for the generated palettes. Run: bun run audit
// - token roles under WCAG 5:1 against the editor background, UI text under 4.5:1
// - "apart": roles that sit next to each other and must read as different
//   syntax areas (`function` keyword vs the function name, `return` vs `if`,
//   a string vs the call it is passed to, ...), flagged under the OKLab distance
// - "together": roles of one family (function / method / library function /
//   parameter) that must read as related, flagged when they drift apart
// The original overload hues are audited first as the reference.
import { palettes, buildTheme, syntax } from "./build-themes.mjs";
const hex2rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255);
const alpha = (h) => (h.length === 9 ? parseInt(h.slice(7, 9), 16) / 255 : 1);
const over = (fg, bg) => {
  const a = alpha(fg),
    f = hex2rgb(fg),
    b = hex2rgb(bg);
  return f.map((v, i) => v * a + b[i] * (1 - a));
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (rgb) => {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (fg, bg) => {
  const l1 = lum(over(fg, bg)),
    l2 = lum(hex2rgb(bg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
function oklab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const dE = (a, b, bg) => {
  const x = oklab(over(a, bg)),
    y = oklab(over(b, bg));
  return Math.hypot(...x.map((v, i) => v - y[i]));
};

// [role, role, minimum distance]
const apart = [
  // keywords against each other and against the names they introduce
  ["keyword", "function", 0.15],
  ["keyword", "control", 0.1],
  ["keyword", "conditional", 0.15],
  ["control", "conditional", 0.15],
  ["control", "function", 0.15],
  ["conditional", "function", 0.12],
  ["modifier", "function", 0.12],
  ["keywordImport", "keyword", 0.12],
  ["keyword", "class", 0.12],
  ["keyword", "type", 0.12],
  ["async", "function", 0.15],
  ["keyword", "variable", 0.15],
  // `return null`, `throw new Error`
  ["control", "falsy", 0.04],
  ["modifier", "falsy", 0.06],
  ["conditional", "class", 0.12],
  // identifiers that share a line
  ["function", "string", 0.1],
  ["function", "type", 0.1],
  ["function", "class", 0.1],
  ["function", "variable", 0.12],
  ["function", "property", 0.1],
  ["function", "objectKey", 0.1],
  ["function", "number", 0.08],
  ["method", "property", 0.1],
  ["type", "class", 0.08],
  ["type", "string", 0.08],
  ["class", "string", 0.08],
  ["objectKey", "string", 0.08],
  ["objectKey", "property", 0.08],
  ["number", "string", 0.08],
  ["parameter", "variableLocal", 0.08],
  ["property", "variable", 0.04],
  ["templateExpr", "string", 0.12],
];
// [role, role, maximum distance]
const together = [
  ["function", "method", 0.04],
  ["function", "supportFunction", 0.13],
  ["function", "parameter", 0.16],
  ["function", "paramTypeAnnot", 0.13],
  ["type", "typeSupport", 0.08],
  ["type", "typeParam", 0.09],
  ["control", "modifier", 0.1],
  ["control", "async", 0.1],
  ["conditional", "keywordImport", 0.12],
  ["objectKey", "attribute", 0.05],
];

const reference = {
  name: "overload (reference hues)",
  slug: "reference",
  t: syntax(
    {
      storage: 52,
      flow: 7,
      branch: 230,
      call: 151,
      type: 206,
      class: 103,
      ns: 123,
      member: 290,
      key: 79,
      string: 140,
      number: 169,
      constant: 306,
      warm: 39,
      object: 108,
    },
    { comment: "#ADADAD91", dim: "#888888", fg: "#bfbdb6", fg1: "#e6e1cf" },
  ),
};
for (const p of [reference, ...palettes]) {
  const ref = p === reference;
  const th = ref ? null : buildTheme(p, false);
  const bg = ref ? "#0e1016" : th.colors["editor.background"];
  const low = [];
  for (const [role, hex] of Object.entries(p.t)) {
    if (typeof hex !== "string") continue;
    const c = contrast(hex, bg);
    const min =
      role === "comment" || role === "completed" || role === "quote" || role === "strike"
        ? 4.0
        : 5.0;
    if (c < min) low.push(`${role} ${hex} ${c.toFixed(1)}`);
  }
  const ui = {};
  if (!ref)
    for (const [k, bgk] of [
      ["foreground", "editor.background"],
      ["editorLineNumber.foreground", "editor.background"],
      ["tab.inactiveForeground", "editor.background"],
      ["statusBar.foreground", "statusBar.background"],
      ["sideBar.foreground", "sideBar.background"],
      ["sideBarSectionHeader.foreground", "sideBar.background"],
      ["descriptionForeground", "editor.background"],
      ["editorInlayHint.foreground", "editor.background"],
      ["editorGhostText.foreground", "editor.background"],
      ["input.placeholderForeground", "input.background"],
      ["breadcrumb.foreground", "editor.background"],
      ["editorCodeLens.foreground", "editor.background"],
      ["activityBarTop.inactiveForeground", "sideBar.background"],
    ]) {
      ui[k] = contrast(th.colors[k], th.colors[bgk]).toFixed(1);
    }
  const close = apart
    .map(([x, y, min]) => [x, y, min, dE(p.t[x], p.t[y], bg)])
    .filter(([, , min, d]) => d < min);
  const far = together
    .map(([x, y, max]) => [x, y, max, dE(p.t[x], p.t[y], bg)])
    .filter(([, , max, d]) => d > max);
  console.log(`\n== ${p.name}`);
  console.log("low contrast tokens:", low.length ? low.join(" | ") : "none");
  if (!ref)
    console.log(
      "ui:",
      Object.entries(ui)
        .filter(([, v]) => v < 4.5)
        .map(([k, v]) => `${k} ${v}`)
        .join(" | ") || "all >= 4.5",
    );
  console.log(
    "should differ:",
    close.map(([x, y, min, d]) => `${x}~${y} ${d.toFixed(3)}<${min}`).join(" | ") || "ok",
  );
  console.log(
    "should relate:",
    far.map(([x, y, max, d]) => `${x}~${y} ${d.toFixed(3)}>${max}`).join(" | ") || "ok",
  );
}
