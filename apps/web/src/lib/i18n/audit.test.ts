import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { m } from "#lib/paraglide/messages.js";

/**
 * String-externalization audit: every user-facing string must come from the
 * Paraglide message catalog (adding a language later must require no
 * component rewrites). Templates and code are scanned separately:
 *
 * - template text nodes (data comes from the published schema; message
 *   interpolation is the channel for copy);
 * - user-facing ATTRIBUTE values (aria-label, placeholder, title, alt, …) —
 *   each static SEGMENT of a mixed literal+interpolation value is
 *   evaluated independently;
 * - script string literals (plain English words — multi-word AND
 *   single-word — are copy; identifiers, URLs and technical tokens are
 *   not user-facing).
 */
function messagesCatalog(): Record<string, unknown> {
  return m as unknown as Record<string, unknown>;
}

const componentDirs = ["src/lib/components", "src/routes"];
const componentFiles: string[] = [];
for (const directory of componentDirs) {
  for (const fileName of readdirSync(directory)) {
    if (fileName.endsWith(".svelte")) {
      componentFiles.push(join(directory, fileName));
    }
  }
}

const USER_FACING_ATTRIBUTES = [
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "title",
  "alt",
  "placeholder",
];

function scriptBody(source: string): string {
  const scriptMatch = /<script lang="ts">([\s\S]*?)<\/script>/.exec(source);
  return scriptMatch ? (scriptMatch[1] ?? "") : "";
}

function templateBody(source: string): string {
  const styleStart = source.indexOf("<style>");
  return styleStart >= 0 ? source.slice(0, styleStart) : source;
}

/**
 * Tokenize the template: brace- and quote-aware. Returns the text between
 * tags (expressions stripped) and the quoted attribute VALUES together with
 * the attribute name they belong to, so only user-facing attributes are
 * audited.
 */
function tokenizeTemplate(source: string): {
  textPieces: string[];
  attributeValues: Array<{ name: string; value: string }>;
} {
  const body = templateBody(source)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script lang="ts">[\s\S]*?<\/script>/g, "");
  const textPieces: string[] = [];
  const attributeValues: Array<{ name: string; value: string }> = [];
  let index = 0;
  let outside = "";
  while (index < body.length) {
    const character = body[index]!;
    if (character === "<") {
      index += 1;
      // tag scan: track attribute names and their quoted values
      let quote: string | null = null;
      let braceDepth = 0;
      let attributeName = "";
      let pendingValue = false;
      let valueBuffer = "";
      while (index < body.length) {
        const inside = body[index]!;
        index += 1;
        if (quote) {
          if (inside === quote) {
            quote = null;
            if (USER_FACING_ATTRIBUTES.includes(attributeName)) {
              attributeValues.push({ name: attributeName, value: valueBuffer });
            }
            attributeName = "";
            pendingValue = false;
          } else if (pendingValue && braceDepth === 0) {
            valueBuffer += inside;
          }
          continue;
        }
        if (inside === '"' || inside === "'") {
          quote = inside;
          valueBuffer = "";
          pendingValue = true;
          continue;
        }
        if (inside === "{") {
          braceDepth += 1;
          continue;
        }
        if (inside === "}") {
          braceDepth -= 1;
          continue;
        }
        if (inside === ">" && braceDepth === 0) {
          break;
        }
        if (inside === "=") {
          pendingValue = true;
          valueBuffer = "";
          continue;
        }
        if (inside === " " || inside === "\t" || inside === "\n") {
          if (!pendingValue) {
            attributeName = "";
          }
          continue;
        }
        if (!pendingValue) {
          attributeName += inside;
        }
      }
      continue;
    }
    outside += character;
    index += 1;
  }
  // Text nodes: strip interpolation/expression territory with real nesting;
  // line breaks separate text pieces, so adjacent nodes on one line are
  // evaluated as separate pieces.
  let depth = 0;
  let textOnly = "";
  for (const character of outside) {
    if (character === "{") {
      depth += 1;
      continue;
    }
    if (depth > 0) {
      if (character === "}") depth -= 1;
      continue;
    }
    textOnly += character;
  }
  for (const piece of textOnly.split(/\n{1,}/)) {
    const trimmed = piece.trim();
    if (trimmed.length > 0) textPieces.push(trimmed);
  }
  return { textPieces, attributeValues };
}

