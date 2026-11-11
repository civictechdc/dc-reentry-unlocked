import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

/**
 * Drift check for the hand-written token surface — the part regeneration
 * cannot cover. Narrow scope, fail closed:
 *
 * 1. typography/elevation custom properties in `apps/web/src/app.css`
 *    against the DESIGN.md source tree (the exporter deliberately omits
 *    these families), plus a source-side coverage inventory so an unmapped
 *    source leaf cannot silently lose its enforcement;
 * 2. non-CSS color bridges against resolved DESIGN.md colors: the
 *    `app.html` document theme-color meta, and every map paint / bitmap
 *    color constant in `apps/web/src/lib/map/map-colors.ts` (the bridge
 *    module the map style JSON and the typed-array bubble bitmap consume),
 *    matched as canonical declaration statements after comment stripping
 *    and string/template masking;
 * 3. safety rails: references must resolve without cycles, the YAML must
 *    parse as data, and hand-written CSS must never declare a property
 *    under a generated (`--color-*`, `--spacing-*`, `--rounded-*`) name.
 *
 * The YAML tree is parsed as DATA only with the maintained `yaml` parser
 * shipped inside the exactly-pinned `@google/design.md` dependency (no
 * custom constructors, no code execution, no regex-only parsing, no
 * network). Only `design:export` writes files; this check is read-only.
 */

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const WEB_ROOT = join(REPO_ROOT, "apps/web");

/**
 * Hand-written custom properties app.css is expected to carry, mapped to
 * their DESIGN.md source paths. When app.css gains further hand-written
 * typography/elevation properties, they MUST join this table — the
 * unknown-property rule below fails the moment an unmapped one appears.
 */
const HAND_WRITTEN_MAPPINGS = [
  { property: "--font-family-body", tokenPath: "typography.body.fontFamily", kind: "text" },
  { property: "--font-size-base", tokenPath: "typography.body.fontSize", kind: "dimension" },
  // unitless line-height: a plain text literal, not a dimension
  { property: "--line-height-body", tokenPath: "typography.body.lineHeight", kind: "text" },
  { property: "--font-size-small", tokenPath: "typography.small.fontSize", kind: "dimension" },
  { property: "--font-size-heading", tokenPath: "typography.heading.fontSize", kind: "dimension" },
  { property: "--shadow", tokenPath: "components.elevation-raised.shadow", kind: "text" },
];

/** Prefixes that mark a custom-property name as hand-written (checked families). */
const HAND_WRITTEN_FAMILIES = ["--font-", "--line-height-", "--shadow"];

/** Prefixes owned by the exporter; hand-written declarations here always fail. */
const GENERATED_FAMILIES = ["--color-", "--spacing-", "--rounded-"];

/**
 * Source-side coverage: source leaves under these family roots must either
 * be consumed by exactly one checked target (mapping or bridge) or appear
 * in SOURCE_EXCLUSIONS with a reason. Changing an unconsumed leaf still
 * cannot pass silently — it passes only because the exclusion documents
 * the deferral.
 */
const SOURCE_FAMILY_ROOTS = ["typography", "components"];

/**
 * Source leaves deliberately NOT consumed by any checked target. Each
 * entry must cover at least one live leaf; an entry covering a consumed
 * leaf fails. Weights, secondary line-heights, and secondary font stacks
 * stay component literals (inventoried in DESIGN.md prose) with no CSS
 * custom-property target.
 */
export const SOURCE_EXCLUSIONS = [
  {
    prefix: "typography.body.fontWeight",
    reason:
      "weights stay component literals (inventoried in DESIGN.md prose) with no CSS custom property target",
  },
  ...["small", "heading"].flatMap((role) =>
    ["fontFamily", "fontWeight", "lineHeight"].map((leaf) => ({
      prefix: `typography.${role}.${leaf}`,
      reason: `${role}-role ${leaf} stays a component literal (inventoried in DESIGN.md prose); only the role's fontSize is consumed`,
    })),
  ),
  ...[
    "button-primary",
    "button-primary-hover",
    "button-quiet",
    "button-close",
    "toggle-selected",
    "chip-active",
    "card-unit",
    "badge-confirmed",
    "badge-unverified",
    "banner-disclosure",
    "screen-page",
    "map-pin-available",
    "map-pin-highlighted",
    "map-pin-ring",
    "map-pin-label",
  ].map((entry) => ({
    prefix: `components.${entry}.`,
    reason:
      "component recipes emit no CSS custom properties; their color pairings are enforced by the blocking contrast suite",
  })),
];

