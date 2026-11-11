import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  checkBridges,
  checkHandWrittenCss,
  checkSourceCoverage,
  extractFrontMatter,
  generatedNames,
  maskTypeScriptStrings,
  normalizeValue,
  parseCustomProperties,
  parseDeclarations,
  resolveReference,
  runCheck,
  SOURCE_EXCLUSIONS,
  validateReferences,
} from "./check-design-tokens.mjs";

/**
 * The design drift gate must fail closed on every divergence class between
 * the hand-written token surface and the DESIGN.md source: YAML
 * malformation, hand-written value drift, bridge drift, broken references,
 * generated-name overrides, mapping-table gaps, parser-evasion shapes, and
 * source-side coverage holes. Fixtures are real temp trees; the real-tree
 * smoke probe asserts the committed state passes.
 */

const FIXTURE_DESIGN = `---
name: Fixture
colors:
  blue-strong: "#0B5FAB"
  accent: "{colors.blue-strong}"
  pin-exact: "#0b5fab"
  ink: "#1b2a34"
  line-strong: "#84909a"
typography:
  body:
    fontFamily: system-ui
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: system-ui
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
  heading:
    fontFamily: system-ui
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.45
components:
  elevation-raised:
    shadow: "0 1px 3px rgb(27 42 52 / 0.25)"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
---

## Overview

Fixture prose.
`;

const FIXTURE_EXCLUSIONS = SOURCE_EXCLUSIONS.filter(
  (e) => e.prefix.startsWith("typography.") || e.prefix === "components.button-primary.",
);

const GOOD_CSS = `
:root {
  --font-family-body: system-ui;
  --font-size-base: 1rem;
  --line-height-body: 1.45;
  --font-size-small: 0.875rem;
  --font-size-heading: 1.25rem;
  --shadow: 0 1px 3px rgb(27 42 52 / 0.25);
}
`;

const MAPPINGS = [
  { property: "--font-family-body", tokenPath: "typography.body.fontFamily", kind: "text" },
  { property: "--font-size-base", tokenPath: "typography.body.fontSize", kind: "dimension" },
  { property: "--line-height-body", tokenPath: "typography.body.lineHeight", kind: "text" },
  { property: "--font-size-small", tokenPath: "typography.small.fontSize", kind: "dimension" },
  { property: "--font-size-heading", tokenPath: "typography.heading.fontSize", kind: "dimension" },
  { property: "--shadow", tokenPath: "components.elevation-raised.shadow", kind: "text" },
];

/** Two-row table scoped to the tiny parser-evasion CSS fixtures. */
const SMALL_MAPPINGS = MAPPINGS.filter((mapping) =>
  ["--font-size-base", "--shadow"].includes(mapping.property),
);

/** Minimal source tree for pure hand-written-CSS checks across describes. */
const tokensFixture = {
  colors: { accent: "#0b5fab" },
  typography: { body: { fontSize: "1rem" } },
  components: { "elevation-raised": { shadow: "0 1px 3px rgb(27 42 52 / 0.25)" } },
};

const GOOD_BRIDGE = {
  id: "fixture theme-color",
  tokenPath: "colors.accent",
  pattern: /<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{3,8})"/,
};

function makeFixtureTree({ design = FIXTURE_DESIGN, css = GOOD_CSS, themeColor = "#0b5fab" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "design-drift-"));
  writeFileSync(join(root, "DESIGN.md"), design);
  writeFileSync(join(root, "app.css"), css);
  writeFileSync(join(root, "app.html"), `<meta name="theme-color" content="${themeColor}" />\n`);
  return root;
}

const runFixtureCheck = async (root, overrides = {}) =>
  runCheck({
    designPath: join(root, "DESIGN.md"),
    cssPath: join(root, "app.css"),
    mappings: MAPPINGS,
    bridges: [{ ...GOOD_BRIDGE, file: join(root, "app.html") }],
    exclusions: FIXTURE_EXCLUSIONS,
    readFile: (path) => readFileSync(path, "utf8"),
    ...overrides,
  });

describe("reference resolution", () => {
  const tokens = {
    colors: {
      blue: "#0b5fab",
      accent: "{colors.blue}",
      loopA: "{colors.loopB}",
      loopB: "{colors.loopA}",
    },
  };

  test("a semantic alias resolves through to the primitive literal", () => {
    expect(resolveReference(tokens, "{colors.accent}")).toBe("#0b5fab");
  });

  test("a reference to a missing token names the missing segment", () => {
    expect(() => resolveReference(tokens, "{colors.missing}")).toThrow(
      /missing path segment "missing"/,
    );
  });

  test("a circular reference chain fails instead of looping forever", () => {
    expect(() => resolveReference(tokens, "{colors.loopA}")).toThrow(/circular reference/);
  });

  test("the whole-tree walk reports every broken reference with its path", () => {
    const failures = validateReferences({
      colors: { good: "#ffffff", ghost: "{colors.gone}", one: "{colors.two}", two: "{colors.one}" },
    });
    // both members of the cycle report, so the walk names every broken value
    expect(failures).toHaveLength(3);
    expect(failures[0]).toMatch(/colors\.ghost.*missing path segment "gone"/s);
    expect(failures[1]).toMatch(/colors\.one.*circular/s);
    expect(failures[2]).toMatch(/colors\.two.*circular/s);
  });
});