/**
 * Plain-English display copy detection: space-separated English words, OR a
 * single capitalized English word that is neither a known technical token
 * nor an existing message name (a bare `"Filters"` literal would be
 * single-word copy).
 */
// keyboard key names join the technical tokens (Escape/Tab literals inside
// keydown handlers are keyboard-mapping code, not user-facing copy)
const TECHNICAL_SINGLE_WORDS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "Escape",
  "Tab",
  "Enter",
]);

const MESSAGE_KEY_WORDS: Set<string> = new Set(
  Object.keys(messagesCatalog()).flatMap((key) => key.split(/[/_]/)),
);

export function isEnglishCopy(value: string): boolean {
  const trimmed = value.trim();
  if (/\b[a-zA-Z]+\s+[a-zA-Z]+\b/.test(trimmed) && trimmed.length >= 6) return true;
  if (/^[A-Z][a-z]+$/.test(trimmed) && trimmed.length >= 3) {
    return !TECHNICAL_SINGLE_WORDS.has(value) && !MESSAGE_KEY_WORDS.has(value);
  }
  return false;
}

describe("UI string externalization audit", () => {
  test("the audit scope covers the component surface", () => {
    expect((m as { app_heading?: unknown }).app_heading).toBeTypeOf("function");
    expect(componentFiles.length).toBeGreaterThan(5);
  });

  test("no user-facing string is hardcoded inside component templates", () => {
    const violations: string[] = [];
    for (const file of componentFiles) {
      const { textPieces } = tokenizeTemplate(readFileSync(file, "utf8"));
      for (const piece of textPieces) {
        if (!/[A-Za-z]{3,}/.test(piece)) continue;
        if (/\{/.test(piece)) continue;
        violations.push(`text: ${file.split("src/").pop()}: ${piece.slice(0, 60)}`);
      }
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });

  test("no hardcoded copy inside user-facing attributes (mixed literal+interpolation split)", () => {
    const violations: string[] = [];
    for (const file of componentFiles) {
      const { attributeValues } = tokenizeTemplate(readFileSync(file, "utf8"));
      for (const { name, value } of attributeValues) {
        // split on interpolation braces: each STATIC segment is independent
        // copy territory (aria-label="Close {name}" flags on "Close")
        for (const segment of value.split(/\{[^}]*\}/)) {
          if (isEnglishCopy(segment)) {
            violations.push(`${name}: ${file.split("src/").pop()}: ${value.slice(0, 60)}`);
            break;
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });

  test("no hardcoded copy strings inside component scripts", () => {
    const violations: string[] = [];
    for (const file of componentFiles) {
      const body = scriptBody(readFileSync(file, "utf8"))
        .replace(/^import\s.*$/gm, "") // module specifiers are not display copy
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // comments are not display copy
      for (const literal of body.matchAll(/"([^"\n]+)"|'([^'\n]+)'|`([^`\n]+)`/g)) {
        const value = literal[1] ?? literal[2] ?? literal[3] ?? "";
        if (isEnglishCopy(value)) {
          violations.push(`${file.split("src/").pop()}: ${value}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });

  test("the copy detector covers single words and technical tokens", () => {
    expect(isEnglishCopy("Filters")).toBe(true);
    expect(isEnglishCopy("GET")).toBe(false);
    expect(isEnglishCopy("/units?ward=1")).toBe(false);
    expect(isEnglishCopy(" Close ")).toBe(true);
    expect(isEnglishCopy("no-such-route")).toBe(false);
  });
});