/**
 * Bridges: hand-written occurrences of design colors outside CSS. The
 * document theme-color bridge matches the meta element as a whole tag
 * (attribute order and quote style agnostic) after HTML comments are
 * stripped, and must find exactly one active, single-content meta. The
 * map-colors bridges match each named constant's CANONICAL DECLARATION
 * STATEMENT in the map bridge module: after TypeScript comments are
 * stripped and string/template interiors are masked, exactly one line may
 * have the shape `export const NAME = "<string>";` — no type annotation,
 * no expression parts, no trailing tokens — and the recorded string
 * interior of that line is the literal compared against the resolved
 * DESIGN.md color. Commented-out decoys are stripped away, decoys inside
 * string content are masked into placeholders and can never read as code,
 * and any deviation from the canonical shape yields zero matches, which
 * fails closed: the module's declarations must stay canonical.
 */
const MAP_COLORS_FILE = join(WEB_ROOT, "src", "lib", "map", "map-colors.ts");

/** One map-colors bridge row per named constant, pairing it with its token. */
const MAP_COLOR_CONSTANTS = [
  { constant: "PIN_EXACT", tokenPath: "colors.pin-exact" },
  { constant: "PIN_HIGHLIGHT", tokenPath: "colors.pin-highlight" },
  { constant: "PIN_RING", tokenPath: "colors.pin-ring" },
  { constant: "PIN_HIGHLIGHT_RING", tokenPath: "colors.pin-highlight-ring" },
  { constant: "PIN_LABEL_INK", tokenPath: "colors.pin-label-ink" },
  { constant: "PIN_LABEL_BG", tokenPath: "colors.pin-label-bg" },
  { constant: "PIN_LABEL_BORDER", tokenPath: "colors.pin-label-border" },
];

const BRIDGES = [
  {
    id: "document theme-color",
    file: join(WEB_ROOT, "src", "app.html"),
    tokenPath: "colors.accent",
    kind: "html-meta-theme-color",
  },
  ...MAP_COLOR_CONSTANTS.map(({ constant, tokenPath }) => ({
    id: `map color ${constant}`,
    file: MAP_COLORS_FILE,
    tokenPath,
    kind: "typescript-constant",
    commentSyntax: "typescript",
    constant,
  })),
];

/**
 * Strips `//` line comments and `/*` block comments from TypeScript source
 * while tracking quoted strings: quoted content must survive verbatim, and
 * a comment marker inside a string (an URL's `//`) must never start a
 * comment. Escaped closers stay inside their string. Throws on an
 * unterminated block comment AND on an unterminated string/template
 * literal at EOF — leaving the scan in a dangling-string state would let a
 * later pass misread where strings end, and both outcomes must fail closed
 * instead. This is NOT a TypeScript lexer: regex literals are not parsed,
 * so a quote character inside a regex literal opens string mode and can
 * only end in that unterminated-string throw or (after the string-masking
 * pass below) a canonical-declaration mismatch; a quote-free regex is
 * inert ordinary characters. Both failure modes are the intended behavior
 * for the bridge module this serves (canonical constant declarations plus
 * a quote-free helper regex).
 */
export function stripTypeScriptComments(source) {
  let out = "";
  let inString = null;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (inString !== null) {
      if (ch === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) throw new Error("unterminated block comment");
      i = end + 2;
      out += " ";
      continue;
    }
    out += ch;
    i += 1;
  }
  if (inString !== null) throw new Error("unterminated quoted string or template literal");
  return out;
}

const MASK = "\u0000";

/**
 * Masks string and template-literal INTERIORS of comment-stripped
 * TypeScript source: every interior is replaced by a `\u0000{index}\u0000`
 * placeholder and recorded, so code-position grammar matching can bind a
 * match to the exact source bytes it stands for while string content can
 * never read as code — a decoy declaration inside a single-quoted string
 * or a (possibly multi-line) template literal is unmatchable. Escaped
 * closers stay inside their string; empty strings record an empty
 * interior. Throws on an unterminated string/template at EOF. Like the
 * comment stripper, this is not a TypeScript lexer: template interpolation
 * and regex literals are not modeled, so a quote inside either shifts
 * string state and can only end in this throw or a canonical-declaration
 * grammar mismatch — both fail closed.
 */