describe("generated name derivation and CSS parsing", () => {
  test("colors, spacing, and rounded leaves flatten to hyphenated custom properties", () => {
    const names = generatedNames({
      colors: { "blue-strong": "#0b5fab", "pin-label-ink": "#1f2937" },
      spacing: { none: "0rem" },
      rounded: { control: "6px" },
      typography: { body: { fontSize: "1rem" } },
      components: { "elevation-raised": { shadow: "0 0 0" } },
    });
    expect([...names].sort()).toEqual([
      "--color-blue-strong",
      "--color-pin-label-ink",
      "--rounded-control",
      "--spacing-none",
    ]);
  });

  test("custom property declarations parse with every declaration kept per name", () => {
    const css = ":root { --font-size-base: 1rem; --shadow: 0 1px 3px rgb(27 42 52 / 0.25); }";
    const props = parseCustomProperties(css);
    expect(props.get("--font-size-base")).toEqual(["1rem"]);
    expect(props.get("--shadow")).toEqual(["0 1px 3px rgb(27 42 52 / 0.25)"]);
  });

  test("a declaration without a trailing semicolon at block end still parses", () => {
    const css = ":root {\n  --font-size-base: 1rem;\n  --shadow: 0 1px 3px rgb(27 42 52 / 0.25)\n}";
    expect(parseCustomProperties(css).get("--shadow")).toEqual(["0 1px 3px rgb(27 42 52 / 0.25)"]);
  });

  test("CSS comments cannot split a property name or hide a declaration", () => {
    const css = ":root { --color-accent/**/: #fff; /* --font-size-base: 9rem */ }";
    const props = parseCustomProperties(css);
    expect(props.get("--color-accent")).toEqual(["#fff"]);
    expect(props.has("--font-size-base")).toBe(false);
  });

  test("duplicate declarations are collected, never collapsed to a last-wins value", () => {
    const css = ":root { --font-size-base: 3rem !important; } .unused { --font-size-base: 1rem; }";
    expect(parseCustomProperties(css).get("--font-size-base")).toEqual(["3rem !important", "1rem"]);
  });

  test("normalization collapses whitespace and lowercases hex", () => {
    expect(normalizeValue("  0 1PX  3px  ")).toBe("0 1px 3px");
    expect(normalizeValue("#0B5FAB")).toBe("#0b5fab");
  });
});

describe("strict no-backslash rule in hand-written CSS", () => {
  test.each([
    ["an escaped generated-name override", ":root { --color-\\61 ccent: #fff; }"],
    ["an escaped checked-name duplicate", ":root { --\\66 ont-size-base: 3rem; }"],
    ["an escaped leading-hyphen name", ":root { \\2d\\2d color-accent: #fff; }"],
    ["an escaped legacy token name", ":root { --lin\\65 -strong: #999999; }"],
  ])("%s fails the parse as unsupported syntax instead of decoding", (_label, css) => {
    const failures = checkHandWrittenCss(css, tokensFixture, MAPPINGS);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/unparseable.*backslash outside a quoted string/s);
  });

  test("parseDeclarations reports the offset of an unsupported backslash", () => {
    expect(() => parseDeclarations(":root { --color-\\61 ccent: #fff; }")).toThrow(
      /backslash outside a quoted string/,
    );
  });

  test("an ordinary declaration's quoted decoy value cannot spawn a false capture", () => {
    // The quoted `--decoy:` text must never become a captured declaration;
    // the real generated-name override after it must stay visible.
    const css = 'h1 { content: " --decoy: "; --color-accent: #0b5fab; }';
    const failures = checkHandWrittenCss(css, tokensFixture, MAPPINGS);
    expect(failures.some((f) => /--color-accent.*exporter-owned/s.test(f))).toBe(true);
    expect(failures.some((f) => /--color-accent.*exporter owns this property/s.test(f))).toBe(true);
  });

  test("an ordinary declaration's quoted decoy value cannot satisfy real drift parity", () => {
    const css =
      ':root { content: " --shadow: 0 1px 3px rgb(27 42 52 / 0.25)"; --shadow: 0 9px 9px rgb(0 0 0 / 0.9); --font-size-base: 1rem; }';
    expect(checkHandWrittenCss(css, tokensFixture, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--shadow.*0 9px 9px/s),
    ]);
  });
});

