// Generates the ember / graphite / violet theme variants (regular + borderless).
// Run: bun run build
// The original overload / alt / vibrancy themes are hand-written and not touched here.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "themes");

// hex + alpha (0..255)
const a = (hex, alpha) => hex + alpha.toString(16).padStart(2, "0");
const NONE = "#00000000";

// ---------------------------------------------------------------------------
// Color helpers. Every color below is specified in OKLCH (lightness 0..1,
// chroma, hue in degrees) so that tints within a family stay perceptually
// consistent. Keep chroma <= ~0.17 for bright colors to stay in sRGB gamut.
// ---------------------------------------------------------------------------

function oklch(L, C, H) {
  for (let c = C; c >= 0; c -= 0.004) {
    const rgb = oklchToLinear(L, c, H);
    if (rgb.every((x) => x >= -0.0005 && x <= 1.0005)) return toHex(rgb);
  }
  return toHex(oklchToLinear(L, 0, H));
}
const toHex = (rgb) => {
  const gam = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return (
    "#" +
    rgb
      .map((x) =>
        Math.round(gam(x) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};
// hex -> [L, C, H]
function oklchOf(hex) {
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(hex.slice(1 + i, 3 + i), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s_;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s_;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s_;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
// a related shade: same family, nudged in lightness / chroma / hue
function shade(hex, dL, dC, dH) {
  const [L, C, H] = oklchOf(hex.slice(0, 7));
  return oklch(Math.max(0, Math.min(0.98, L + dL)), Math.max(0, C + dC), (H + dH + 360) % 360);
}
// declarations: the same color as uses, a step brighter, so a name looks the
// same where it is defined and where it is called
const lift = (hex) => shade(hex, 0.03, 0, 0);

// ---------------------------------------------------------------------------
// The overload syntax system.
//
// Every token role is derived from a handful of family hues, using the
// lightness / chroma steps measured from the hand-written overload theme, so
// each palette keeps the same structure and only the hues change:
//
//   storage   `const` `function` `class` `=>` at declaration level   (orange #FF8F40)
//   flow      return / throw / await / async / try / catch            (pink   #FD628B)
//             ... lighter inside functions, lighter still when nested
//   branch    if / else / switch / for / while / ternary / && / === /
//             new / typeof / in / of / true / enums / primitive types /
//             const / let / = inside blocks                           (blue   #03BBF5)
//   import    import / export / from / type, a pale shade of branch   (#87CFFF)
//   call      function and method names, declared and called, library
//             functions, and the parameters (pale, italic)            (green  #44fc88)
//   type      interfaces, type aliases, generics, library types,
//             commas / type punctuation                               (cyan   #00eaff)
//   class     classes; library classes a warmer shade                 (yellow #ffee59)
//   ns        namespaces / modules                                    (lime   #ceff2d)
//   member    properties, a pale cool tint                            (lilac  #D0CAFD)
//   key       object keys, enum members, spread; nested keys deeper   (amber  #ffc45f)
//   string, number, constant                                          (#5fef3b #4DFFCC #D2A6FF)
//   warm / object   near-neutral tints for plain variables, so the
//             bulk of a function body stays quiet                     (#fad8cd #FFFFC6)
//
// Three tiers of lightness keep it readable without clutter: keywords sit
// lowest (L ~0.70-0.76, deepest chroma), identifiers in the middle
// (L ~0.85-0.94, vivid), plain variables are bright but nearly neutral.
// Locals declared inside a function body drop to a muted grey-rose so the
// signature and calls stand out.
//
// A slot is a hue, or [hue, dL, chromaScale] to adjust that whole family.
// `vivid` scales every chroma; `oklch()` lowers chroma only when a color would
// fall outside sRGB. Blues and violets hold little chroma at the lightness the
// greens / yellows of the original use, so each family is first lowered until
// its main color keeps most of its chroma (otherwise a violet function name
// would come out nearly white and read as a plain variable).
// ---------------------------------------------------------------------------
const ANCHOR = {
  storage: [0.76, 0.165],
  flow: [0.705, 0.19],
  branch: [0.74, 0.15],
  import: [0.825, 0.1],
  call: [0.875, 0.215],
  type: [0.856, 0.147],
  class: [0.937, 0.165],
  ns: [0.933, 0.2],
  key: [0.855, 0.135],
  string: [0.841, 0.24],
  number: [0.898, 0.16],
  constant: [0.797, 0.131],
  templ: [0.74, 0.2],
};
function maxChroma(L, H) {
  let lo = 0,
    hi = 0.4;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (oklchToLinear(L, mid, H).every((x) => x >= -0.0005 && x <= 1.0005)) lo = mid;
    else hi = mid;
  }
  return lo;
}
function gamutFit(name, H) {
  if (!ANCHOR[name]) return 0;
  const [L, C] = ANCHOR[name];
  const want = Math.min(C, 0.17) * 0.8;
  let dL = 0;
  while (dL > -0.12 && maxChroma(L + dL, H) < want) dL -= 0.01;
  return dL;
}
function syntax(h, o) {
  const slot = (s) => (Array.isArray(s) ? s : [s, 0, 1]);
  const vivid = o.vivid ?? 1;
  const fam = (name) => {
    const [H, dL0, cs] = slot(h[name]);
    const dL = dL0 + gamutFit(name, H);
    return (L, C, dH = 0) => oklch(Math.min(0.985, L + dL), C * cs * vivid, (H + dH + 360) % 360);
  };
  const [S, F, B, I, C, T, K, N, P, Y, Str, Num, Con, W, O] = [
    "storage",
    "flow",
    "branch",
    "import",
    "call",
    "type",
    "class",
    "ns",
    "member",
    "key",
    "string",
    "number",
    "constant",
    "warm",
    "object",
  ].map((k) => fam(h[k] === undefined ? (k === "import" ? "branch" : k) : k));
  const red = oklch(0.7, 0.19, h.red ?? 24);
  const templ = h.templ === undefined ? F : fam("templ");
  const keyword = S(0.76, 0.165);
  const operator = S(0.79, 0.12, -7);
  const control = F(0.705, 0.19);
  const conditional = B(0.74, 0.15);
  const fn = C(0.875, 0.215);
  const objectKey = Y(0.855, 0.135);
  const tint = W(0.908, 0.041);
  const obj = O(0.975, 0.075);
  const t = {
    comment: o.comment,
    completed: o.dim,
    punct: a(o.fg, 0xc0),
    jsxText: o.fg1,
    // storage
    keyword,
    operator,
    accessor: operator,
    jsxAttrAssign: S(0.8, 0.17, 3),
    jsdoc: S(0.84, 0.09, 4),
    // flow: exits and async, lighter the deeper they nest
    control,
    async: F(0.72, 0.19, -12),
    modifier: F(0.765, 0.15, -6),
    controlNested: F(0.85, 0.1, -20),
    templateExpr: templ(0.74, 0.2, h.templ === undefined ? -24 : 0),
    // branch
    conditional,
    storageBlock: conditional,
    new: conditional,
    typePrimitive: conditional,
    variableLanguage: B(0.74, 0.125, -4),
    accessorBlock: B(0.865, 0.045, 22),
    accessorObj: B(0.805, 0.07, 29),
    keywordImport: I(0.825, 0.1, 9),
    keywordFrom: I(0.825, 0.1, 9),
    // callables
    function: fn,
    method: C(0.875, 0.205, 5),
    supportFunction: C(0.83, 0.15, 25),
    variableFunction: C(0.9, 0.15, -12),
    parameter: C(0.935, 0.12, -8),
    callParam: C(0.93, 0.076, -25),
    paramTypeAnnot: C(0.895, 0.125, -3),
    supportVarProp: C(0.89, 0.13, 28),
    // types
    type: T(0.856, 0.147),
    typeSupport: T(0.864, 0.11, 9),
    typeParam: T(0.904, 0.107, -5),
    struct: T(0.868, 0.147, -3),
    langStorageType: T(0.864, 0.11, 9),
    punctType: T(0.904, 0.107, -5),
    tag: T(0.81, 0.12, 5),
    tagJsx: T(0.81, 0.12, 5),
    class: K(0.937, 0.165),
    inheritedClass: K(0.937, 0.165),
    supportClass: K(0.831, 0.112, -45),
    namespace: N(0.933, 0.2),
    // bindings: quiet, nearly neutral
    variable: tint,
    variableLocal: W(0.745, 0.027, -20),
    variableLocalConst: W(0.783, 0.008),
    variableObject: obj,
    constantVar: obj,
    embeddedObj: obj,
    // members
    property: P(0.861, 0.07),
    objectKey,
    objectKeyNested: Y(0.71, 0.156, -41),
    supportVariable: Y(0.75, 0.15, -40),
    jsxEmbeddedVar: Y(0.88, 0.11, 3),
    attribute: Y(0.843, 0.154, 1),
    decorator: Y(0.8, 0.09, -5),
    // literals
    string: Str(0.841, 0.24),
    stringPunct: Str(0.95, 0.15, -15),
    number: Num(0.898, 0.16),
    arithmetic: Num(0.91, 0.125, -2),
    regexp: Num(0.865, 0.088, 2),
    tagComponentJsx: Num(0.936, 0.094, 4),
    tagPunct: Num(0.81, 0.08),
    constant: Con(0.797, 0.131),
    falsy: red,
    invalid: red,
    tagComponent: B(0.8, 0.13, 5),
    // markup / misc
    macro: Y(0.75, 0.15, -40),
    heading: keyword,
    link: conditional,
    emphasis: objectKey,
    inserted: oklch(0.85, 0.16, 150),
    changed: conditional,
    deleted: red,
    quote: o.comment,
    strike: o.comment,
    cssProperty: conditional,
    cssTag: T(0.81, 0.12, 5),
    diffHeader: Con(0.797, 0.131),
    journal: K(0.937, 0.165),
    ...o.override,
  };
  t.sol = solidityFrom(t);
  return t;
}

function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const ca = C * Math.cos(h),
    cb = C * Math.sin(h);
  const l_ = L + 0.3963377774 * ca + 0.2158037573 * cb;
  const m_ = L - 0.1055613458 * ca - 0.0638541728 * cb;
  const s_ = L - 0.0894841775 * ca - 1.291485548 * cb;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// Palettes
//
// Each palette is UI chrome (`c`: backgrounds, text, accent, terminal) plus a
// hue map for `syntax()`. The hue maps follow a few rules so every palette
// reads like overload:
//  - `storage`, `flow` and `branch` sit >= 40 degrees apart, so `function`,
//    `return` and `if` never look alike.
//  - `call` sits far from `storage` (the `function` keyword vs its name) and
//    from `string`, and the callable sub-roles (methods, library functions,
//    parameters) stay inside the call hue.
//  - identifier-tier families (call, type, class, key, string, number) spread
//    around the wheel; `member` is pale, so it may sit nearer another hue.
// `npm run audit` checks contrast plus these separations.
// Each palette also defines `tint` / `tintStrong`, light members of the accent
// family used for UI text (tabs, status bar, list selection, breadcrumbs).
// ---------------------------------------------------------------------------

// Solidity roles, derived from the TS roles.
function solidityFrom(t) {
  return {
    keyword: t.keyword,
    bool: t.constant,
    modifierFn: t.parameter,
    accessor: t.accessor,
    currency: t.typeSupport,
    exceptions: t.falsy,
    control: t.control,
    operator: t.conditional,
    payable: t.async,
    flow: t.control,
    paramFn: t.parameter,
    paramOther: t.callParam,
    using: t.keywordImport,
    access: t.modifier,
    tx: t.supportVariable,
    contract: t.class,
    interface: t.type,
    library: t.namespace,
    semLibrary: t.namespace,
    event: t.typePrimitive,
    semInterface: t.type,
    semContract: t.class,
    localVar: t.variableLocal,
    storageVar: t.constantVar,
    paramOut: t.callParam,
    paramIn: t.parameter,
    propStruct: t.property,
    propAssign: t.objectKey,
    prop: t.objectKey,
    propDefault: t.supportVarProp,
    paramOutStorage: t.objectKey,
  };
}

// EMBER. Warm charcoal chrome lit by an ember-orange accent. Closest to the
// original: orange storage keywords, red-pink flow, sky branches, lime
// functions, teal types, yellow classes, amber keys; strings move to rose so
// they no longer share the function green, numbers aqua.
const ember = (() => {
  const bg = (L) => oklch(L, 0.009, 55);
  const c = {
    bg0: bg(0.12),
    bg1: bg(0.16),
    bg2: bg(0.225),
    bg3: bg(0.255),
    bg4: bg(0.295),
    fg: oklch(0.87, 0.03, 75),
    fg1: oklch(0.93, 0.025, 80),
    fgMuted: oklch(0.7, 0.025, 70),
    fgDim: oklch(0.55, 0.02, 65),
    ash: oklch(0.64, 0.015, 60),
    rust: oklch(0.74, 0.2, 27),
    ember: oklch(0.8, 0.2, 50),
    gold: oklch(0.87, 0.18, 85),
    yellow: oklch(0.93, 0.2, 100),
    lime: oklch(0.88, 0.23, 138),
    olive: oklch(0.86, 0.18, 118),
    sage: oklch(0.83, 0.12, 155),
    aqua: oklch(0.86, 0.16, 168),
    teal: oklch(0.87, 0.15, 198),
    sky: oklch(0.76, 0.16, 228),
    lavender: oklch(0.86, 0.075, 298),
    mauve: oklch(0.82, 0.16, 340),
    rose: oklch(0.84, 0.06, 18),
    red: oklch(0.71, 0.18, 22),
    tint: oklch(0.87, 0.11, 60),
    tintStrong: oklch(0.9, 0.16, 78),
  };
  const t = syntax(
    {
      storage: 50,
      flow: 8,
      branch: 222,
      call: 132,
      type: 196,
      class: 96,
      ns: 115,
      member: 300,
      key: 74,
      string: 340,
      templ: 62,
      number: 176,
      constant: 285,
      warm: 50,
      object: 95,
    },
    { comment: a(c.ash, 0xd9), dim: c.fgDim, fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload ember",
    slug: "ember",
    ...c,
    grey: c.ash,
    t,
    accent: c.ember,
    accent2: c.gold,
    accentFg: c.bg0,
    cursor: c.gold,
    selection: a(oklch(0.42, 0.035, 50), 0x99),
    error: c.red,
    warning: c.gold,
    info: c.sky,
    success: c.lime,
    gitModified: c.sky,
    bracket: [c.gold, c.mauve, c.sky],
    terminal: {
      black: bg(0.3),
      red: c.red,
      green: c.lime,
      yellow: c.gold,
      blue: c.sky,
      magenta: c.mauve,
      cyan: c.teal,
      white: c.fg,
      brBlack: c.ash,
      brRed: oklch(0.78, 0.16, 22),
      brGreen: oklch(0.91, 0.14, 132),
      brYellow: c.yellow,
      brBlue: oklch(0.86, 0.09, 236),
      brMagenta: oklch(0.87, 0.1, 340),
      brCyan: oklch(0.9, 0.09, 196),
      brWhite: c.fg1,
    },
  };
})();

// GRAPHITE. Polished graphite and neon ink: cool slate-black, greys with a
// blue undertone. Coral storage, pink flow, blue branches, violet functions,
// ice types, lemon classes, amber keys, green strings, aqua numbers.
const graphite = (() => {
  const bg = (L) => oklch(L, 0.008, 255);
  const c = {
    bg0: bg(0.125),
    bg1: bg(0.14),
    bg2: bg(0.185),
    bg3: bg(0.22),
    bg4: bg(0.3),
    fg: oklch(0.87, 0.012, 250),
    fg1: oklch(0.94, 0.01, 250),
    fgMuted: oklch(0.67, 0.02, 250),
    fgDim: oklch(0.5, 0.02, 250),
    slate: oklch(0.61, 0.025, 250),
    coral: oklch(0.78, 0.2, 27),
    pink: oklch(0.76, 0.22, 350),
    periwinkle: oklch(0.8, 0.16, 280),
    violet: oklch(0.8, 0.19, 305),
    lilac: oklch(0.88, 0.08, 290),
    ice: oklch(0.88, 0.14, 215),
    sky: oklch(0.76, 0.16, 232),
    mint: oklch(0.88, 0.17, 165),
    amber: oklch(0.87, 0.17, 80),
    apricot: oklch(0.86, 0.15, 55),
    peach: oklch(0.91, 0.035, 340),
    cream: oklch(0.9, 0.05, 200),
    lavender: oklch(0.86, 0.085, 290),
    red: oklch(0.71, 0.19, 22),
    blue: oklch(0.68, 0.17, 262),
    tint: oklch(0.85, 0.1, 262),
    tintStrong: oklch(0.87, 0.15, 248),
  };
  const t = syntax(
    {
      storage: 35,
      flow: 355,
      branch: 225,
      call: 288,
      type: 205,
      class: 98,
      ns: 150,
      member: 330,
      key: 75,
      string: 140,
      number: 178,
      constant: 315,
      warm: 250,
      object: 210,
    },
    { comment: a(c.slate, 0xf2), dim: c.fgDim, fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload graphite",
    slug: "graphite",
    ...c,
    grey: c.slate,
    t,
    accent: c.blue,
    accent2: c.pink,
    accentFg: "#ffffff",
    cursor: c.fg1,
    selection: a(oklch(0.4, 0.06, 262), 0x8c),
    error: c.red,
    warning: oklch(0.8, 0.14, 80),
    info: c.sky,
    success: oklch(0.78, 0.14, 160),
    gitModified: oklch(0.8, 0.14, 80),
    bracket: [c.sky, c.violet, c.amber],
    terminal: {
      black: bg(0.32),
      red: c.coral,
      green: oklch(0.78, 0.14, 160),
      yellow: oklch(0.8, 0.14, 80),
      blue: c.sky,
      magenta: c.violet,
      cyan: oklch(0.8, 0.1, 200),
      white: oklch(0.81, 0.012, 250),
      brBlack: c.slate,
      brRed: oklch(0.83, 0.13, 25),
      brGreen: c.mint,
      brYellow: c.amber,
      brBlue: c.ice,
      brMagenta: oklch(0.89, 0.1, 302),
      brCyan: oklch(0.89, 0.09, 200),
      brWhite: c.fg1,
    },
  };
})();

// VIOLET. Night orchid: plum-black with a violet cast. Orchid storage,
// red-pink flow, periwinkle branches, aqua-mint functions, sky types, honey
// classes, apricot strings, lavender numbers.
const violet = (() => {
  const bg = (L) => oklch(L, 0.022, 300);
  const c = {
    bg0: bg(0.14),
    bg1: bg(0.185),
    bg2: bg(0.215),
    bg3: bg(0.245),
    bg4: bg(0.3),
    fg: oklch(0.91, 0.015, 300),
    fg1: oklch(0.96, 0.01, 300),
    fgMuted: oklch(0.69, 0.04, 295),
    fgDim: oklch(0.52, 0.04, 295),
    mute: oklch(0.63, 0.05, 292),
    orchid: oklch(0.8, 0.21, 346),
    magenta: oklch(0.76, 0.23, 330),
    iris: oklch(0.78, 0.18, 288),
    lilac: oklch(0.82, 0.11, 305),
    periwinkle: oklch(0.82, 0.18, 262),
    glacier: oklch(0.88, 0.14, 205),
    aqua: oklch(0.85, 0.15, 188),
    honey: oklch(0.89, 0.17, 82),
    apricot: oklch(0.87, 0.16, 55),
    butter: oklch(0.93, 0.17, 100),
    cream: oklch(0.92, 0.04, 300),
    blush: oklch(0.94, 0.04, 345),
    pinkLilac: oklch(0.87, 0.08, 330),
    coral: oklch(0.76, 0.16, 25),
    red: oklch(0.69, 0.19, 15),
    electric: oklch(0.78, 0.16, 225),
    tint: oklch(0.87, 0.1, 300),
    tintStrong: oklch(0.9, 0.14, 330),
  };
  const t = syntax(
    {
      storage: 325,
      flow: 3,
      branch: 258,
      call: 168,
      type: 212,
      class: 92,
      ns: 130,
      member: 300,
      key: 80,
      string: 48,
      templ: 335,
      number: 282,
      constant: 315,
      warm: 330,
      object: 95,
    },
    { comment: c.mute, dim: c.fgDim, fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload violet",
    slug: "violet",
    ...c,
    grey: c.mute,
    t,
    accent: c.iris,
    accent2: c.orchid,
    accentFg: c.bg0,
    cursor: c.orchid,
    selection: a(oklch(0.42, 0.06, 300), 0xa6),
    error: c.red,
    warning: c.honey,
    info: c.glacier,
    success: oklch(0.84, 0.13, 150),
    gitModified: c.glacier,
    bracket: [c.orchid, c.glacier, c.honey],
    terminal: {
      black: bg(0.3),
      red: c.coral,
      green: oklch(0.84, 0.13, 150),
      yellow: c.butter,
      blue: c.iris,
      magenta: c.orchid,
      cyan: c.aqua,
      white: c.fg,
      brBlack: c.mute,
      brRed: oklch(0.82, 0.13, 25),
      brGreen: oklch(0.9, 0.11, 150),
      brYellow: oklch(0.95, 0.08, 98),
      brBlue: oklch(0.86, 0.11, 288),
      brMagenta: oklch(0.86, 0.12, 346),
      brCyan: oklch(0.9, 0.08, 190),
      brWhite: "#ffffff",
    },
  };
})();

// PINK. A near-black with the faintest rose cast and pinks for structure:
// hot pink storage, magenta flow, blue branches. Functions ice cyan as the
// counterpoint, lilac types, cream classes, salmon keys, peach-gold strings,
// mint numbers.
const pink = (() => {
  const bg = (L) => oklch(L, 0.007, 345);
  const c = {
    bg0: bg(0.1),
    bg1: bg(0.12),
    bg2: bg(0.155),
    bg3: bg(0.225),
    bg4: bg(0.3),
    fg: oklch(0.93, 0.008, 345),
    fg1: oklch(0.955, 0.006, 345),
    white: oklch(0.975, 0.025, 85),
    fgMuted: oklch(0.73, 0.015, 345),
    fgDim: oklch(0.55, 0.015, 345),
    ashRose: oklch(0.67, 0.035, 340),
    hot: oklch(0.76, 0.24, 352),
    magenta: oklch(0.8, 0.19, 330),
    rose: oklch(0.84, 0.13, 15),
    raspberry: oklch(0.8, 0.2, 358),
    blush: oklch(0.9, 0.09, 350),
    petal: oklch(0.93, 0.04, 350),
    salmon: oklch(0.86, 0.14, 20),
    peach: oklch(0.9, 0.08, 70),
    lilac: oklch(0.89, 0.14, 310),
    mauve: oklch(0.83, 0.16, 320),
    orchid: oklch(0.82, 0.14, 325),
    red: oklch(0.7, 0.2, 18),
    electric: oklch(0.8, 0.15, 228),
    tint: oklch(0.91, 0.09, 350),
    tintStrong: oklch(0.92, 0.14, 355),
  };
  const t = syntax(
    {
      storage: 355,
      flow: 320,
      branch: 255,
      call: 200,
      type: 288,
      class: 92,
      ns: 150,
      member: 345,
      key: 25,
      string: 70,
      templ: 355,
      number: 165,
      constant: 305,
      warm: 350,
      object: 60,
    },
    { comment: c.ashRose, dim: c.fgDim, fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload pink",
    slug: "pink",
    ...c,
    grey: c.ashRose,
    t,
    accent: c.hot,
    accent2: c.white,
    accentFg: c.white,
    cursor: c.hot,
    selection: a(oklch(0.4, 0.08, 350), 0x99),
    error: c.red,
    warning: c.peach,
    info: c.lilac,
    success: oklch(0.84, 0.12, 160),
    gitModified: c.lilac,
    bracket: [c.rose, c.lilac, c.peach],
    terminal: {
      black: bg(0.3),
      red: c.red,
      green: oklch(0.8, 0.13, 160),
      yellow: c.peach,
      blue: c.lilac,
      magenta: c.hot,
      cyan: oklch(0.84, 0.09, 200),
      white: c.fg,
      brBlack: c.ashRose,
      brRed: oklch(0.8, 0.15, 20),
      brGreen: oklch(0.88, 0.11, 160),
      brYellow: oklch(0.94, 0.06, 60),
      brBlue: oklch(0.91, 0.06, 310),
      brMagenta: c.raspberry,
      brCyan: oklch(0.9, 0.07, 200),
      brWhite: c.white,
    },
  };
})();

// ABYSS. Deep sea: a teal-navy with real chroma in the background, pale
// cyan-grey text. Coral storage, red-pink flow, blue branches, neon turquoise
// functions, gold types (the warm exception), lemon classes, magenta keys,
// seafoam strings. Accent turquoise.
const abyss = (() => {
  const bg = (L) => oklch(L, 0.03, 225);
  const c = {
    bg0: bg(0.1),
    bg1: bg(0.125),
    bg2: bg(0.155),
    bg3: bg(0.2),
    bg4: bg(0.255),
    fg: oklch(0.88, 0.02, 200),
    fg1: oklch(0.94, 0.015, 200),
    fgMuted: oklch(0.69, 0.03, 215),
    fgDim: oklch(0.52, 0.03, 215),
    mute: oklch(0.62, 0.04, 215),
    turquoise: oklch(0.88, 0.16, 178),
    seafoam: oklch(0.86, 0.14, 150),
    coral: oklch(0.76, 0.19, 25),
    salmon: oklch(0.8, 0.17, 40),
    electric: oklch(0.76, 0.16, 232),
    gold: oklch(0.87, 0.17, 85),
    lemon: oklch(0.93, 0.18, 100),
    tangerine: oklch(0.85, 0.15, 60),
    magenta: oklch(0.8, 0.16, 340),
    violet: oklch(0.8, 0.14, 310),
    lavender: oklch(0.86, 0.09, 290),
    red: oklch(0.7, 0.19, 20),
  };
  const t = syntax(
    {
      storage: 40,
      flow: 4,
      branch: 245,
      call: 185,
      type: 85,
      class: 115,
      ns: 150,
      member: 290,
      key: 335,
      string: 145,
      templ: 40,
      number: 315,
      constant: 270,
      warm: 40,
      object: 100,
    },
    { comment: c.mute, dim: oklch(0.6, 0.03, 215), fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload abyss",
    slug: "abyss",
    ...c,
    grey: c.mute,
    t,
    accent: c.turquoise,
    accent2: c.gold,
    accentFg: c.bg0,
    cursor: oklch(0.92, 0.14, 178),
    selection: a(oklch(0.42, 0.06, 215), 0xa6),
    error: c.red,
    warning: c.gold,
    info: c.electric,
    success: c.seafoam,
    gitModified: c.electric,
    bracket: [c.gold, c.magenta, c.electric],
    tint: oklch(0.88, 0.09, 185),
    tintStrong: oklch(0.9, 0.14, 178),
    terminal: {
      black: bg(0.32),
      red: c.coral,
      green: c.seafoam,
      yellow: c.gold,
      blue: c.electric,
      magenta: c.magenta,
      cyan: c.turquoise,
      white: c.fg,
      brBlack: c.mute,
      brRed: oklch(0.82, 0.15, 25),
      brGreen: oklch(0.9, 0.12, 150),
      brYellow: c.lemon,
      brBlue: oklch(0.84, 0.12, 232),
      brMagenta: oklch(0.86, 0.12, 340),
      brCyan: oklch(0.92, 0.12, 178),
      brWhite: c.fg1,
    },
  };
})();

// SOLAR. Sunset neon on a dark neutral: warm off-white text. Pink storage,
// purple flow, blue branches, tangerine functions, cyan types, lemon classes,
// mint keys, rose strings, violet numbers. Accent tangerine.
const solar = (() => {
  const bg = (L) => oklch(L, 0.006, 40);
  const c = {
    bg0: bg(0.13),
    bg1: bg(0.155),
    bg2: bg(0.195),
    bg3: bg(0.235),
    bg4: bg(0.31),
    fg: oklch(0.89, 0.015, 60),
    fg1: oklch(0.95, 0.01, 60),
    fgMuted: oklch(0.68, 0.02, 55),
    fgDim: oklch(0.52, 0.02, 55),
    mute: oklch(0.62, 0.025, 50),
    tangerine: oklch(0.82, 0.19, 55),
    magenta: oklch(0.74, 0.24, 340),
    redPink: oklch(0.76, 0.21, 0),
    electric: oklch(0.76, 0.16, 232),
    cyan: oklch(0.88, 0.14, 200),
    lemon: oklch(0.93, 0.18, 100),
    gold: oklch(0.86, 0.14, 80),
    spring: oklch(0.86, 0.15, 150),
    rose: oklch(0.9, 0.11, 15),
    violet: oklch(0.8, 0.15, 295),
    periwinkle: oklch(0.82, 0.13, 275),
    lavender: oklch(0.87, 0.09, 280),
    red: oklch(0.7, 0.2, 20),
  };
  const t = syntax(
    {
      storage: 345,
      flow: 305,
      branch: 245,
      call: 55,
      type: 195,
      class: 100,
      ns: 130,
      member: 290,
      key: 155,
      string: 345,
      templ: 55,
      number: 280,
      constant: 310,
      warm: 45,
      object: 90,
    },
    { comment: c.mute, dim: oklch(0.6, 0.02, 55), fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload solar",
    slug: "solar",
    ...c,
    grey: c.mute,
    t,
    accent: c.tangerine,
    accent2: c.magenta,
    accentFg: c.bg0,
    cursor: oklch(0.9, 0.17, 60),
    selection: a(oklch(0.4, 0.04, 40), 0xa6),
    error: c.red,
    warning: c.gold,
    info: c.cyan,
    success: c.spring,
    gitModified: c.cyan,
    bracket: [c.tangerine, c.violet, c.cyan],
    tint: oklch(0.88, 0.1, 60),
    tintStrong: oklch(0.9, 0.15, 65),
    terminal: {
      black: bg(0.32),
      red: c.red,
      green: c.spring,
      yellow: c.gold,
      blue: c.electric,
      magenta: c.magenta,
      cyan: c.cyan,
      white: c.fg,
      brBlack: c.mute,
      brRed: oklch(0.8, 0.17, 20),
      brGreen: oklch(0.9, 0.13, 150),
      brYellow: c.lemon,
      brBlue: oklch(0.84, 0.12, 232),
      brMagenta: oklch(0.84, 0.16, 340),
      brCyan: oklch(0.92, 0.11, 200),
      brWhite: c.fg1,
    },
  };
})();

// BLUSH. The warm pink take: a rose-tinted charcoal, warm cream whites and
// dusty coral-rose on functions. Gold storage, magenta flow, blue branches,
// lilac types, aqua keys, green strings, sky numbers.
const blush = (() => {
  const bg = (L) => oklch(L, 0.014, 350);
  const c = {
    bg0: bg(0.1),
    bg1: bg(0.125),
    bg2: bg(0.155),
    bg3: bg(0.215),
    bg4: bg(0.255),
    fg: oklch(0.91, 0.012, 20),
    fg1: oklch(0.955, 0.008, 20),
    white: oklch(0.975, 0.03, 80),
    fgMuted: oklch(0.7, 0.02, 10),
    fgDim: oklch(0.54, 0.02, 10),
    mute: oklch(0.64, 0.035, 5),
    rose: oklch(0.78, 0.19, 10),
    salmon: oklch(0.86, 0.13, 30),
    blush: oklch(0.9, 0.08, 355),
    lilac: oklch(0.9, 0.1, 320),
    violet: oklch(0.84, 0.15, 295),
    mauve: oklch(0.83, 0.14, 325),
    electric: oklch(0.76, 0.16, 232),
    red: oklch(0.7, 0.2, 20),
  };
  const t = syntax(
    {
      storage: 80,
      flow: 318,
      branch: 245,
      call: 10,
      type: 290,
      class: 98,
      ns: 140,
      member: 320,
      key: 180,
      string: 140,
      number: 200,
      constant: 300,
      warm: 20,
      object: 70,
    },
    { comment: c.mute, dim: oklch(0.6, 0.02, 10), fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload blush",
    slug: "blush",
    ...c,
    grey: c.mute,
    t,
    accent: oklch(0.74, 0.2, 10),
    accent2: c.white,
    accentFg: c.white,
    cursor: c.rose,
    selection: a(oklch(0.4, 0.07, 10), 0x99),
    error: c.red,
    warning: oklch(0.86, 0.13, 80),
    info: oklch(0.84, 0.1, 250),
    success: oklch(0.84, 0.12, 160),
    gitModified: c.lilac,
    bracket: [c.rose, c.lilac, oklch(0.9, 0.08, 60)],
    tint: oklch(0.91, 0.08, 10),
    tintStrong: oklch(0.92, 0.13, 10),
    terminal: {
      black: bg(0.32),
      red: c.red,
      green: oklch(0.82, 0.13, 160),
      yellow: oklch(0.86, 0.13, 80),
      blue: oklch(0.8, 0.12, 255),
      magenta: c.rose,
      cyan: oklch(0.86, 0.09, 200),
      white: c.fg,
      brBlack: c.mute,
      brRed: oklch(0.8, 0.16, 20),
      brGreen: oklch(0.88, 0.11, 160),
      brYellow: oklch(0.93, 0.08, 85),
      brBlue: oklch(0.88, 0.08, 255),
      brMagenta: oklch(0.86, 0.13, 10),
      brCyan: oklch(0.9, 0.07, 200),
      brWhite: c.white,
    },
  };
})();

// FUCHSIA. The cold pink take: a near-black with a faint violet cast, icy
// whites and fuchsia on functions. Violet-blue storage, red flow, cyan
// branches, aqua types, apricot keys, green strings, sky numbers.
const fuchsia = (() => {
  const bg = (L) => oklch(L, 0.006, 300);
  const c = {
    bg0: bg(0.11),
    bg1: bg(0.135),
    bg2: bg(0.175),
    bg3: bg(0.215),
    bg4: bg(0.29),
    fg: oklch(0.91, 0.006, 260),
    fg1: oklch(0.95, 0.005, 260),
    white: oklch(0.975, 0.012, 240),
    fgMuted: oklch(0.7, 0.012, 260),
    fgDim: oklch(0.53, 0.012, 260),
    mute: oklch(0.64, 0.02, 290),
    fuchsia: oklch(0.78, 0.2, 338),
    pink: oklch(0.86, 0.13, 350),
    rosePink: oklch(0.9, 0.08, 335),
    lilac: oklch(0.9, 0.1, 300),
    sky: oklch(0.86, 0.13, 210),
    periwinkle: oklch(0.84, 0.12, 280),
    electric: oklch(0.76, 0.16, 232),
    red: oklch(0.7, 0.21, 15),
  };
  const t = syntax(
    {
      storage: 268,
      flow: 10,
      red: 32,
      branch: 190,
      call: 322,
      type: 180,
      class: 95,
      ns: 130,
      member: 240,
      key: 60,
      string: 145,
      number: 230,
      constant: 300,
      warm: 250,
      object: 220,
    },
    { comment: c.mute, dim: oklch(0.6, 0.015, 270), fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload fuchsia",
    slug: "fuchsia",
    ...c,
    grey: c.mute,
    t,
    accent: oklch(0.72, 0.21, 338),
    accent2: c.white,
    accentFg: c.white,
    cursor: c.fuchsia,
    selection: a(oklch(0.38, 0.07, 335), 0x99),
    error: c.red,
    warning: oklch(0.86, 0.14, 80),
    info: c.electric,
    success: oklch(0.84, 0.13, 165),
    gitModified: c.sky,
    bracket: [c.pink, c.sky, c.lilac],
    tint: oklch(0.9, 0.09, 335),
    tintStrong: oklch(0.9, 0.12, 335),
    terminal: {
      black: bg(0.3),
      red: c.red,
      green: oklch(0.82, 0.14, 165),
      yellow: oklch(0.86, 0.14, 80),
      blue: c.electric,
      magenta: c.fuchsia,
      cyan: c.sky,
      white: c.fg,
      brBlack: c.mute,
      brRed: oklch(0.8, 0.17, 15),
      brGreen: oklch(0.88, 0.12, 165),
      brYellow: oklch(0.92, 0.1, 85),
      brBlue: oklch(0.84, 0.12, 232),
      brMagenta: c.pink,
      brCyan: oklch(0.9, 0.09, 210),
      brWhite: c.white,
    },
  };
})();

// OCEAN. In the mold of Material's Deep Ocean: a deep navy-black with a
// visible blue cast, blue-grey text, blue functions, purple storage, red flow,
// cyan branches, teal types, yellow classes, orange keys, green strings, pink
// numbers and a bright cyan accent.
const ocean = (() => {
  const bg = (L) => oklch(L, 0.022, 280);
  const c = {
    bg0: bg(0.1),
    bg1: bg(0.12),
    bg2: bg(0.155),
    bg3: bg(0.2),
    bg4: bg(0.255),
    fg: oklch(0.85, 0.025, 265),
    fg1: oklch(0.93, 0.02, 265),
    fgMuted: oklch(0.67, 0.04, 268),
    fgDim: oklch(0.5, 0.04, 268),
    mute: oklch(0.61, 0.06, 275),
    blue: oklch(0.8, 0.15, 262),
    purple: oklch(0.8, 0.15, 310),
    red: oklch(0.74, 0.18, 15),
    electric: oklch(0.76, 0.16, 232),
    yellow: oklch(0.87, 0.15, 82),
    lemon: oklch(0.92, 0.16, 95),
    green: oklch(0.88, 0.14, 125),
    orange: oklch(0.79, 0.16, 42),
    cyan: oklch(0.88, 0.12, 215),
    paleblue: oklch(0.86, 0.05, 230),
    accentCyan: oklch(0.9, 0.14, 195),
  };
  const t = syntax(
    {
      storage: 320,
      flow: 0,
      branch: 185,
      call: 258,
      type: 175,
      class: 95,
      ns: 125,
      member: 230,
      key: 55,
      string: 140,
      number: 335,
      constant: 290,
      warm: 260,
      object: 95,
    },
    { comment: c.mute, dim: oklch(0.6, 0.03, 270), fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload ocean",
    slug: "ocean",
    ...c,
    grey: c.mute,
    t,
    accent: c.accentCyan,
    accent2: c.blue,
    accentFg: c.bg0,
    cursor: oklch(0.92, 0.13, 195),
    selection: a(oklch(0.4, 0.06, 262), 0xa6),
    error: c.red,
    warning: c.yellow,
    info: c.blue,
    success: c.green,
    gitModified: c.blue,
    bracket: [c.yellow, c.purple, c.cyan],
    tint: oklch(0.88, 0.08, 210),
    tintStrong: oklch(0.9, 0.13, 195),
    terminal: {
      black: bg(0.32),
      red: c.red,
      green: c.green,
      yellow: c.yellow,
      blue: c.blue,
      magenta: c.purple,
      cyan: c.cyan,
      white: c.fg,
      brBlack: c.mute,
      brRed: oklch(0.82, 0.16, 15),
      brGreen: oklch(0.92, 0.12, 125),
      brYellow: c.lemon,
      brBlue: oklch(0.86, 0.12, 262),
      brMagenta: oklch(0.86, 0.12, 310),
      brCyan: c.accentCyan,
      brWhite: c.fg1,
    },
  };
})();

// PRIMER. GitHub Dark lineage: the #0d1117 navy-black with a darker side
// bar, grey-blue text, coral storage, pink-red flow, sky branches, purple
// functions, amber types, green keys, light-blue strings.
const primer = (() => {
  const bg = (L) => oklch(L, 0.012, 255);
  const c = {
    bg0: bg(0.12),
    bg1: bg(0.175),
    bg2: bg(0.21),
    bg3: bg(0.25),
    bg4: bg(0.32),
    fg: oklch(0.86, 0.01, 250),
    fg1: oklch(0.93, 0.008, 250),
    fgMuted: oklch(0.66, 0.015, 250),
    fgDim: oklch(0.5, 0.015, 250),
    mute: oklch(0.63, 0.015, 250),
    coral: oklch(0.76, 0.17, 25),
    pink: oklch(0.8, 0.15, 350),
    purple: oklch(0.8, 0.15, 305),
    orange: oklch(0.8, 0.15, 60),
    skyLight: oklch(0.88, 0.09, 230),
    blue: oklch(0.8, 0.14, 250),
    green: oklch(0.86, 0.15, 150),
    electric: oklch(0.76, 0.16, 232),
    red: oklch(0.7, 0.19, 25),
  };
  const t = syntax(
    {
      storage: 25,
      flow: 0,
      branch: 210,
      call: 295,
      type: 70,
      class: 100,
      ns: 140,
      member: 215,
      key: 150,
      string: 245,
      templ: 350,
      number: 200,
      constant: 260,
      warm: 250,
      object: 90,
    },
    { comment: c.mute, dim: oklch(0.6, 0.015, 250), fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload primer",
    slug: "primer",
    ...c,
    grey: c.mute,
    t,
    accent: oklch(0.68, 0.16, 255),
    accent2: c.pink,
    accentFg: oklch(0.97, 0.01, 250),
    cursor: c.fg1,
    selection: a(oklch(0.4, 0.07, 255), 0xa6),
    error: c.red,
    warning: oklch(0.8, 0.14, 75),
    info: c.blue,
    success: oklch(0.78, 0.15, 150),
    gitModified: oklch(0.8, 0.14, 75),
    bracket: [c.orange, c.purple, c.blue],
    tint: oklch(0.86, 0.08, 250),
    tintStrong: oklch(0.88, 0.13, 245),
    terminal: {
      black: bg(0.32),
      red: c.coral,
      green: oklch(0.78, 0.15, 150),
      yellow: oklch(0.8, 0.14, 75),
      blue: c.blue,
      magenta: c.purple,
      cyan: oklch(0.8, 0.11, 200),
      white: oklch(0.8, 0.01, 250),
      brBlack: c.mute,
      brRed: oklch(0.82, 0.14, 25),
      brGreen: c.green,
      brYellow: oklch(0.88, 0.14, 85),
      brBlue: c.skyLight,
      brMagenta: oklch(0.88, 0.1, 305),
      brCyan: oklch(0.88, 0.09, 200),
      brWhite: c.fg1,
    },
  };
})();

// GEIST. Vercel lineage: a true neutral black, neutral greys, near-white
// text, blue functions, pink storage, purple flow, teal branches, amber
// types, lemon classes, orange keys, green strings.
const geist = (() => {
  const bg = (L) => oklch(L, 0, 0);
  const c = {
    bg0: bg(0.09),
    bg1: bg(0.115),
    bg2: bg(0.16),
    bg3: bg(0.2),
    bg4: bg(0.28),
    fg: oklch(0.93, 0, 0),
    fg1: oklch(0.96, 0, 0),
    fgMuted: oklch(0.7, 0, 0),
    fgDim: oklch(0.52, 0, 0),
    mute: oklch(0.62, 0, 0),
    blue: oklch(0.78, 0.16, 250),
    pink: oklch(0.72, 0.23, 350),
    purple: oklch(0.72, 0.2, 315),
    teal: oklch(0.86, 0.14, 175),
    amber: oklch(0.84, 0.16, 75),
    lemon: oklch(0.92, 0.16, 95),
    electric: oklch(0.76, 0.16, 232),
    red: oklch(0.68, 0.21, 25),
  };
  const t = syntax(
    {
      storage: 355,
      flow: 320,
      branch: 185,
      call: 250,
      type: 75,
      class: 100,
      ns: 125,
      member: 290,
      key: 40,
      string: 150,
      number: 200,
      constant: 320,
      warm: 0,
      object: 95,
    },
    { comment: c.mute, dim: oklch(0.6, 0, 0), fg: c.fg, fg1: c.fg1 },
  );
  return {
    name: "overload geist",
    slug: "geist",
    ...c,
    grey: c.mute,
    t,
    accent: oklch(0.62, 0.2, 255),
    accent2: c.pink,
    accentFg: oklch(0.97, 0, 0),
    cursor: c.fg1,
    selection: a(oklch(0.38, 0.08, 255), 0xa6),
    error: c.red,
    warning: c.amber,
    info: c.blue,
    success: oklch(0.78, 0.15, 155),
    gitModified: c.amber,
    bracket: [c.blue, c.pink, c.amber],
    tint: oklch(0.86, 0.07, 250),
    tintStrong: oklch(0.86, 0.12, 250),
    terminal: {
      black: bg(0.3),
      red: c.red,
      green: oklch(0.78, 0.15, 155),
      yellow: c.amber,
      blue: c.blue,
      magenta: c.purple,
      cyan: c.teal,
      white: c.fg,
      brBlack: c.mute,
      brRed: oklch(0.8, 0.18, 25),
      brGreen: oklch(0.86, 0.13, 155),
      brYellow: c.lemon,
      brBlue: oklch(0.86, 0.12, 250),
      brMagenta: oklch(0.84, 0.15, 315),
      brCyan: oklch(0.9, 0.1, 175),
      brWhite: c.fg1,
    },
  };
})();

// ---------------------------------------------------------------------------
// Workbench colors
// ---------------------------------------------------------------------------

function uiColors(p, borderless) {
  const chrome = borderless ? p.bg1 : p.bg0; // sidebar / status bar / activity bar
  const border = borderless ? NONE : a(p.bg4, 0xb3);
  const borderSoft = borderless ? NONE : a(p.bg4, 0x66);
  const hover = a(p.fgMuted, 0x1f);
  const selectedRow = a(p.fgMuted, 0x2e);
  const T = p.terminal;
  return {
    "activityBar.activeBorder": p.accent,
    "activityBar.background": chrome,
    "activityBar.border": border,
    "activityBar.foreground": p.fg,
    "activityBar.inactiveForeground": a(p.fgMuted, 0xe6),
    "activityBarBadge.background": p.accent,
    "activityBarBadge.foreground": p.accentFg,
    "activityBarTop.activeBorder": p.accent,
    "activityBarTop.background": chrome,
    "activityBarTop.foreground": p.fg,
    "activityBarTop.inactiveForeground": a(p.fgMuted, 0xe6),
    "activityBarTop.dropBorder": p.accent,
    "sideBarActivityBarTop.border": border,
    "badge.background": a(p.accent, 0x33),
    "badge.foreground": p.accent,
    "banner.background": p.bg3,
    "banner.foreground": p.fg,
    "banner.iconForeground": p.accent,
    "breadcrumb.activeSelectionForeground": p.tintStrong,
    "breadcrumb.focusForeground": p.tint,
    "breadcrumb.foreground": p.fgMuted,
    "breadcrumbPicker.background": p.bg2,
    "button.background": p.accent,
    "button.foreground": p.accentFg,
    "button.hoverBackground": a(p.accent, 0xe6),
    "button.border": NONE,
    "button.separator": a(p.accentFg, 0x66),
    "button.secondaryBackground": p.bg3,
    "button.secondaryForeground": p.fg,
    "button.secondaryHoverBackground": p.bg4,
    "checkbox.background": p.bg3,
    "checkbox.border": a(p.bg4, 0xff),
    "checkbox.foreground": p.fg,
    "commandCenter.background": p.bg2,
    "commandCenter.foreground": p.fgMuted,
    "commandCenter.activeForeground": p.fg,
    "commandCenter.activeBackground": p.bg3,
    "commandCenter.border": borderless ? NONE : a(p.bg4, 0x99),
    "commandCenter.inactiveForeground": p.fgDim,
    "commandCenter.inactiveBorder": borderless ? NONE : a(p.bg4, 0x66),
    "debugConsoleInputIcon.foreground": p.accent,
    "debugExceptionWidget.background": p.bg2,
    "debugExceptionWidget.border": p.bg4,
    "debugIcon.breakpointDisabledForeground": a(p.error, 0x80),
    "debugIcon.breakpointForeground": p.error,
    "debugToolBar.background": p.bg2,
    "debugToolBar.border": borderSoft,
    descriptionForeground: p.fgMuted,
    "diffEditor.diagonalFill": p.bg3,
    "diffEditor.insertedLineBackground": NONE,
    "diffEditor.insertedTextBackground": a(p.success, 0x1a),
    "diffEditor.removedLineBackground": NONE,
    "diffEditor.removedTextBackground": a(p.error, 0x1f),
    "dropdown.background": p.bg2,
    "dropdown.listBackground": p.bg2,
    "dropdown.border": a(p.bg4, 0xcc),
    "dropdown.foreground": p.fg,
    "editor.background": p.bg1,
    "editor.findMatchBackground": NONE,
    "editor.findMatchBorder": p.accent2,
    "editor.findMatchHighlightBackground": NONE,
    "editor.findMatchHighlightBorder": a(p.accent2, 0xb3),
    "editor.findRangeHighlightBackground": a(p.accent, 0x1a),
    "editor.foldBackground": a(p.fgMuted, 0x14),
    "editor.foreground": p.fg,
    "editor.inactiveSelectionBackground": a(p.fgMuted, 0x1a),
    "editor.lineHighlightBackground": NONE,
    "editor.lineHighlightBorder": NONE,
    "editor.linkedEditingBackground": a(p.fg, 0x10),
    "editor.rangeHighlightBackground": NONE,
    "editor.selectionBackground": p.selection,
    "editor.selectionHighlightBackground": NONE,
    "editor.selectionHighlightBorder": a(p.info, 0x99),
    "editor.snippetTabstopHighlightBackground": a(p.accent, 0x33),
    "editor.wordHighlightBackground": NONE,
    "editor.wordHighlightBorder": a(p.fgMuted, 0x66),
    "editor.wordHighlightStrongBackground": a(p.accent, 0x14),
    "editor.wordHighlightStrongBorder": a(p.accent, 0xb3),
    "editorBracketHighlight.foreground1": p.bracket[0],
    "editorBracketHighlight.foreground2": p.bracket[1],
    "editorBracketHighlight.foreground3": p.bracket[2],
    "editorBracketHighlight.unexpectedBracket.foreground": p.error,
    "editorBracketPairGuide.activeBackground1": a(p.bracket[0], 0x80),
    "editorBracketPairGuide.activeBackground2": a(p.bracket[1], 0x80),
    "editorBracketPairGuide.activeBackground3": a(p.bracket[2], 0x80),
    "editorBracketMatch.background": a(p.fgMuted, 0x33),
    "editorBracketMatch.border": a(p.fgMuted, 0x66),
    "editorCodeLens.foreground": p.fgMuted,
    "editorCursor.foreground": p.cursor,
    "editorError.foreground": p.error,
    "editorWarning.foreground": p.warning,
    "editorInfo.foreground": p.info,
    "editorHint.foreground": p.fgMuted,
    "editorGhostText.foreground": a(p.fgMuted, 0xd9),
    "editorGroup.border": border,
    "editorGroup.dropBackground": a(p.accent, 0x1a),
    "editorGroupHeader.border": NONE,
    "editorGroupHeader.noTabsBackground": p.bg1,
    "editorGroupHeader.tabsBackground": NONE,
    "editorGroupHeader.tabsBorder": borderSoft,
    "editorGutter.addedBackground": p.success,
    "editorGutter.deletedBackground": p.error,
    "editorGutter.modifiedBackground": p.gitModified,
    "editorGutter.foldingControlForeground": p.fgMuted,
    "editorHoverWidget.background": p.bg2,
    "editorHoverWidget.border": a(p.bg4, 0xcc),
    "editorHoverWidget.foreground": p.fg,
    "editorHoverWidget.highlightForeground": p.accent,
    "editorIndentGuide.activeBackground1": a(p.fgMuted, 0x66),
    "editorIndentGuide.background1": a(p.fgMuted, 0x26),
    "editorInlayHint.background": a(p.fgMuted, 0x14),
    "editorInlayHint.foreground": a(p.fgMuted, 0xd9),
    "editorInlayHint.typeBackground": a(p.fgMuted, 0x14),
    "editorInlayHint.typeForeground": a(p.fgMuted, 0xd9),
    "editorInlayHint.parameterBackground": a(p.fgMuted, 0x14),
    "editorInlayHint.parameterForeground": a(p.fgMuted, 0xd9),
    "editorLightBulb.foreground": p.warning,
    "editorLightBulbAutoFix.foreground": p.accent,
    "editorLineNumber.activeForeground": p.accent,
    "editorLineNumber.foreground": a(p.fgMuted, 0xa6),
    "editorLink.activeForeground": p.accent,
    "editorMarkerNavigation.background": p.bg2,
    "editorOverviewRuler.addedForeground": p.success,
    "editorOverviewRuler.border": NONE,
    "editorOverviewRuler.bracketMatchForeground": a(p.fgMuted, 0xb3),
    "editorOverviewRuler.deletedForeground": p.error,
    "editorOverviewRuler.errorForeground": p.error,
    "editorOverviewRuler.findMatchForeground": a(p.accent2, 0x66),
    "editorOverviewRuler.infoForeground": p.info,
    "editorOverviewRuler.modifiedForeground": p.gitModified,
    "editorOverviewRuler.warningForeground": p.warning,
    "editorOverviewRuler.wordHighlightForeground": a(p.info, 0x66),
    "editorOverviewRuler.wordHighlightStrongForeground": a(p.accent, 0x66),
    "editorRuler.foreground": a(p.fgMuted, 0x26),
    "editorStickyScroll.background": p.bg1,
    "editorStickyScroll.border": borderless ? a(p.bg4, 0x66) : a(p.bg4, 0x99),
    "editorStickyScroll.shadow": borderless ? NONE : a("#000000", 0x4d),
    "editorStickyScrollHover.background": hover,
    "editorSuggestWidget.background": p.bg2,
    "editorSuggestWidget.border": a(p.bg4, 0xcc),
    "editorSuggestWidget.foreground": p.fg,
    "editorSuggestWidget.highlightForeground": p.accent,
    "editorSuggestWidget.focusHighlightForeground": p.accent,
    "editorSuggestWidget.selectedBackground": selectedRow,
    "editorSuggestWidget.selectedForeground": p.tintStrong,
    "editorUnnecessaryCode.opacity": "#00000099",
    "editorWhitespace.foreground": a(p.fgDim, 0x99),
    "editorWidget.background": p.bg2,
    "editorWidget.foreground": p.fg,
    "editorWidget.border": a(p.bg4, 0xcc),
    "editorWidget.resizeBorder": p.accent,
    "editorActionList.background": p.bg2,
    "editorActionList.foreground": p.fg,
    "editorActionList.focusBackground": selectedRow,
    "editorActionList.focusForeground": p.fg1,
    errorForeground: p.error,
    "extensionButton.prominentBackground": p.accent,
    "extensionButton.prominentForeground": p.accentFg,
    "extensionButton.prominentHoverBackground": a(p.accent, 0xe6),
    "extensionBadge.remoteBackground": p.accent,
    "extensionBadge.remoteForeground": p.accentFg,
    "extensionIcon.starForeground": p.accent2,
    "extensionIcon.verifiedForeground": p.info,
    focusBorder: a(p.accent, 0xb3),
    foreground: p.fg,
    "gitDecoration.addedResourceForeground": p.success,
    "gitDecoration.conflictingResourceForeground": p.error,
    "gitDecoration.deletedResourceForeground": a(p.error, 0xb3),
    "gitDecoration.ignoredResourceForeground": a(p.fgDim, 0xcc),
    "gitDecoration.modifiedResourceForeground": p.gitModified,
    "gitDecoration.renamedResourceForeground": p.success,
    "gitDecoration.stageDeletedResourceForeground": a(p.error, 0xb3),
    "gitDecoration.stageModifiedResourceForeground": p.gitModified,
    "gitDecoration.submoduleResourceForeground": a(p.accent2, 0xb3),
    "gitDecoration.untrackedResourceForeground": a(p.success, 0xe6),
    "icon.foreground": p.fgMuted,
    "input.background": p.bg3,
    "input.border": NONE,
    "input.foreground": p.fg,
    "input.placeholderForeground": a(p.fgMuted, 0xd9),
    "inputOption.activeBackground": a(p.accent, 0x33),
    "inputOption.activeBorder": a(p.accent, 0x4d),
    "inputOption.activeForeground": p.accent,
    "inputOption.hoverBackground": hover,
    "inputValidation.errorBackground": p.bg2,
    "inputValidation.errorBorder": p.error,
    "inputValidation.infoBackground": p.bg2,
    "inputValidation.infoBorder": p.info,
    "inputValidation.warningBackground": p.bg2,
    "inputValidation.warningBorder": p.warning,
    "keybindingLabel.background": a(p.fgMuted, 0x1a),
    "keybindingLabel.border": a(p.fg, 0x1a),
    "keybindingLabel.bottomBorder": a(p.fg, 0x1a),
    "keybindingLabel.foreground": p.fg,
    "list.activeSelectionBackground": selectedRow,
    "list.activeSelectionForeground": p.tintStrong,
    "list.activeSelectionIconForeground": p.accent,
    "list.deemphasizedForeground": p.fgDim,
    "list.dropBackground": a(p.accent, 0x1a),
    "list.errorForeground": p.error,
    "list.filterMatchBackground": a(p.accent2, 0x33),
    "list.filterMatchBorder": NONE,
    "list.focusBackground": selectedRow,
    "list.focusAndSelectionOutline": NONE,
    "list.focusForeground": p.fg1,
    "list.focusOutline": NONE,
    "list.hoverBackground": hover,
    "list.hoverForeground": p.tintStrong,
    "list.inactiveSelectionBackground": a(p.fgMuted, 0x1a),
    "list.inactiveSelectionForeground": p.tint,
    "list.invalidItemForeground": a(p.error, 0xb3),
    "list.warningForeground": p.warning,
    "list.highlightForeground": p.accent,
    "list.focusHighlightForeground": p.accent,
    "listFilterWidget.background": p.bg2,
    "listFilterWidget.noMatchesOutline": p.error,
    "listFilterWidget.outline": p.accent,
    "menu.background": p.bg2,
    "menu.foreground": p.fg,
    "menu.selectionBackground": selectedRow,
    "menu.selectionForeground": p.fg1,
    "menu.separatorBackground": a(p.bg4, 0xcc),
    "menu.border": a(p.bg4, 0xcc),
    "minimap.background": chrome,
    "minimap.errorHighlight": p.error,
    "minimap.findMatchHighlight": a(p.accent2, 0x66),
    "minimap.selectionHighlight": p.selection,
    "minimapGutter.addedBackground": p.success,
    "minimapGutter.deletedBackground": p.error,
    "minimapGutter.modifiedBackground": p.gitModified,
    "multiDiffEditor.headerBackground": p.bg2,
    "multiDiffEditor.border": borderSoft,
    "notificationCenterHeader.background": p.bg3,
    "notificationCenterHeader.foreground": p.fg,
    "notifications.background": p.bg2,
    "notifications.foreground": p.fg,
    "notifications.border": a(p.bg4, 0x99),
    "notificationToast.border": a(p.bg4, 0xcc),
    "notificationLink.foreground": p.accent,
    "notificationsErrorIcon.foreground": p.error,
    "notificationsWarningIcon.foreground": p.warning,
    "notificationsInfoIcon.foreground": p.info,
    "panel.background": p.bg1,
    "panel.border": border,
    "panelTitle.activeBorder": p.accent,
    "panelTitle.activeForeground": p.tint,
    "panelTitle.inactiveForeground": p.fgMuted,
    "panelSection.border": borderSoft,
    "panelSectionHeader.background": p.bg1,
    "peekView.border": a(p.accent, 0x80),
    "peekViewEditor.background": p.bg2,
    "peekViewEditor.matchHighlightBackground": NONE,
    "peekViewEditor.matchHighlightBorder": a(p.accent2, 0xb3),
    "peekViewResult.background": p.bg2,
    "peekViewResult.fileForeground": p.fg,
    "peekViewResult.lineForeground": p.fgMuted,
    "peekViewResult.matchHighlightBackground": a(p.accent2, 0x33),
    "peekViewResult.selectionBackground": selectedRow,
    "peekViewResult.selectionForeground": p.fg1,
    "peekViewTitle.background": p.bg3,
    "peekViewTitleDescription.foreground": p.tint,
    "peekViewTitleLabel.foreground": p.fg1,
    "pickerGroup.border": a(p.bg4, 0x99),
    "pickerGroup.foreground": p.accent,
    "problemsErrorIcon.foreground": p.error,
    "problemsWarningIcon.foreground": p.warning,
    "problemsInfoIcon.foreground": p.info,
    "progressBar.background": p.accent,
    "quickInput.background": p.bg2,
    "quickInput.foreground": p.fg,
    "quickInputTitle.background": p.bg3,
    "quickInputList.focusBackground": selectedRow,
    "quickInputList.focusForeground": p.tintStrong,
    "quickInputList.focusIconForeground": p.accent,
    "sash.hoverBorder": a(p.accent, 0x80),
    "scrollbar.shadow": NONE,
    "scrollbarSlider.activeBackground": a(p.fgMuted, 0x80),
    "scrollbarSlider.background": a(p.accent, 0x33),
    "scrollbarSlider.hoverBackground": a(p.accent, 0x66),
    "search.resultsInfoForeground": p.fgMuted,
    "selection.background": p.selection,
    "settings.headerForeground": p.fg1,
    "settings.modifiedItemIndicator": p.accent,
    "settings.focusedRowBackground": a(p.fgMuted, 0x0f),
    "settings.rowHoverBackground": a(p.fgMuted, 0x0a),
    "sideBar.background": chrome,
    "sideBar.border": border,
    "sideBar.foreground": p.fg,
    "sideBarSectionHeader.background": chrome,
    "sideBarSectionHeader.border": borderSoft,
    "sideBarSectionHeader.foreground": p.tint,
    "sideBarTitle.foreground": p.fgMuted,
    "sideBarTitle.background": chrome,
    "sideBarStickyScroll.background": chrome,
    "sideBarStickyScroll.border": borderSoft,
    "statusBar.background": chrome,
    "statusBar.border": border,
    "statusBar.debuggingBackground": p.accent2,
    "statusBar.debuggingForeground": p.accentFg,
    "statusBar.foreground": p.tint,
    "statusBar.noFolderBackground": chrome,
    "statusBarItem.activeBackground": a(p.fgMuted, 0x33),
    "statusBarItem.hoverBackground": a(p.fgMuted, 0x1f),
    "statusBarItem.hoverForeground": p.fg1,
    "statusBarItem.prominentBackground": NONE,
    "statusBarItem.prominentForeground": p.accent,
    "statusBarItem.prominentHoverBackground": a(p.fgMuted, 0x1f),
    "statusBarItem.remoteBackground": p.accent,
    "statusBarItem.remoteForeground": p.accentFg,
    "statusBarItem.errorBackground": p.error,
    "statusBarItem.errorForeground": p.accentFg,
    "statusBarItem.warningBackground": p.warning,
    "statusBarItem.warningForeground": p.accentFg,
    "tab.activeBackground": p.bg1,
    "tab.activeBorder": p.accent,
    "tab.activeBorderTop": NONE,
    "tab.activeForeground": p.tint,
    "tab.border": borderSoft,
    "tab.hoverForeground": p.tint,
    "tab.hoverBackground": hover,
    "tab.inactiveBackground": NONE,
    "tab.inactiveForeground": p.fgMuted,
    "tab.unfocusedActiveBackground": NONE,
    "tab.unfocusedActiveBorder": a(p.accent, 0x66),
    "tab.unfocusedActiveBorderTop": NONE,
    "tab.unfocusedActiveForeground": a(p.tint, 0xb3),
    "tab.unfocusedInactiveBackground": NONE,
    "tab.unfocusedInactiveForeground": p.fgDim,
    "terminal.ansiBlack": T.black,
    "terminal.ansiRed": T.red,
    "terminal.ansiGreen": T.green,
    "terminal.ansiYellow": T.yellow,
    "terminal.ansiBlue": T.blue,
    "terminal.ansiMagenta": T.magenta,
    "terminal.ansiCyan": T.cyan,
    "terminal.ansiWhite": T.white,
    "terminal.ansiBrightBlack": T.brBlack,
    "terminal.ansiBrightRed": T.brRed,
    "terminal.ansiBrightGreen": T.brGreen,
    "terminal.ansiBrightYellow": T.brYellow,
    "terminal.ansiBrightBlue": T.brBlue,
    "terminal.ansiBrightMagenta": T.brMagenta,
    "terminal.ansiBrightCyan": T.brCyan,
    "terminal.ansiBrightWhite": T.brWhite,
    "terminal.background": p.bg1,
    "terminal.foreground": p.fg,
    "terminal.selectionBackground": p.selection,
    "terminal.initialHintForeground": p.fgDim,
    "terminal.tab.activeBorder": p.accent,
    "terminalCursor.foreground": p.cursor,
    "terminalStickyScroll.background": p.bg1,
    "textBlockQuote.background": p.bg2,
    "textBlockQuote.border": a(p.accent, 0x80),
    "textCodeBlock.background": p.bg2,
    "textLink.activeForeground": p.accent2,
    "textLink.foreground": p.accent,
    "textPreformat.foreground": p.fg1,
    "textPreformat.background": a(p.fgMuted, 0x1f),
    "textSeparator.foreground": a(p.bg4, 0xcc),
    "titleBar.activeBackground": chrome,
    "titleBar.activeForeground": p.fg,
    "titleBar.border": borderless ? a(p.bg4, 0x40) : border,
    "titleBar.inactiveBackground": chrome,
    "titleBar.inactiveForeground": p.fgDim,
    "toolbar.hoverBackground": hover,
    "toolbar.activeBackground": a(p.fgMuted, 0x33),
    "tree.indentGuidesStroke": a(p.fgMuted, 0x66),
    "tree.inactiveIndentGuidesStroke": a(p.fgMuted, 0x26),
    "walkThrough.embeddedEditorBackground": p.bg2,
    "welcomePage.background": p.bg1,
    "welcomePage.progress.background": p.bg3,
    "welcomePage.progress.foreground": p.accent,
    "welcomePage.tileBackground": p.bg2,
    "welcomePage.tileHoverBackground": p.bg3,
    "widget.border": a(p.bg4, 0xcc),
    "widget.shadow": borderless ? a("#000000", 0x4d) : a("#000000", 0x80),
  };
}

// ---------------------------------------------------------------------------
// Semantic tokens (TypeScript / JavaScript first, Solidity kept for parity)
// ---------------------------------------------------------------------------

function semanticTokenColors(p) {
  const t = p.t;
  const s = t.sol;
  return {
    // TypeScript / JavaScript. `variable`, `parameter` and `property` are left
    // to TextMate on purpose: package.json maps their declaration/local
    // variants to custom scopes that the tokenColors below style.
    class: t.class,
    "class.declaration": lift(t.class),
    "class.defaultLibrary": t.supportClass,
    interface: t.type,
    "interface.declaration": lift(t.type),
    type: t.type,
    "type.declaration": lift(t.type),
    "type.defaultLibrary": t.typeSupport,
    enum: t.typePrimitive,
    "enum.declaration": lift(t.typePrimitive),
    enumMember: t.objectKey,
    typeParameter: t.typeParam,
    namespace: t.namespace,
    function: t.function,
    "function.declaration": lift(t.function),
    "function.defaultLibrary": t.supportFunction,
    method: t.method,
    "method.declaration": lift(t.method),
    "method.defaultLibrary": t.supportFunction,
    "variable.defaultLibrary": t.supportVariable,
    "variable.readonly.defaultLibrary": t.objectKey,
    // parameters are italic wherever they appear, so inputs stand out from
    // locals without another color
    "parameter.declaration": { fontStyle: "italic" },
    parameter: { fontStyle: "italic" },
    "variable.declaration.readonly": {},
    // Solidity (vsc-solidity)
    library: s.semLibrary,
    event: s.event,
    using: s.using,
    "interface:solidity": s.semInterface,
    contract: s.semContract,
    "variable.local:solidity": s.localVar,
    "variable.storage:solidity": s.storageVar,
    "parameter.function.output": s.paramOut,
    "parameter.function.input": s.paramIn,
    "property.struct": s.propStruct,
    "variable.local.storage:solidity": s.storageVar,
    "parameter.function.input.storage": s.storageVar,
    "property.assignment.struct": s.propAssign,
    "property:solidity": s.prop,
    "property.mapping.struct": s.propAssign,
    "property.defaultLibrary:solidity": { foreground: s.propDefault, fontStyle: "italic" },
    "parameter.function.output.storage": s.paramOutStorage,
    "interface.defaultLibrary": { foreground: t.typeSupport },
  };
}

// ---------------------------------------------------------------------------
// TextMate tokens. Same scope structure as the original overload theme,
// colors come from the palette roles.
// ---------------------------------------------------------------------------

function tokenColors(p) {
  const t = p.t;
  const s = t.sol;
  const r = (scope, foreground, extra) => ({
    scope,
    settings: { ...(foreground ? { foreground } : {}), ...extra },
  });
  const plain = { fontStyle: "" };
  const italic = { fontStyle: "italic" };
  return [
    r(
      "source.solidity storage.type.function, source.solidity storage.type.contract, source.solidity storage.type.interface, source.solidity storage.modifier.is",
      s.keyword,
    ),
    r("source.solidity constant.language.boolean", s.bool),
    r("source.solidity entity.name.function.modifier", s.modifierFn, plain),
    r("meta.parameters variable.parameter", t.parameter, italic),
    r("meta.block variable.parameter", t.parameter, italic),
    r(["comment"], t.comment, plain),
    r(["string", "constant.other.symbol"], t.string),
    r(["string.regexp", "constant.character", "constant.other"], t.regexp),
    r(["constant.numeric", "constant.language"], t.constant),
    r(["variable.member"], t.emphasis),
    r(["variable.language"], t.variableLanguage, { fontStyle: "italic" }),
    r(["storage"], t.keyword),
    r(["keyword"], t.keyword),
    r(["keyword.operator"], t.operator),
    r(["punctuation.separator", "punctuation.terminator"], t.punct),
    r(["punctuation.section"], t.punct),
    r(["punctuation.accessor"], t.accessor),
    r(["punctuation.definition.template-expression"], t.templateExpr),
    r(["punctuation.section.embedded"], t.templateExpr),
    r(
      ["source.java storage.type", "source.haskell storage.type", "source.c storage.type"],
      t.langStorageType,
    ),
    r(["entity.other.inherited-class"], t.inheritedClass),
    r(["storage.type", "storage.type.function"], t.keyword),
    r(["source.java storage.type.primitive"], t.typePrimitive),
    r(
      [
        "variable.function",
        "variable.annotation",
        "meta.function-call.generic",
        "support.function.go",
      ],
      t.variableFunction,
    ),
    r(["support.macro"], t.macro),
    r(["entity.name.import", "entity.name.package"], t.string),
    r(["entity.name.tag", "meta.tag.sgml"], t.tag),
    r(["support.class.component"], t.tagComponent),
    r(
      [
        "punctuation.definition.tag.end",
        "punctuation.definition.tag.begin",
        "punctuation.definition.tag",
      ],
      t.tagPunct,
    ),
    r(["entity.other.attribute-name"], t.attribute),
    r(
      [
        "meta.decorator variable.other",
        "meta.decorator punctuation.decorator",
        "storage.type.annotation",
      ],
      t.decorator,
    ),
    r(["invalid"], t.invalid),
    r(["meta.diff", "meta.diff.header"], t.diffHeader),
    r(["source.ruby variable.other.readwrite"], t.variableFunction),
    r(
      [
        "source.css entity.name.tag",
        "source.sass entity.name.tag",
        "source.scss entity.name.tag",
        "source.less entity.name.tag",
        "source.stylus entity.name.tag",
      ],
      t.cssTag,
    ),
    r(
      [
        "source.css support.type",
        "source.sass support.type",
        "source.scss support.type",
        "source.less support.type",
        "source.stylus support.type",
      ],
      t.comment,
    ),
    r(["support.type.property-name"], t.cssProperty, plain),
    r(["constant.numeric.line-number.find-in-files - match"], t.comment),
    r(["constant.numeric.line-number.match"], t.keyword),
    r(["entity.name.filename.find-in-files"], t.string),
    r(["message.error"], t.invalid),
    r(["markup.heading", "markup.heading entity.name"], t.heading, { fontStyle: "bold" }),
    r(["markup.underline.link", "string.other.link"], t.link),
    r(["markup.italic"], t.emphasis, { fontStyle: "italic" }),
    r(["markup.bold"], t.emphasis, { fontStyle: "bold" }),
    r(["markup.italic markup.bold", "markup.bold markup.italic"], null, {
      fontStyle: "bold italic",
    }),
    r(["markup.raw"], null, { background: a(p.fg, 0x05) }),
    r(["markup.raw.inline"], null, { background: a(p.fg, 0x0f) }),
    r(["meta.separator"], t.comment, { background: a(p.fg, 0x0f), fontStyle: "" }),
    r(["markup.quote"], t.quote, { fontStyle: "italic" }),
    r(["markup.list punctuation.definition.list.begin"], t.attribute),
    r(["markup.inserted"], t.inserted),
    r(["markup.changed"], t.changed),
    r(["markup.deleted"], t.deleted),
    r(["markup.strike"], t.strike),
    r(["markup.table"], t.link, { background: a(p.fg, 0x0f) }),
    r(["text.html.markdown markup.inline.raw"], t.operator),
    r(["text.html.markdown meta.dummy.line-break"], t.comment, { background: t.comment }),
    r(["punctuation.definition.markdown"], t.comment, { background: p.fg }),
    r("source.solidity punctuation.accessor", s.accessor),
    r(
      "source.solidity constant.language.currency, source.solidity storage.type.modifier.readonly",
      s.currency,
      { fontStyle: "italic" },
    ),
    r("source.solidity keyword.control.exceptions", s.exceptions),
    r("source.solidity keyword.control", s.control),
    r(
      [
        "source.solidity keyword.operator",
        "source.solidity keyword.operator.arithmetic",
        "source.solidity keyword.operator.logic",
      ],
      s.operator,
    ),
    r(["source.solidity keyword.operator.assignment"], s.operator),
    r(["source.solidity storage.type.modifier.payable"], s.payable),
    r("source.solidity keyword.control.flow", s.flow, plain),
    r("source.solidity variable.parameter.function", s.paramFn),
    r("source.solidity variable.parameter.other", s.paramOther),
    r(
      [
        "storage.type.class.jsdoc",
        "storage.type.dev.natspec",
        "storage.type.param.natspec",
        "storage.type.custom.natspec",
        "storage.type.return.natspec",
      ],
      t.jsdoc,
    ),
    r(["keyword.control.using", "keyword.control.for"], s.using, plain),
    r(["source.solidity storage.type.modifier.access"], s.access),
    r(["source.solidity storage.type.modifier.extendedscope"], s.access),
    r(["source.solidity variable.language.transaction"], s.tx, plain),
    r("entity.name.type.class", t.class),
    r(["source.solidity entity.name.type.contract"], s.contract),
    r(["source.solidity entity.name.type.interface"], s.interface),
    r(["source.solidity entity.name.type.library"], s.library),
    r(
      ["keyword.control.import", "keyword.control.type", "keyword.control.export"],
      t.keywordImport,
    ),
    r(["keyword.control.from"], t.keywordFrom),
    r("entity.other.attribute-name", t.attribute, plain),
    r("keyword.operator.assignment", t.keyword, plain),
    r(["meta.block keyword.operator.assignment"], t.conditional, plain),
    r(["meta.tag.attributes keyword.operator.assignment"], t.jsxAttrAssign, plain),
    r("storage.type.function.arrow", t.keyword),
    r(
      [
        "storage.type.type",
        "storage.type.interface",
        "support.type.primitive",
        "constant.language.boolean.true",
        "meta.type.parameters storage.modifier",
      ],
      t.typePrimitive,
      plain,
    ),
    r(["meta.method.declaration storage.type", "meta.block storage.type"], t.storageBlock, plain),
    r("support.type.builtin", t.falsy),
    r(
      "entity.name.type, keyword.operator.expression.is, keyword.operator.expression.keyof, keyword.operator.type.annotation",
      t.type,
    ),
    r("support.type", t.typeSupport),
    r("support.class", t.supportClass),
    r("storage.type.struct", t.struct),
    r(["support.constant"], t.objectKey, plain),
    r(["support.variable.property"], t.supportVarProp, plain),
    r("keyword.operator.new", t.new, plain),
    r(
      [
        "meta.object.member meta.object.member meta.object-literal.key",
        "meta.object.member meta.object.member meta.object.member meta.object.member meta.object-literal.key",
        "meta.field.declaration meta.field.declaration meta.definition.property variable.object.property",
        "meta.field.declaration meta.field.declaration meta.field.declaration meta.field.declaration meta.definition.property variable.object.property",
      ],
      t.objectKeyNested,
      plain,
    ),
    r("meta.objectliteral meta.object.member", t.objectKey, plain),
    r(
      [
        "meta.object.member meta.object-literal.key",
        "meta.object.member meta.object.member meta.object.member meta.object-literal.key",
        "meta.field.declaration meta.definition.property variable.object.property",
        "meta.field.declaration meta.field.declaration meta.field.declaration meta.definition.property variable.object.property",
      ],
      t.objectKey,
      plain,
    ),
    r(
      "meta.jsx.children meta.tag.attributes meta.embedded.expression variable.other.readwrite",
      t.jsxEmbeddedVar,
      plain,
    ),
    r(["source variable.other.object", "variable.other.readwrite.alias"], t.variableObject, plain),
    r(["source.ts entity.name.variable"], t.variable, plain),
    r(
      [
        "meta.block meta.definition.variable entity.name.variable",
        "source.ts variable.local.readwrite, source.js variable.local.readwrite",
      ],
      t.variableLocal,
      plain,
    ),
    r(
      [
        "meta.var.expr meta.var-single-variable.exp",
        "meta.embedded meta.object.member variable.other.object",
      ],
      t.variableObject,
    ),
    r(
      [
        "meta.definition.variable variable.other.constant",
        "meta.block variable.other.constant",
        "variable.other.constant",
      ],
      t.constantVar,
    ),
    r(["support.method", "support.function"], t.supportFunction),
    r(["entity.name.function", "meta.block storage.type.function.arrow"], t.function),
    r(["entity.name.function.member"], t.method),
    r(
      [
        "variable.other.object.property",
        "meta.block meta.definition.variable variable.other.constant",
        "meta.block variable.local.constant",
      ],
      t.variableLocalConst,
      plain,
    ),
    r(
      ["meta.object.member variable.other.property", "meta.block variable.other.property"],
      t.property,
      plain,
    ),
    r("entity.name.type.enum", t.typePrimitive),
    r("variable.other.enummember", t.objectKey, plain),
    r(
      ["constant.numeric.decimal", "storage.type.numeric.bigint", "constant.numeric.json"],
      t.number,
    ),
    r(["variable.parameter.function-call"], t.callParam),
    r("keyword.operator.arithmetic", t.arithmetic),
    r("punctuation.accessor.optional", t.conditional),
    r(["meta.parameters keyword.operator.type.annotation"], t.paramTypeAnnot, plain),
    r("namespace, entity.name.type.module", t.namespace),
    r("keyword.operator.spread", t.objectKey),
    r(
      [
        "storage.modifier",
        "meta.block meta.arrow keyword.control.flow",
        "meta.block meta.function keyword.control.flow",
      ],
      t.modifier,
    ),
    r(
      [
        "meta.block meta.arrow meta.arrow keyword.control.flow",
        "meta.block meta.arrow meta.function keyword.control.flow",
        "meta.block meta.function meta.arrow keyword.control.flow",
        "meta.block meta.function meta.function keyword.control.flow",
      ],
      t.controlNested,
    ),
    r("keyword.operator.increment", t.arithmetic),
    r(
      "keyword.control.conditional, keyword.operator.ternary, keyword.control.switch, keyword.operator.expression.typeof, keyword.control.loop, keyword.operator.expression.of, keyword.operator.increment",
      t.conditional,
    ),
    r(
      "keyword.operator.comparison, keyword.operator.logical, keyword.operator.relational",
      t.conditional,
    ),
    r("variable.other.constant.property", t.objectKey),
    r("meta.embedded.expression variable.other.object", t.embeddedObj),
    r(["meta.tag string", "meta.jsx string"], t.string),
    r(["string"], t.string),
    r("meta.parameters variable.other.readwrite", t.parameter, italic),
    r("meta.var.expr variable.other.property", t.property),
    r(
      [
        "punctuation.definition.template-expression.begin",
        "punctuation.definition.template-expression.end",
      ],
      t.templateExpr,
    ),
    r(
      [
        "punctuation.definition.string.template.end",
        "punctuation.definition.string.template.begin",
      ],
      t.stringPunct,
      plain,
    ),
    r(["entity.name.tag support.class.component"], t.tagComponentJsx),
    r(["meta.tag entity.name.tag"], t.tagJsx),
    r(
      [
        "meta.block meta.tag.without-attributes punctuation.definition.tag.begin",
        "meta.block meta.tag.without-attributes punctuation.definition.tag.end",
      ],
      t.tagPunct,
    ),
    r("meta.tag.without-attributes, meta.jsx.children", t.jsxText),
    r("keyword.operator.expression.in", t.conditional),
    r(["punctuation.definition.tag.begin", "punctuation.definition.tag.end"], t.tagPunct, plain),
    r(
      [
        "meta.objectliteral punctuation.separator.key-value",
        "meta.objectliteral punctuation.separator.comma",
      ],
      t.objectKey,
      plain,
    ),
    r(["meta.object.member punctuation.accessor"], t.accessorObj, plain),
    r(["meta.block punctuation.accessor"], t.accessorBlock, plain),
    r(
      ["punctuation.separator", "keyword.operator.type", "keyword.operator.rest"],
      t.punctType,
      plain,
    ),
    r(["keyword.operator.rest"], t.attribute, plain),
    r(["storage.modifier.async"], t.async, plain),
    r("meta.object.member meta.object-literal.key string", t.objectKey, plain),
    r(
      ["constant.language.undefined", "constant.language.null", "constant.language.boolean.false"],
      t.falsy,
    ),
    r("keyword.control.flow", t.control),
    r("keyword.control, keyword.control.trycatch", t.control),
    // shell: expansions read as interpolation (like `${}` in a template
    // string) instead of string text. Selectors name `string.quoted` /
    // `meta.herestring` so they outrank the generic `string` rule; `$` of
    // `$name` is scoped `punctuation.definition.variable variable.other.normal`,
    // so the sigil rule names both. Curly `${}` braces are
    // `punctuation.section.bracket.curly.variable`, which would otherwise
    // keep the early generic `punctuation.section` colour.
    r(
      [
        "source.shell string.quoted variable.other.normal",
        "source.shell meta.herestring variable.other.normal",
        "source.shell meta.scope.subshell variable.other.normal",
        "source.shell meta.parameter-expansion variable.other.normal",
        "source.shell variable.other.normal",
      ],
      t.variable,
      plain,
    ),
    r(
      [
        "source.shell string.quoted variable.parameter.positional",
        "source.shell meta.herestring variable.parameter.positional",
        "source.shell variable.parameter.positional",
      ],
      t.parameter,
      italic,
    ),
    r(
      [
        "source.shell string.quoted punctuation.definition.variable",
        "source.shell meta.herestring punctuation.definition.variable",
        "source.shell punctuation.definition.variable",
        "source.shell punctuation.definition.variable variable.other.normal",
        "source.shell punctuation.definition.variable variable.parameter.positional",
        "source.shell punctuation.section.bracket.curly.variable",
        "source.shell punctuation.definition.subshell",
      ],
      t.templateExpr,
      plain,
    ),
    // `:-` / `##` / `%` stay an operator tint so they separate from the `$`/`{}` sigils
    r(["source.shell keyword.operator.expansion"], t.operator, plain),
    r(["source.shell string meta.scope.subshell"], p.fg),
    // bare args vs expansions: quiet member tint, not the variable colour
    r(["source.shell string.unquoted.argument"], t.property, plain),
    r(["source.shell constant.other.option"], t.attribute, plain),
    // sh-inline-syntax embeds: keep the program readable once the shell
    // string scope is replaced by meta.embedded.block.*
    r(
      [
        "meta.embedded.block.awk keyword.other.command",
        "source.awk keyword.other.command",
        "meta.embedded.block.jq support.function",
        "source.jq support.function",
        "meta.embedded.block.jmespath support.function",
        "source.jmespath support.function.builtin",
        "meta.embedded.block.sed keyword.control.command",
        "source.sed keyword.control.command",
      ],
      t.function,
      plain,
    ),
    r(
      [
        "meta.embedded.block.awk variable.language",
        "source.awk variable.language",
        "meta.embedded.block.jmespath variable.language",
        "source.jmespath variable.language",
      ],
      t.variableLanguage,
      italic,
    ),
    r(
      [
        "meta.embedded.block.awk string.regexp",
        "source.awk string.regexp",
        "meta.embedded.block.sed string.regexp",
        "source.sed string.regexp",
      ],
      t.regexp,
      plain,
    ),
    r(
      [
        "meta.embedded.block.jq property",
        "source.jq property",
        "meta.embedded.block.jmespath variable.other.property",
        "source.jmespath variable.other.property",
      ],
      t.property,
      plain,
    ),
    r("text.html.markdown.journal.task.open.bullet", t.journal),
    r("text.html.markdown.journal.task.open.marker", t.journal),
    r("text.html.markdown.journal.task.open.keyword", null, { fontStyle: "italic" }),
    r("text.html.markdown.journal.task.open.text", null, {}),
    r("text.html.markdown.journal.task.completed.keyword", null, { fontStyle: "italic" }),
    r("text.html.markdown.journal.task.completed.marker", t.completed),
    r("text.html.markdown.journal.task.completed.text", t.completed),
    r("text.html.markdown.journal.task.completed.bullet", t.journal),
    r("text.html.markdown.journal.memo.keyword", null, { fontStyle: "italic" }),
    r("text.html.markdown.journal.memo.bullet", t.journal),
    r("text.html.markdown.journal.scope", t.journal),
    r("text.html.markdown.journal.link.keyword", null, { fontStyle: "italic" }),
    r("text.html.markdown.journal.link.bullet", t.journal),
    r("ref.matchtext", p.fg1),
    r("token.info-token", p.info),
    r("token.warn-token", p.warning),
    r("token.error-token", p.error),
    r("token.debug-token", t.decorator),
  ];
}

// ---------------------------------------------------------------------------

function buildTheme(p, borderless) {
  return {
    name: borderless ? `${p.name} borderless` : p.name,
    type: "dark",
    colors: uiColors(p, borderless),
    semanticHighlighting: true,
    semanticTokenColors: semanticTokenColors(p),
    tokenColors: tokenColors(p),
  };
}

export const palettes = [
  ember,
  graphite,
  violet,
  pink,
  blush,
  fuchsia,
  abyss,
  solar,
  ocean,
  primer,
  geist,
];
export { buildTheme, syntax };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const p of palettes) {
    for (const borderless of [false, true]) {
      const file = join(
        out,
        `overload-${p.slug}${borderless ? "-borderless" : ""}-color-theme.json`,
      );
      writeFileSync(file, JSON.stringify(buildTheme(p, borderless), null, "\t") + "\n");
      console.log("wrote", file);
    }
  }
}