export function maskTypeScriptStrings(source) {
  const interiors = [];
  let out = "";
  let inString = null;
  let interior = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (inString !== null) {
      if (ch === "\\") {
        interior += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === inString) {
        interiors.push(interior);
        out += `${MASK}${interiors.length - 1}${MASK}`;
        inString = null;
        interior = "";
        i += 1;
        continue;
      }
      interior += ch;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      interior = "";
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  if (inString !== null) throw new Error("unterminated quoted string or template literal");
  return { text: out, interiors };
}

/**
 * The canonical-declaration grammar a TypeScript constant bridge accepts:
 * exactly one line of the masked source of the shape
 * `export const NAME = «placeholder»;` — no type annotation, no
 * expression parts, no trailing tokens. Deviations yield zero matches and
 * are reported, which is the correct failure: the module's declarations
 * must stay canonical. The matched line's recorded string interior IS the
 * checked literal, so the value compared against DESIGN.md is the exact
 * source bytes the constant initializes from — an initializer expression
 * (a chained method call such as replace, or concatenation) cannot
 * satisfy the end-of-line anchor, and a string decoy elsewhere cannot
 * impersonate the statement because interiors are masked.
 */
export function extractMaskedConstantLiteral(masked, constantName) {
  const statement = new RegExp(
    `^[ \t]*export const ${constantName} = ${MASK}(\\d+)${MASK};[ \t]*$`,
  );
  const hits = [];
  for (const line of masked.text.split("\n")) {
    const match = statement.exec(line);
    if (!match) continue;
    const interior = masked.interiors[Number(match[1])];
    if (interior === undefined) {
      return { error: `placeholder ${match[1]} has no recorded string interior` };
    }
    hits.push(interior);
  }
  if (hits.length === 0) {
    return {
      error: `expected canonical declaration of ${constantName} not found — the statement must be exactly 'export const ${constantName} = "<hex>";' with no annotation, expression, or trailing tokens`,
    };
  }
  if (hits.length > 1) {
    return {
      error: `found ${hits.length} canonical declarations of ${constantName} — exactly one is expected`,
    };
  }
  return { value: hits[0] };
}

/**
 * Tokenizes a `<meta ...>` tag's attributes: whitespace-separated name
 * tokens with an optional `= value`, values quoted (single/double) or
 * unquoted, quote-aware so a value containing `=` or spaces never splits.
 * Returns { attrs, malformed } — a tokenization that cannot proceed (e.g.
 * an unterminated quoted value) is malformed rather than guessed.
 */
function tokenizeMetaAttributes(tag) {
  const inner = tag.slice(tag.toLowerCase().indexOf("<meta") + 5, tag.lastIndexOf(">"));
  const attrs = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && /\s/.test(inner[i])) i += 1;
    if (i >= inner.length) break;
    let attrName = "";
    while (i < inner.length && /[^\s=/>]/.test(inner[i])) {
      attrName += inner[i];
      i += 1;
    }
    let value = null;
    let valueQuote = null;
    while (i < inner.length && /\s/.test(inner[i])) i += 1;
    if (inner[i] === "=") {
      i += 1;
      while (i < inner.length && /\s/.test(inner[i])) i += 1;
      const quote = inner[i];
      if (quote === '"' || quote === "'") {
        const end = inner.indexOf(quote, i + 1);
        if (end === -1) {
          return { malformed: `unterminated quoted attribute value in ${tag}` };
        }
        value = inner.slice(i + 1, end);
        valueQuote = quote;
        i = end + 1;
      } else {
        let raw = "";
        while (i < inner.length && /[^\s]/.test(inner[i])) {
          raw += inner[i];
          i += 1;
        }
        value = raw;
      }
    }
    if (attrName === "" && value === null) {
      // a stray character (e.g. "/") — skip it
      i += 1;
      continue;
    }
    attrs.push({ name: attrName.toLowerCase(), value, valueQuote });
  }
  return { attrs };
}

/**
 * Scans active (comment-stripped) HTML for theme-color metas. Each
 * `<meta>` tag is tokenized properly — decoy attribute NAMES
 * (`data-name`, `data-content`), attributes hidden inside quoted values,
 * duplicated `name`/`content` attributes, and malformed tokenization all
 * fail instead of satisfying the bridge. Returns the failures and the
 * single matching value (null when absent).
 */
function extractThemeColorTags(activeHtml) {
  const failures = [];
  const themeColorValues = [];
  for (const match of activeHtml.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const tokenized = tokenizeMetaAttributes(tag);
    if (tokenized.malformed) {
      failures.push(`malformed meta attributes — ${tokenized.malformed}`);
      continue;
    }
    const names = tokenized.attrs.filter((a) => a.name === "name");
    // metas that declare no name attribute at all (charset, viewport, ...)
    // are not theme-color candidates; a data-name decoy is NOT a name
    // attribute, so it can never satisfy the bridge either
    if (names.length === 0) continue;
    const contents = tokenized.attrs.filter((a) => a.name === "content");
    if (names.length !== 1 || contents.length !== 1) {
      failures.push(
        `meta tag carries ${names.length} name and ${contents.length} content attributes — exactly one of each is required: ${tag}`,
      );
      continue;
    }
    if (names[0].value === null || names[0].value.trim().toLowerCase() !== "theme-color") continue;
    themeColorValues.push(contents[0].value ?? "");
  }
  if (themeColorValues.length === 0) {
    failures.push("expected theme-color meta not found");
  } else if (themeColorValues.length > 1) {
    failures.push(
      `found ${themeColorValues.length} active theme-color metas — exactly one is expected`,
    );
  }
  return { failures, themeColorValue: themeColorValues.length === 1 ? themeColorValues[0] : null };
}