describe("string-aware comment stripping and value validation", () => {
  test("a quoted slash-star decoy cannot hide a later generated-name override", () => {
    const css = `:root { --decoy: "/*"; --color-accent: #0b5fab; } /* trailing */`;
    const failures = checkHandWrittenCss(css, tokensFixture, MAPPINGS);
    expect(failures.some((f) => /--color-accent.*exporter-owned/s.test(f))).toBe(true);
  });

  test("a quoted decoy cannot mask a drifted hand-written value", () => {
    const css = `:root { --decoy: "/*"; --shadow: 0 9px 9px rgb(0 0 0 / 0.9); /* --shadow: 0 1px 3px rgb(27 42 52 / 0.25) */ --font-size-base: 1rem; }`;
    expect(checkHandWrittenCss(css, tokensFixture, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--shadow.*0 9px 9px/s),
    ]);
  });

  test("a value containing a brace is flagged unsupported instead of satisfying parity", () => {
    const css = `:root { --shadow: 0 {0} 0; --font-size-base: 1rem; }`;
    const failures = checkHandWrittenCss(css, tokensFixture, SMALL_MAPPINGS);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/--shadow.*unsupported custom-property value "0"/s);
    expect(failures[1]).toMatch(/--shadow.*not declared there/s);
  });

  test("an unterminated quoted string fails the whole parse", () => {
    const failures = checkHandWrittenCss(
      ':root { --shadow: "0 1px 3px; --font-size-base: 1rem; }',
      tokensFixture,
      MAPPINGS,
    );
    expect(failures).toEqual([expect.stringMatching(/unparseable.*unterminated quoted string/s)]);
  });

  test("a comment immediately before a declaration still satisfies the boundary", () => {
    // no whitespace between comment and name: :root{/*c*/--color-accent:#fff}
    const css = ":root{/*c*/--color-accent:#fff}";
    const failures = checkHandWrittenCss(css, tokensFixture, MAPPINGS);
    expect(failures.some((f) => /--color-accent.*exporter-owned/s.test(f))).toBe(true);
    expect(failures.some((f) => /--color-accent.*exporter owns this property/s.test(f))).toBe(true);
  });

  test("comment-adjacent hand-written drift is caught without whitespace separation", () => {
    const css = ":root{/*c*/--shadow:0 2px 4px rgb(0 0 0 / 0.4);--font-size-base:1rem}";
    expect(checkHandWrittenCss(css, tokensFixture, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--shadow.*0 2px 4px/s),
    ]);
  });
});

