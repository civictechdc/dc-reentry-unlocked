/**
 * CLI entry point: regenerates the frozen dataset at data/units.v1.json from
 * the committed corpus with the fixed default seed. Deterministic — running
 * this twice must produce byte-identical output (the tests assert it too).
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getCorpus } from "./corpus.ts";
import { DEFAULT_SEED, datasetUnitCount, generateDataset, serializeDataset } from "./generate.ts";

const dataDir = fileURLToPath(new URL("../../../data/", import.meta.url));

const corpus = await getCorpus();
const dataset = generateDataset(DEFAULT_SEED, corpus);
await mkdir(dataDir, { recursive: true });
const target = path.join(dataDir, "units.v1.json");
// Atomic write: an interrupted run must never leave a truncated dataset.
// The temp name is unique per process so concurrent writers cannot race on
// a shared temp file; the rename makes publication all-or-nothing.
const temp = `${target}.${process.pid}.tmp`;
await writeFile(temp, serializeDataset(dataset), "utf8");
await rename(temp, target);

let programs = 0;
for (const provider of dataset.providers) {
  programs += provider.programs.length;
}
console.log(
  `wrote ${target}: ${dataset.providers.length} providers, ${programs} programs, ${datasetUnitCount(dataset)} units (seed ${DEFAULT_SEED})`,
);