/**
 * Loads the `yaml` parser from the pinned dependency's own closure:
 * resolution is anchored inside the pinned package so no new dependency is
 * introduced; a deliberate upstream bump re-verifies this anchor.
 */
async function loadYamlParser() {
  const entry = realpathSync(join(WEB_ROOT, "node_modules/@google/design.md/dist/index.js"));
  const packageRoot = dirname(dirname(entry));
  const requireFromPackage = createRequire(join(packageRoot, "package.json"));
  return import(pathToFileURL(requireFromPackage.resolve("yaml")).href);
}

/** Splits a DESIGN.md document into front-matter YAML text and the prose body. */
export function extractFrontMatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown);
  if (!match) {
    throw new Error("no YAML front matter found (expected a leading --- fenced block)");
  }
  return match[1];
}

/** Resolves a dotted token path to its raw tree value (undefined if absent). */
export function tokenAtPath(tokens, tokenPath) {
  return tokenPath
    .split(".")
    .reduce(
      (tree, segment) => (tree === null || typeof tree !== "object" ? undefined : tree[segment]),
      tokens,
    );
}

/**
 * Resolves a dotted token path to its COMPARABLE literal — `{colors.x}`
 * references are resolved so comparisons measure values, never reference
 * strings. Returns the error message instead of a value when the path or
 * its reference chain is broken.
 */
export function resolveTokenAt(tokens, tokenPath) {
  const raw = tokenAtPath(tokens, tokenPath);
  if (raw === undefined) return { error: `source path ${tokenPath} does not exist in DESIGN.md` };
  try {
    return { value: resolveReference(tokens, raw, new Set([tokenPath])) };
  } catch (error) {
    return { error: `source path ${tokenPath} unreadable — ${error.message}` };
  }
}

/**
 * Resolves `{path.to.token}` references against the token tree. Errors
 * name the problem: missing path, cycle, or a reference that does not
 * bottom out in a literal. Plain literals pass through.
 */
export function resolveReference(tokens, value, visited = new Set()) {
  if (typeof value !== "string") return value;
  const match = /^\{([^{}]+)\}$/.exec(value.trim());
  if (!match) return value;
  const path = match[1];
  if (visited.has(path)) {
    throw new Error(`circular reference detected: ${[...visited, path].join(" -> ")}`);
  }
  visited.add(path);
  let current = tokens;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object" || !(segment in current)) {
      throw new Error(`reference {${path}} does not resolve: missing path segment "${segment}"`);
    }
    current = current[segment];
  }
  return resolveReference(tokens, current, visited);
}

/**
 * Walks every value in the tree and reports reference failures (missing
 * paths and cycles) so a broken source fails closed even where no mapping
 * consumes the broken value yet.
 */