describe("hand-written CSS checks (pure)", () => {
  const tokens = {
    colors: { accent: "#0b5fab" },
    typography: {
      body: { fontFamily: "system-ui", fontSize: "1rem", lineHeight: 1.45 },
      small: { fontSize: "0.875rem" },
      heading: { fontSize: "1.25rem" },
    },
    components: { "elevation-raised": { shadow: "0 1px 3px rgb(27 42 52 / 0.25)" } },
  };

  test("matching hand-written properties produce no failures", () => {
    expect(checkHandWrittenCss(GOOD_CSS, tokens, MAPPINGS)).toEqual([]);
  });

  test("a drifted hand-written value names both sides of the mismatch", () => {
    const css = ":root { --font-size-base: 1.125rem; --shadow: 0 1px 3px rgb(27 42 52 / 0.25); }";
    expect(checkHandWrittenCss(css, tokens, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--font-size-base.*1\.125rem.*1rem/s),
    ]);
  });

  test("an equivalent dimension written differently still matches", () => {
    const css = ":root { --font-size-base: 1.0rem; --shadow: 0 1px 3px rgb(27  42 52 / 0.25); }";
    expect(checkHandWrittenCss(css, tokens, SMALL_MAPPINGS)).toEqual([]);
  });

  test("a final declaration without a semicolon is still drift-checked", () => {
    const css = ":root { --font-size-base: 1rem; --shadow: 0 2px 4px rgb(0 0 0 / 0.4) }";
    expect(checkHandWrittenCss(css, tokens, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--shadow.*0 2px 4px/s),
    ]);
  });

  test("a comment-split generated-name declaration is still caught", () => {
    const css = `${GOOD_CSS}\n:root { --color-accent/**/: #0b5fab; }`;
    const failures = checkHandWrittenCss(css, tokens, MAPPINGS);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/--color-accent.*exporter-owned/s);
    expect(failures[1]).toMatch(/--color-accent.*exporter owns this property/s);
  });

  test("a duplicated checked hand-written property fails instead of masking", () => {
    const css =
      ":root { --font-size-base: 3rem; } .later { --font-size-base: 1rem; --shadow: 0 1px 3px rgb(27 42 52 / 0.25); }";
    const failures = checkHandWrittenCss(css, tokens, SMALL_MAPPINGS);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/--font-size-base.*declared 2 times.*exactly once/s);
    expect(failures[1]).toMatch(/--font-size-base.*3rem.*1rem/s);
  });

  test("a commented decoy cannot satisfy a drifted real declaration", () => {
    const css =
      ":root { --shadow: 0 9px 9px rgb(0 0 0 / 0.9); /* --shadow: 0 1px 3px rgb(27 42 52 / 0.25); */ --font-size-base: 1rem; }";
    expect(checkHandWrittenCss(css, tokens, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--shadow.*0 9px 9px/s),
    ]);
  });

  test("a hand-written property outside the mapping table fails closed", () => {
    const css = `${GOOD_CSS}\n:root { --line-height-tight: 1.2; }`;
    expect(checkHandWrittenCss(css, tokens, MAPPINGS)).toEqual([
      expect.stringMatching(/--line-height-tight.*no DESIGN\.md mapping/s),
    ]);
  });

  test("a mapping row whose property is absent from app.css fails closed", () => {
    const css = ":root { --font-size-base: 1rem; }";
    expect(checkHandWrittenCss(css, tokens, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--shadow.*expects it in app\.css/s),
    ]);
  });

  test("an unsupported dimension value fails instead of comparing garbage", () => {
    const css = ":root { --font-size-base: auto; --shadow: 0 1px 3px rgb(27 42 52 / 0.25); }";
    expect(checkHandWrittenCss(css, tokens, SMALL_MAPPINGS)).toEqual([
      expect.stringMatching(/--font-size-base.*unsupported dimension value "auto"/s),
    ]);
  });

  test("multi-dot, unit-less, and trailing-junk dimensions are unsupported, never silently truncated", () => {
    for (const bad of ["1.0.9rem", "1", "1remX"]) {
      const css = `:root { --font-size-base: ${bad}; --shadow: 0 1px 3px rgb(27 42 52 / 0.25); }`;
      const failures = checkHandWrittenCss(css, tokens, SMALL_MAPPINGS);
      expect(failures, `dimension "${bad}"`).toHaveLength(1);
      expect(failures[0], `dimension "${bad}"`).toMatch(/unsupported dimension value/);
    }
  });

  test("a mapping pointing at a missing source path fails closed", () => {
    const css = ":root { --font-size-base: 1rem; }";
    const broken = [
      { property: "--font-size-base", tokenPath: "typography.ghost.fontSize", kind: "dimension" },
    ];
    expect(checkHandWrittenCss(css, tokens, broken)).toEqual([
      expect.stringMatching(/--font-size-base.*does not exist in DESIGN\.md/s),
    ]);
  });
});

