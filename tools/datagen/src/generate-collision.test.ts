import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { getCorpus } from "./corpus.ts";
import { DEFAULT_SEED, generateDataset } from "./generate.ts";

const corpus = await getCorpus();

/**
 * Machine-local real-provider exclusion list (never committed; see
 * docs/data-synthetic.md). Looked up first beside the repo, then at the
 * container-level machine-local directory above it.
 */
const EXCLUSION_LIST_URLS = [
  new URL("../../../.agents/local/real-providers.txt", import.meta.url),
  new URL("../../../../../.agents/local/real-providers.txt", import.meta.url),
];

/**
 * Generic suffix words stripped (iteratively, from the tail) before
 * comparing, so "X Housing Services" collides with real "X House" and not
 * just with exact literals. The list is deliberately conservative: more
 * distinctiveness-friendly, never sloppier.
 */
const GENERIC_SUFFIX_WORDS = new Set([
  "housing",
  "services",
  "service",
  "house",
  "homes",
  "home",
  "center",
  "centre",
  "inc",
  "incorporated",
  "llc",
  "corp",
  "corporation",
  "coalition",
  "project",
  "projectteam",
  "group",
  "associates",
  "foundation",
  "trust",
  "ministry",
  "ministries",
  "mission",
  "shelter",
  "alliance",
  "network",
  "collective",
  "collaborative",
  "initiative",
  "circle",
  "commons",
  "stewardship",
  "partnership",
  "residences",
  "residence",
  "program",
  "place",
  "village",
  "association",
]);

/**
 * Normalize with enough edge handling that naming-convention differences
 * cannot hide a collision: runs of single-letter tokens collapse into one
 * merged initialism so "L.L.C." and "LLC" reduce identically, then generic
 * suffix words strip iteratively from the tail ("a housing services" → "a").
 */
function normalizeProviderName(name: string): string {
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token !== "");
  const merged: string[] = [];
  let initialism = "";
  for (const token of tokens) {
    if (token.length === 1) {
      initialism += token;
      continue;
    }
    if (initialism !== "") {
      merged.push(initialism);
      initialism = "";
    }
    merged.push(token);
  }
  if (initialism !== "") {
    merged.push(initialism);
  }
  for (;;) {
    const last = merged[merged.length - 1];
    if (last === undefined || !GENERIC_SUFFIX_WORDS.has(last)) {
      break;
    }
    merged.pop();
  }
  return merged.join(" ");
}

async function loadExclusionNames(): Promise<{ excluded: Set<string>; source: string } | null> {
  for (const url of EXCLUSION_LIST_URLS) {
    try {
      const text = await readFile(fileURLToPath(url), "utf8");
      const excluded = new Set(
        text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith("#"))
          .map((line) => normalizeProviderName(line)),
      );
      return { excluded, source: fileURLToPath(url) };
    } catch (error) {
      // Only a missing file qualifies for a skip; anything else surfaces below.
      const isMissing =
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT";
      if (!isMissing) {
        throw error;
      }
      // try the next candidate location
    }
  }
  return null;
}

const COLLISION_SEEDS = [DEFAULT_SEED, 1, 2, 3, 42] as const;

test("normalized initialisms strip identically regardless of typography", () => {
  // De-identified letters: the same suffix runs strip identically whether
  // written as dotted initials or as one merged token.
  expect(normalizeProviderName("Arqben Moss L.L.C.")).toBe(
    normalizeProviderName("Arqben Moss LLC"),
  );
  expect(normalizeProviderName("Arqben Moss L.L.C.")).not.toBe("");
  // Initialism runs inside the name survive as one merged token.
  expect(normalizeProviderName("S.H.R. Community Housing")).toBe(
    normalizeProviderName("SHR Community Housing"),
  );
});

test("no fictional provider name collides with the machine-local real-provider exclusion list even after generic suffix stripping", async (ctx) => {
  const list = await loadExclusionNames();
  if (list === null || list.excluded.size === 0) {
    ctx.skip(
      "real-provider exclusion list is absent or empty (fresh clone / CI); collision check cannot run — see docs/data-synthetic.md",
    );
    return;
  }
  for (const seed of COLLISION_SEEDS) {
    const dataset = generateDataset(seed, corpus);
    for (const provider of dataset.providers) {
      const normalized = normalizeProviderName(provider.organization);
      expect(
        list.excluded.has(normalized),
        `fictional provider ${provider.organization} (seed ${seed}) must not collide with a real provider name`,
      ).toBe(false);
    }
  }
}, 300_000);

test("every fictional contact stays on fictional-only patterns", () => {
  const dataset = generateDataset(DEFAULT_SEED, corpus);
  for (const provider of dataset.providers) {
    if (provider.phone !== undefined) {
      expect(provider.phone, `phone of ${provider.organization}`).toMatch(/^\(202\) 555-01\d{2}$/);
    }
    if (provider.website !== undefined) {
      expect(provider.website, `website of ${provider.organization}`).toMatch(
        /^https:\/\/www\.[a-z0-9-]+\.example\.org$/,
      );
    }
    if (provider.email !== undefined) {
      expect(provider.email, `email of ${provider.organization}`).toMatch(
        /^contact@[a-z0-9-]+\.example\.org$/,
      );
    }
  }
});