export function validateReferences(tokens) {
  const failures = [];
  const visit = (path, value) => {
    if (value === null || typeof value !== "object") {
      try {
        resolveReference(tokens, value, new Set([path]));
      } catch (error) {
        failures.push(`${path}: ${error.message}`);
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(`${path}.${key}`, child);
  };
  for (const [key, child] of Object.entries(tokens)) visit(key, child);
  return failures;
}

/**
 * The custom-property names the exporter generates: one per colors /
 * spacing / rounded leaf, dots flattened to hyphens. Typography,
 * elevation, and component entries generate nothing.
 */
export function generatedNames(tokens) {
  const names = [];
  const collect = (prefix, subtree) => {
    for (const [key, value] of Object.entries(subtree ?? {})) {
      if (value !== null && typeof value === "object") collect(`${prefix}${key}-`, value);
      else names.push(`--${prefix}${key}`);
    }
  };
  collect("color-", tokens.colors);
  collect("spacing-", tokens.spacing);
  collect("rounded-", tokens.rounded);
  return new Set(names);
}

/**
 * Extracts `--name: value` custom-property declarations from CSS text.
 *
 * Hardening contract (fail closed):
 * - String context is tracked across the ENTIRE scan (single/double
 *   quotes, backslash-escaped closers): a declaration capture may only
 *   start outside a quoted string, and quoted content anywhere — an
 *   ordinary declaration's quoted value included — never contributes a
 *   `--name:` capture. An unterminated string or comment is a parse
 *   failure, not silent truncation.
 * - ANY backslash outside a quoted string is unsupported syntax and fails
 *   the whole parse. Hand-written app.css grammar (custom properties, font
 *   stacks, shadows, dimensions) uses no backslashes and the generated
 *   output is hex and dimensions only, so CSS escape sequences — which
 *   could legally spell token names (`\2d\2d color-accent`) — have no
 *   legitimate use here; there is no decoding path to bypass.
 * - A trailing semicolon is optional at block end; ALL declarations per
 *   name are collected (last-wins collapsing would let a masked value
 *   hide).
 * - A `{` inside a value is reported as unsupported — a value the browser
 *   would drop must not satisfy parity.
 *
 * @param {string} cssText
 * @returns {{
 *   declared: Map<string, string[]>,
 *   unsupportedValues: Array<{ name: string, value: string }>,
 * }} all declarations per name, plus values the checker refuses to
 * interpret (callers report them as failures). Throws on unterminated
 * strings/comments and on any backslash outside a quoted string.
 */
export function parseDeclarations(cssText) {
  const declared = new Map();
  const unsupportedValues = [];
  const atDeclarationBoundary = (idx) => idx === 0 || /[\s{;}]/.test(cssText[idx - 1] ?? "");
  let inString = null;
  // true for exactly the position immediately following a skipped comment —
  // a comment satisfies the declaration boundary like whitespace would
  let afterComment = false;
  let i = 0;
  while (i < cssText.length) {
    const ch = cssText[i];
    if (inString) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      i += 1;
      afterComment = false;
      continue;
    }
    if (ch === "\\") {
      throw new Error(`unsupported syntax: backslash outside a quoted string at offset ${i}`);
    }
    if (ch === "/" && cssText[i + 1] === "*") {
      const end = cssText.indexOf("*/", i + 2);
      if (end === -1) throw new Error("unterminated CSS comment");
      i = end + 2;
      afterComment = true;
      continue;
    }
    const atBoundary = i === 0 || afterComment || atDeclarationBoundary(i);
    afterComment = false;
    if (!cssText.startsWith("--", i) || !atBoundary) {
      i += 1;
      continue;
    }
    // Capture the plain name up to ":" — no escapes exist here (they fail
    // the parse above); a quote, brace, or terminator before the colon
    // aborts (not a declaration); comments are skipped in place.
    let j = i + 2;
    let name = "--";
    let aborted = false;
    while (j < cssText.length) {
      const c = cssText[j];
      if (c === ":") break;
      if (c === "/" && cssText[j + 1] === "*") {
        const end = cssText.indexOf("*/", j + 2);
        if (end === -1) throw new Error("unterminated CSS comment");
        j = end + 2;
        continue;
      }
      if (c === "\\") {
        throw new Error(`unsupported syntax: backslash outside a quoted string at offset ${j}`);
      }
      if ("\"'{};".includes(c)) {
        aborted = true;
        break;
      }
      name += c;
      j += 1;
    }
    if (aborted || cssText[j] !== ":") {
      // resume AT the aborting character so a mid-name quote still opens a
      // tracked string in the main loop
      i = j;
      continue;
    }
    // Capture the value up to ";" or the block-closing "}"; quoted spans
    // are consumed as string units (their content never terminates the
    // value or lands in it); a "{" inside a value is flagged unsupported.
    let k = j + 1;
    let value = "";
    let unsupported = false;
    while (k < cssText.length) {
      const c = cssText[k];
      if (inString !== null) {
        if (c === "\\") {
          k += 2;
          continue;
        }
        if (c === inString) inString = null;
        k += 1;
        continue;
      }
      if (c === ";" || c === "}") break;
      if (c === "/" && cssText[k + 1] === "*") {
        const end = cssText.indexOf("*/", k + 2);
        if (end === -1) throw new Error("unterminated CSS comment");
        k = end + 2;
        continue;
      }
      if (c === "{") {
        unsupported = true;
        break;
      }
      if (c === "\\") {
        throw new Error(`unsupported syntax: backslash outside a quoted string at offset ${k}`);
      }
      if (c === '"' || c === "'") {
        inString = c;
        k += 1;
        continue;
      }
      value += c;
      k += 1;
    }
    if (inString !== null) throw new Error("unterminated quoted string");
    if (unsupported) {
      unsupportedValues.push({ name: name.trim(), value: value.trim() });
      i = k + 1;
      continue;
    }
    const cleanName = name.trim();
    const values = declared.get(cleanName) ?? [];
    values.push(value.trim());
    declared.set(cleanName, values);
    i = k + 1;
  }
  if (inString !== null) throw new Error("unterminated quoted string");
  return { declared, unsupportedValues };
}

/**
 * Declared custom properties per name. Throws on unterminated
 * strings/comments and on any backslash outside a quoted string; use
 * {@link parseDeclarations} when the unsupported-value reports matter.
 *
 * @param {string} cssText
 * @returns {Map<string, string[]>}
 */
export function parseCustomProperties(cssText) {
  return parseDeclarations(cssText).declared;
}

/** Normalizes a literal for comparison: whitespace collapsed, hex lowercased. */
export function normalizeValue(value) {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A dimension literal the checker is willing to compare: digits with at
 * most one decimal point and one supported unit. Anything else (multi-dot
 * values like `1.0.9rem`, missing units, trailing junk) is unsupported —
 * `parseFloat` on such input silently compares a truncated prefix.
 *
 * Case-insensitive units (`1REM`) and leading-dot decimals (`.5rem`) are
 * DELIBERATELY accepted: normalizeValue lowercases before matching and
 * both sides of the parity compare normalize identically, so these
 * valid-CSS equivalence classes are safe.
 */
const DIMENSION_PATTERN = /^[0-9]*\.?[0-9]+(px|rem|em)$/;

export function isValidDimensionLiteral(value) {
  return DIMENSION_PATTERN.test(normalizeValue(value));
}

/** True when both validated values express the same dimension. */
function dimensionsEqual(a, b) {
  const parse = (v) => /^([0-9]*\.?[0-9]+)(px|rem|em)$/.exec(normalizeValue(v));
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return false;
  return Number.parseFloat(left[1]) === Number.parseFloat(right[1]) && left[2] === right[2];
}

/**
 * Compares one hand-written mapping row against the DESIGN.md tree.
 * Returns a failure message or null. Unsupported value shapes fail closed.
 */
export function checkMapping(tokens, mapping, cssValue) {
  const resolved = resolveTokenAt(tokens, mapping.tokenPath);
  if (resolved.error) {
    return `${mapping.property}: ${resolved.error}`;
  }
  const tokenValue = resolved.value;
  if (mapping.kind === "dimension") {
    const unsupported = [cssValue, tokenValue].find((v) => !isValidDimensionLiteral(v));
    if (unsupported !== undefined) {
      return `${mapping.property}: unsupported dimension value "${normalizeValue(unsupported)}" — expected digits with at most one decimal point and a px/rem/em unit`;
    }
    if (!dimensionsEqual(cssValue, tokenValue)) {
      return `${mapping.property}: app.css has "${normalizeValue(cssValue)}" but DESIGN.md ${mapping.tokenPath} resolves to "${normalizeValue(tokenValue)}"`;
    }
    return null;
  }
  if (mapping.kind !== "text") {
    return `${mapping.property}: unsupported mapping kind "${mapping.kind}"`;
  }
  if (normalizeValue(cssValue) !== normalizeValue(tokenValue)) {
    return `${mapping.property}: app.css has "${normalizeValue(cssValue)}" but DESIGN.md ${mapping.tokenPath} is "${normalizeValue(tokenValue)}"`;
  }
  return null;
}

/**
 * Full hand-written CSS check: unknown hand-written properties, duplicate
 * declarations of checked names, missing mapping rows, value drift, and
 * hand-written declarations under generated names. `declared` maps each
 * property name to EVERY declaration found.
 */
export function checkHandWrittenCss(cssText, tokens, mappings = HAND_WRITTEN_MAPPINGS) {
  let parsed;
  try {
    parsed = parseDeclarations(cssText);
  } catch (error) {
    return [`app.css declarations unparseable: ${error.message}`];
  }
  const failures = [];
  const declared = parsed.declared;
  for (const { name, value } of parsed.unsupportedValues) {
    failures.push(
      `${name}: unsupported custom-property value "${value}" — a value with braces would be dropped by the browser`,
    );
  }
  const isHandWritten = (name) => HAND_WRITTEN_FAMILIES.some((f) => name.startsWith(f));
  const isGenerated = (name) => GENERATED_FAMILIES.some((f) => name.startsWith(f));

  for (const [name, values] of declared) {
    if (isGenerated(name)) {
      failures.push(
        `${name}: hand-written declaration under an exporter-owned generated name — remove it or move the value into DESIGN.md`,
      );
    } else if (isHandWritten(name) && !mappings.some((m) => m.property === name)) {
      failures.push(
        `${name}: hand-written property has no DESIGN.md mapping — add it to the mapping table`,
      );
    } else if (mappings.some((m) => m.property === name) && values.length > 1) {
      failures.push(
        `${name}: declared ${values.length} times — a checked hand-written property must appear exactly once (last-wins masking is not verifiable)`,
      );
    }
  }
  const generated = generatedNames(tokens);
  for (const name of generated) {
    if (declared.has(name)) {
      failures.push(`${name}: generated name redeclared by hand — the exporter owns this property`);
    }
  }
  for (const mapping of mappings) {
    const values = declared.get(mapping.property);
    if (!values || values.length === 0) {
      failures.push(
        `${mapping.property}: mapping table expects it in app.css but it is not declared there`,
      );
      continue;
    }
    const failure = checkMapping(tokens, mapping, values[0]);
    if (failure) failures.push(failure);
  }
  return failures;
}

/**
 * Bridge check: every bridge's hand-written literal must equal its
 * resolved DESIGN.md color. Comments are stripped per the bridge's
 * language and string/template interiors are masked for TypeScript
 * bridges (a commented-out or string-content decoy must not satisfy the
 * check); a TypeScript constant bridge must find EXACTLY ONE canonical
 * declaration statement, a pattern bridge EXACTLY ONE active match (zero
 * or several both fail), and read/strip/mask failures fail closed.
 */
export function checkBridges(readFile, tokens, bridges = BRIDGES) {
  const failures = [];
  for (const bridge of bridges) {
    let content;
    try {
      content = readFile(bridge.file);
    } catch (error) {
      failures.push(`${bridge.id}: cannot read ${bridge.file} — ${error.message}`);
      continue;
    }
    let active;
    let masked = null;
    if (bridge.commentSyntax === "typescript") {
      try {
        masked = maskTypeScriptStrings(stripTypeScriptComments(content));
      } catch (error) {
        failures.push(
          `${bridge.id}: ${bridge.file} is not statically scannable — ${error.message}`,
        );
        continue;
      }
    } else {
      // HTML comment stripping, as the document theme-color bridge (and any
      // pattern bridge over an HTML-ish file) has always used. Terminated
      // comments strip in full; an unterminated `<!--` (no `-->` anywhere
      // after it) strips to end-of-string, so commented-out content in an
      // unterminated comment is never scanned as active — the fail-closed
      // direction for this checker. Every `<!--` opens a match that runs to
      // `-->` or EOF, so the stripped output cannot contain a residual `<!--`.
      active = content.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
    }
    let literal;
    if (bridge.kind === "html-meta-theme-color") {
      const { failures: metaFailures, themeColorValue } = extractThemeColorTags(active);
      for (const metaFailure of metaFailures) {
        failures.push(`${bridge.id}: ${metaFailure} (${bridge.file})`);
      }
      if (themeColorValue === null) continue; // the failures above already fail the check
      literal = themeColorValue;
    } else if (bridge.commentSyntax === "typescript") {
      const extracted = extractMaskedConstantLiteral(masked, bridge.constant);
      if (extracted.error) {
        failures.push(`${bridge.id}: ${extracted.error} (${bridge.file})`);
        continue;
      }
      literal = extracted.value;
    } else {
      const globalPattern = new RegExp(
        bridge.pattern.source,
        bridge.pattern.flags.includes("g") ? bridge.pattern.flags : `${bridge.pattern.flags}g`,
      );
      const matches = [...active.matchAll(globalPattern)];
      if (matches.length === 0) {
        failures.push(
          `${bridge.id}: expected literal not found in ${bridge.file} — pattern did not match`,
        );
        continue;
      }
      if (matches.length > 1) {
        failures.push(
          `${bridge.id}: found ${matches.length} active matches in ${bridge.file} — exactly one is expected`,
        );
        continue;
      }
      literal = matches[0][1];
    }
    const resolved = resolveTokenAt(tokens, bridge.tokenPath);
    if (resolved.error) {
      failures.push(`${bridge.id}: ${resolved.error}`);
      continue;
    }
    if (normalizeValue(literal) !== normalizeValue(resolved.value)) {
      failures.push(
        `${bridge.id}: ${bridge.file} has "${normalizeValue(literal)}" but DESIGN.md ${bridge.tokenPath} resolves to "${normalizeValue(resolved.value)}"`,
      );
    }
  }
  return failures;
}

/** Every scalar leaf under the given family roots, as dotted paths. */
export function collectSourceLeaves(tokens, familyRoots = SOURCE_FAMILY_ROOTS) {
  const leaves = [];
  const visit = (path, value) => {
    if (value === null || typeof value !== "object") {
      leaves.push({ path, value });
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(`${path}.${key}`, child);
  };
  for (const root of familyRoots) {
    const subtree = tokenAtPath(tokens, root);
    if (subtree !== null && typeof subtree === "object") visit(root, subtree);
  }
  return leaves;
}

/**
 * A path is covered by an exclusion iff it EQUALS the exclusion prefix or
 * sits under it as an explicit subtree (prefix + "."). Raw startsWith
 * would let `typography.body.fontFamily` silently cover a sibling like
 * `typography.body.fontFamilyExtra`.
 */
const matchesExclusion = (path, exclusion) => {
  const base = exclusion.prefix.replace(/\.$/, "");
  return path === base || path.startsWith(`${base}.`);
};

/**
 * Source-side coverage inventory: under the hand-written family roots,
 * every leaf must be consumed by EXACTLY one checked target (mapping or
 * bridge tokenPath) or covered by exactly one documented exclusion.
 * Duplicate consumption, an exclusion swallowing a consumed leaf, an
 * unconsumed leaf without an exclusion, and a stale exclusion covering no
 * leaf all fail — adding or changing an unmapped source field cannot pass
 * silently.
 */
export function checkSourceCoverage(
  tokens,
  { mappings = HAND_WRITTEN_MAPPINGS, bridges = BRIDGES, exclusions = SOURCE_EXCLUSIONS } = {},
) {
  const failures = [];
  const consumed = [...mappings.map((m) => m.tokenPath), ...bridges.map((b) => b.tokenPath)];
  const consumedSet = new Set(consumed);
  for (const path of consumedSet) {
    const occurrences = consumed.filter((p) => p === path).length;
    if (occurrences > 1) {
      failures.push(
        `${path}: consumed by ${occurrences} checked targets — a source leaf must map to exactly one`,
      );
    }
    if (tokenAtPath(tokens, path) === undefined) {
      failures.push(`${path}: consumed by a checked target but missing from the source tree`);
    }
  }
  const leaves = collectSourceLeaves(tokens);
  const covered = new Set();
  for (const leaf of leaves) {
    const exclusion = exclusions.find((e) => matchesExclusion(leaf.path, e));
    if (consumedSet.has(leaf.path)) {
      if (exclusion) {
        failures.push(
          `${leaf.path}: exclusion "${exclusion.prefix}" covers a leaf that IS consumed (${exclusion.reason}) — remove the exclusion or the target`,
        );
      }
      continue;
    }
    if (!exclusion) {
      failures.push(
        `${leaf.path}: source leaf is consumed by nothing and has no documented exclusion — map it, bridge it, or exclude it with a reason`,
      );
      continue;
    }
    covered.add(exclusion.prefix);
  }
  for (const exclusion of exclusions) {
    if (
      !covered.has(exclusion.prefix) &&
      !leaves.some((leaf) => matchesExclusion(leaf.path, exclusion))
    ) {
      const coversConsumed = [...consumedSet].some(
        (path) => tokenAtPath(tokens, path) !== undefined && matchesExclusion(path, exclusion),
      );
      if (!coversConsumed) {
        failures.push(
          `exclusion "${exclusion.prefix}" covers no source leaf — stale entry (${exclusion.reason})`,
        );
      }
    }
  }
  return failures;
}

/**
 * Runs every check against a repository tree. Returns failure messages;
 * an empty array means the hand-written surface matches the source.
 */
export async function runCheck({
  designPath = join(WEB_ROOT, "DESIGN.md"),
  cssPath = join(WEB_ROOT, "src", "app.css"),
  mappings = HAND_WRITTEN_MAPPINGS,
  bridges = BRIDGES,
  exclusions = SOURCE_EXCLUSIONS,
  readFile = (path) => readFileSync(path, "utf8"),
  yamlParse,
} = {}) {
  const failures = [];
  let tokens;
  try {
    const yaml = yamlParse ?? (await loadYamlParser()).parse;
    tokens = yaml(extractFrontMatter(readFile(designPath)));
    if (tokens === null || typeof tokens !== "object") {
      failures.push("DESIGN.md front matter did not parse to a token tree");
      tokens = {};
    }
  } catch (error) {
    failures.push(`DESIGN.md YAML malformed or unreadable: ${error.message}`);
    return failures;
  }

  failures.push(...validateReferences(tokens));
  failures.push(...checkSourceCoverage(tokens, { mappings, bridges, exclusions }));

  let cssText;
  try {
    cssText = readFile(cssPath);
  } catch (error) {
    failures.push(`cannot read hand-written CSS ${cssPath}: ${error.message}`);
    return failures;
  }
  try {
    parseDeclarations(cssText);
  } catch (error) {
    failures.push(`app.css declarations unparseable: ${error.message}`);
    return failures;
  }
  failures.push(...checkHandWrittenCss(cssText, tokens, mappings));
  failures.push(...checkBridges(readFile, tokens, bridges));
  return failures;
}

/** CLI entry: prints failures and exits nonzero when any check fails. */
export async function main() {
  const failures = await runCheck();
  if (failures.length > 0) {
    console.error(`design drift check FAILED (${failures.length}):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log("hand-written typography/elevation and color bridges match DESIGN.md");
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);

if (invokedDirectly) await main();