describe("source-side coverage inventory (pure)", () => {
  const tokens = {
    colors: { accent: "#0b5fab" },
    typography: {
      body: { fontFamily: "system-ui", fontSize: "1rem", fontWeight: 400, lineHeight: 1.45 },
    },
    components: { "elevation-raised": { shadow: "0 0 0" } },
  };
  const mappings = [
    { property: "--font-size-base", tokenPath: "typography.body.fontSize", kind: "dimension" },
    { property: "--shadow", tokenPath: "components.elevation-raised.shadow", kind: "text" },
  ];
  const bridges = [{ id: "theme", tokenPath: "colors.accent", pattern: /x/ }];
  const exclusions = [
    { prefix: "typography.body.fontFamily", reason: "deferred body-rule literal" },
    { prefix: "typography.body.fontWeight", reason: "component literal weight" },
    { prefix: "typography.body.lineHeight", reason: "deferred body-rule literal" },
  ];

  test("consumed-and-excluded leaves fully cover the tree with no failures", () => {
    expect(checkSourceCoverage(tokens, { mappings, bridges, exclusions })).toEqual([]);
  });

  test("a new unconsumed source leaf fails until it is mapped or excluded", () => {
    const grown = structuredClone(tokens);
    grown.typography.display = { fontSize: "1.5rem" };
    const failures = checkSourceCoverage(grown, { mappings, bridges, exclusions });
    expect(failures).toEqual([
      expect.stringMatching(/typography\.display\.fontSize.*no documented exclusion/s),
    ]);
  });

  test("dropping a mapping leaves its source leaf unconsumed and fails", () => {
    const failures = checkSourceCoverage(tokens, { mappings: [mappings[1]], bridges, exclusions });
    expect(failures).toEqual([
      expect.stringMatching(/typography\.body\.fontSize.*consumed by nothing/s),
    ]);
  });

  test("an exclusion swallowing a consumed leaf fails", () => {
    const failures = checkSourceCoverage(tokens, {
      mappings,
      bridges,
      exclusions: [...exclusions, { prefix: "typography.body.fontSize", reason: "wrong" }],
    });
    expect(failures).toEqual([
      expect.stringMatching(
        /exclusion "typography\.body\.fontSize" covers a leaf that IS consumed/s,
      ),
    ]);
  });

  test("a stale exclusion covering no leaf fails", () => {
    const failures = checkSourceCoverage(tokens, {
      mappings,
      bridges,
      exclusions: [
        ...exclusions,
        { prefix: "typography.heading.", reason: "nothing has a heading role" },
      ],
    });
    expect(failures).toEqual([
      expect.stringMatching(/exclusion "typography\.heading\." covers no source leaf/s),
    ]);
  });

  test("an exclusion does not leak onto a sibling path it does not name", () => {
    const withSibling = structuredClone(tokens);
    withSibling.typography.body.fontFamilyExtra = "x";
    const failures = checkSourceCoverage(withSibling, { mappings, bridges, exclusions });
    expect(failures).toEqual([
      expect.stringMatching(/typography\.body\.fontFamilyExtra.*no documented exclusion/s),
    ]);
  });

  test("one source leaf consumed by two targets fails", () => {
    const doubled = [
      ...mappings,
      { property: "--shadow-alias", tokenPath: "components.elevation-raised.shadow", kind: "text" },
    ];
    const failures = checkSourceCoverage(tokens, { mappings: doubled, bridges, exclusions });
    expect(failures).toEqual([
      expect.stringMatching(
        /components\.elevation-raised\.shadow.*consumed by 2 checked targets.*exactly one/s,
      ),
    ]);
  });

  test("a consumed path missing from the source tree fails", () => {
    const failures = checkSourceCoverage(tokens, {
      mappings: [
        ...mappings,
        { property: "--ghost", tokenPath: "typography.ghost.x", kind: "text" },
      ],
      bridges,
      exclusions,
    });
    expect(failures).toEqual([
      expect.stringMatching(/typography\.ghost\.x.*missing from the source tree/s),
    ]);
  });
});

describe("bridge decoy hardening (pure)", () => {
  const tokens = { colors: { accent: "#0b5fab" } };
  const readFile = (content) => () => content;

  test("a commented-out decoy cannot satisfy the bridge; the live value is compared", () => {
    const content =
      '<!-- <meta name="theme-color" content="#0b5fab"> -->\n<meta name="theme-color" content="#ffffff" />';
    const failures = checkBridges(readFile(content), tokens, [
      { id: "theme", file: "app.html", tokenPath: "colors.accent", pattern: GOOD_BRIDGE.pattern },
    ]);
    expect(failures).toEqual([expect.stringMatching(/theme.*#ffffff.*#0b5fab/s)]);
  });

  test("duplicate active metas fail instead of silently taking the first", () => {
    const content =
      '<meta name="theme-color" content="#0b5fab" />\n<meta name="theme-color" content="#0b5fab" />';
    const failures = checkBridges(readFile(content), tokens, [
      { id: "theme", file: "app.html", tokenPath: "colors.accent", pattern: GOOD_BRIDGE.pattern },
    ]);
    expect(failures).toEqual([expect.stringMatching(/found 2 active matches.*exactly one/s)]);
  });

  test("a decoy-only file (zero active metas) fails", () => {
    const content = '<!-- <meta name="theme-color" content="#0b5fab"> -->';
    const failures = checkBridges(readFile(content), tokens, [
      { id: "theme", file: "app.html", tokenPath: "colors.accent", pattern: GOOD_BRIDGE.pattern },
    ]);
    expect(failures).toEqual([expect.stringMatching(/pattern did not match/s)]);
  });

  test("a meta inside an unterminated comment is never scanned as active", () => {
    // `<!--` with no closer strips to end-of-string: commented-out content
    // in an unterminated comment must not satisfy the bridge.
    const content = '<!-- <meta name="theme-color" content="#0b5fab">';
    const failures = checkBridges(readFile(content), tokens, [
      { id: "theme", file: "app.html", tokenPath: "colors.accent", pattern: GOOD_BRIDGE.pattern },
    ]);
    expect(failures).toEqual([expect.stringMatching(/pattern did not match/s)]);
  });

  test("a live meta after a terminated comment still satisfies the bridge", () => {
    // The counterpart guard: the EOF arm must not over-consume a comment
    // that has its closer — the live value after it stays active.
    const content =
      '<!-- <meta name="theme-color" content="#ffffff"> -->\n<meta name="theme-color" content="#0b5fab" />';
    const failures = checkBridges(readFile(content), tokens, [
      { id: "theme", file: "app.html", tokenPath: "colors.accent", pattern: GOOD_BRIDGE.pattern },
    ]);
    expect(failures).toEqual([]);
  });
});

describe("map-colors canonical-declaration bridges (pure)", () => {
  const tokens = {
    colors: {
      "pin-exact": "#0b5fab",
      "pin-highlight": "#d9340f",
      "pin-ring": "#ffffff",
      "pin-highlight-ring": "#ffffff",
      "pin-label-ink": "#1f2937",
      "pin-label-bg": "#ffffff",
      "pin-label-border": "#cccccc",
    },
  };
  const readFile = (content) => () => content;
  const mapBridge = (constant, tokenPath = "colors.pin-exact") => ({
    id: `map color ${constant}`,
    file: "map-colors.ts",
    tokenPath,
    kind: "typescript-constant",
    commentSyntax: "typescript",
    constant,
  });
  const declaration = (constant, value) => `export const ${constant} = "${value}";\n`;

  test("a drifted map color constant fails naming both values", () => {
    const failures = checkBridges(readFile(declaration("PIN_EXACT", "#123456")), tokens, [
      mapBridge("PIN_EXACT"),
    ]);
    expect(failures).toEqual([expect.stringMatching(/map color PIN_EXACT.*#123456.*#0b5fab/s)]);
  });

  test("a missing map color constant fails closed instead of passing silently", () => {
    const failures = checkBridges(readFile('export const OTHER = "#0b5fab";\n'), tokens, [
      mapBridge("PIN_EXACT"),
    ]);
    expect(failures).toEqual([
      expect.stringMatching(/canonical declaration of PIN_EXACT not found/s),
    ]);
  });

  test("a duplicated map color constant fails instead of silently taking the first", () => {
    const content = `${declaration("PIN_EXACT", "#0b5fab")}${declaration("PIN_EXACT", "#123456")}`;
    const failures = checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")]);
    expect(failures).toEqual([
      expect.stringMatching(/found 2 canonical declarations.*exactly one/s),
    ]);
  });

  test("an initializer expression breaks the canonical statement and can never borrow its literal", () => {
    // `= "<hex>".replace(...)` used to satisfy a prefix pattern with the
    // literal prefix while the runtime value differed; the statement
    // grammar's end-of-line anchor rejects it outright.
    const content = `export const PIN_EXACT = "#0b5fab".replace("#0b5fab", "#123456");\n`;
    const failures = checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")]);
    expect(failures).toEqual([
      expect.stringMatching(/canonical declaration of PIN_EXACT not found/s),
    ]);
  });

  test("a string decoy cannot satisfy the bridge and a typed drifted declaration cannot hide behind it", () => {
    // The single-quoted decoy used to be the one "active match" while the
    // type annotation kept the real (drifted) declaration from matching;
    // masking turns the decoy into a placeholder and the annotation fails
    // the statement grammar, so nothing matches.
    const content = [
      String.raw`const NOTE = 'export const PIN_EXACT = "#0b5fab";';`,
      String.raw`export const PIN_EXACT: string = "#123456";`,
    ].join("\n");
    const failures = checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")]);
    expect(failures).toEqual([
      expect.stringMatching(/canonical declaration of PIN_EXACT not found/s),
    ]);
  });

  test("a decoy inside a multi-line template literal is masked and never matches", () => {
    const content = [
      "const NOTE = `",
      `export const PIN_EXACT = "#0b5fab";`,
      "`;",
      String.raw`export const PIN_EXACT: string = "#123456";`,
    ].join("\n");
    const failures = checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")]);
    expect(failures).toEqual([
      expect.stringMatching(/canonical declaration of PIN_EXACT not found/s),
    ]);
  });

  test("an unterminated template literal fails the scan instead of dangling at EOF", () => {
    const content = `${declaration("PIN_EXACT", "#0b5fab")}const BROKEN = \``;
    const failures = checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")]);
    expect(failures).toEqual([
      expect.stringMatching(
        /not statically scannable.*unterminated quoted string or template literal/s,
      ),
    ]);
  });

  test("a quote inside a regex literal is not lexed and fails the scan closed", () => {
    // Empirical pin: the stripper does not model regex literals, so the
    // quote inside /['"]/ opens string mode that never closes — the scan
    // reports the file as not statically scannable rather than guessing.
    const content = `const RE = /['"]/.test(x);\n${declaration("PIN_EXACT", "#0b5fab")}`;
    const failures = checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")]);
    expect(failures).toEqual([
      expect.stringMatching(
        /not statically scannable.*unterminated quoted string or template literal/s,
      ),
    ]);
  });

  test("a line-comment decoy constant cannot satisfy the bridge; the live value is compared", () => {
    const content = `// ${declaration("PIN_EXACT", "#dead00")}${declaration("PIN_EXACT", "#0b5fab")}`;
    expect(checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")])).toEqual([]);
  });

  test("a block-comment decoy constant cannot satisfy the bridge either", () => {
    const content = `/* ${declaration("PIN_EXACT", "#dead00")} */\n${declaration("PIN_EXACT", "#0b5fab")}`;
    expect(checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")])).toEqual([]);
  });

  test("a decoy-only file (zero active declarations) fails", () => {
    const content = `// ${declaration("PIN_EXACT", "#0b5fab")}`;
    const failures = checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")]);
    expect(failures).toEqual([
      expect.stringMatching(/canonical declaration of PIN_EXACT not found/s),
    ]);
  });

  test("string content stays masked and inert: a // inside a string cannot eat the real declaration", () => {
    const content = [
      'const SOURCE_NOTE = "see https://example.com/rule for details";',
      declaration("PIN_EXACT", "#0b5fab"),
    ].join("\n");
    expect(checkBridges(readFile(content), tokens, [mapBridge("PIN_EXACT")])).toEqual([]);
  });

  test("an unterminated block comment fails the scan instead of guessing", () => {
    const failures = checkBridges(readFile(`/* ${declaration("PIN_EXACT", "#0b5fab")}`), tokens, [
      mapBridge("PIN_EXACT"),
    ]);
    expect(failures).toEqual([
      expect.stringMatching(/not statically scannable.*unterminated block comment/s),
    ]);
  });
});

describe("string masking binds each placeholder to its exact interior (pure)", () => {
  test("masked text replaces interiors with index placeholders that resolve to the recorded bytes", () => {
    const masked = maskTypeScriptStrings(`a "first" b \`second\` c`);
    expect(masked.text).toBe(`a \u00000\u0000 b \u00001\u0000 c`);
    expect(masked.interiors).toEqual(["first", "second"]);
  });

  test("an empty string records an empty interior and an escaped closer stays inside", () => {
    const masked = maskTypeScriptStrings(String.raw`x "" y "a\"b" z`);
    expect(masked.text).toBe(`x \u00000\u0000 y \u00001\u0000 z`);
    expect(masked.interiors).toEqual(["", String.raw`a\"b`]);
  });

  test("a string left open at EOF throws instead of returning a truncated mask", () => {
    expect(() => maskTypeScriptStrings(`const x = "never closed`)).toThrow(/unterminated/);
  });
});

describe("attribute-order-agnostic theme-color matching (pure)", () => {
  const tokens = { colors: { accent: "#0b5fab" } };
  const readFile = (content) => () => content;
  const metaBridge = {
    id: "theme",
    file: "app.html",
    tokenPath: "colors.accent",
    kind: "html-meta-theme-color",
  };

  test("a swapped-attribute-order meta is matched and its conflicting color fails", () => {
    const content = '<meta content="#ffffff" name="theme-color" />';
    const failures = checkBridges(readFile(content), tokens, [metaBridge]);
    expect(failures).toEqual([expect.stringMatching(/theme.*#ffffff.*#0b5fab/s)]);
  });

  test("single-quoted and unquoted attribute variants match the live meta", () => {
    for (const content of [
      "<meta name='theme-color' content='#0b5fab'>",
      "<meta name=theme-color content=#0b5fab>",
      '<meta content="#0b5fab" name="theme-color">',
    ]) {
      expect(checkBridges(readFile(content), tokens, [metaBridge]), content).toEqual([]);
    }
  });

  test("a meta with two content attributes fails instead of guessing", () => {
    const content = '<meta name="theme-color" content="#0b5fab" content="#ffffff">';
    const failures = checkBridges(readFile(content), tokens, [metaBridge]);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/1 name and 2 content attributes.*exactly one/s);
    expect(failures[1]).toMatch(/expected theme-color meta not found/s);
  });

  test("a data-name decoy attribute is not a name attribute and fails the bridge", () => {
    const content = '<meta data-name="theme-color" content="#0b5fab">';
    const failures = checkBridges(readFile(content), tokens, [metaBridge]);
    expect(failures).toEqual([expect.stringMatching(/expected theme-color meta not found/s)]);
  });

  test("a data-content decoy attribute is not a content attribute and fails the bridge", () => {
    const content = '<meta name="theme-color" data-content="#0b5fab">';
    const failures = checkBridges(readFile(content), tokens, [metaBridge]);
    expect(failures.some((f) => /1 name and 0 content attributes/s.test(f))).toBe(true);
  });

  test("a content-bearing attribute hidden in a quoted title is not a content attribute", () => {
    const content = `<meta name="theme-color" title='content="#0b5fab"'>`;
    const failures = checkBridges(readFile(content), tokens, [metaBridge]);
    expect(failures.some((f) => /1 name and 0 content attributes/s.test(f))).toBe(true);
  });

  test("a truncated tag with an unterminated quoted value fails as malformed", () => {
    // the > inside the value's intended span truncates the tag match,
    // leaving an unterminated quote the tokenizer must refuse, not guess
    const content = '<meta name="theme-color" content="unclosed>';
    const failures = checkBridges(readFile(content), tokens, [metaBridge]);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/malformed meta attributes.*unterminated quoted attribute value/s);
    expect(failures[1]).toMatch(/expected theme-color meta not found/s);
  });

  test("a decoy comment cannot satisfy the meta matcher either", () => {
    const content = '<!-- <meta name="theme-color" content="#0b5fab"> -->';
    const failures = checkBridges(readFile(content), tokens, [metaBridge]);
    expect(failures).toEqual([expect.stringMatching(/expected theme-color meta not found/s)]);
  });

  test("non-theme metas like charset are ignored, not flagged", () => {
    const content = '<meta charset="utf-8" />\n<meta name="theme-color" content="#0b5fab">';
    expect(checkBridges(readFile(content), tokens, [metaBridge])).toEqual([]);
  });
});

describe("drift detection over fixture trees", () => {
  test("the committed real tree passes every check", async () => {
    await expect(runCheck()).resolves.toEqual([]);
  });

  test("a clean fixture tree passes", async () => {
    const root = makeFixtureTree();
    try {
      await expect(runFixtureCheck(root)).resolves.toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("malformed YAML fails closed instead of passing silently", async () => {
    const root = makeFixtureTree({ design: "---\ncolors: [unclosed\n---\n\n## Overview\nx\n" });
    try {
      const failures = await runFixtureCheck(root);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(/YAML malformed/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("front matter without fences is reported as unreadable", async () => {
    const root = makeFixtureTree({ design: "## Overview\nno front matter here\n" });
    try {
      const failures = await runFixtureCheck(root);
      expect(failures[0]).toMatch(/no YAML front matter/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a bridge holding a stale color fails and names both values", async () => {
    const root = makeFixtureTree({ themeColor: "#123456" });
    try {
      const failures = await runFixtureCheck(root);
      expect(failures).toEqual([expect.stringMatching(/fixture theme-color.*#123456.*#0b5fab/s)]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a bridge file that no longer carries the paint fails closed", async () => {
    const root = makeFixtureTree();
    writeFileSync(join(root, "app.html"), "<!doctype html>\n");
    try {
      const failures = await runFixtureCheck(root);
      expect(failures[0]).toMatch(/fixture theme-color.*pattern did not match/s);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a drifted map-colors constant fails through the full check", async () => {
    const root = makeFixtureTree();
    writeFileSync(join(root, "map-colors.ts"), 'export const PIN_EXACT = "#123456";\n');
    try {
      const failures = await runFixtureCheck(root, {
        bridges: [
          { ...GOOD_BRIDGE, file: join(root, "app.html") },
          {
            id: "map color PIN_EXACT",
            file: join(root, "map-colors.ts"),
            tokenPath: "colors.pin-exact",
            kind: "typescript-constant",
            commentSyntax: "typescript",
            constant: "PIN_EXACT",
          },
        ],
      });
      expect(failures).toEqual([expect.stringMatching(/map color PIN_EXACT.*#123456.*#0b5fab/s)]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("hand-written CSS drift fails through the full check", async () => {
    const root = makeFixtureTree({
      css: `:root { --font-family-body: system-ui; --font-size-base: 1rem; --line-height-body: 1.45; --font-size-small: 0.875rem; --font-size-heading: 1.25rem; --shadow: 0 2px 4px rgb(0 0 0 / 0.4); }`,
    });
    try {
      const failures = await runFixtureCheck(root);
      expect(failures).toEqual([expect.stringMatching(/--shadow.*0 2px 4px/s)]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a broken reference in the source fails the whole check", async () => {
    const root = makeFixtureTree({
      design: FIXTURE_DESIGN.replace(
        'accent: "{colors.blue-strong}"',
        'accent: "{colors.nowhere}"',
      ),
    });
    try {
      const failures = await runFixtureCheck(root);
      expect(failures.some((f) => /colors\.accent.*missing path segment "nowhere"/s.test(f))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("front matter parsing splits the YAML block from the prose", () => {
    const yaml = extractFrontMatter(FIXTURE_DESIGN);
    expect(yaml).toContain("name: Fixture");
    expect(yaml).not.toContain("Fixture prose");
  });
});
