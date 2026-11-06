/**
 * CLI entry point: renders the data-model reference to `docs/data-model.md`
 * from the exported TypeBox schemas. Deterministic — running this twice
 * must produce byte-identical output (the drift gate diffs the committed
 * file after every regeneration).
 */
import { rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { MODEL_REFERENCE } from "./reference";
import { renderModelReference } from "./render";

const target = fileURLToPath(new URL("../../../../docs/data-model.md", import.meta.url));
const markdown = renderModelReference(MODEL_REFERENCE);
// Atomic write: an interrupted run must never leave a truncated reference
// doc. The temp name is unique per process so concurrent writers cannot
// race on a shared temp file; the rename makes publication all-or-nothing.
const temp = `${target}.${process.pid}.tmp`;
await writeFile(temp, markdown, "utf8");
await rename(temp, target);

const schemaSections = MODEL_REFERENCE.blocks.flatMap((block) =>
  block.kind === "schemas" ? block.entries : [],
);
const filterTable = MODEL_REFERENCE.blocks.find((block) => block.kind === "filter-table");
console.log(
  `wrote ${target}: ${schemaSections.length} schema sections, ${
    filterTable?.kind === "filter-table" ? filterTable.filters.length : 0
  } filters (schema version ${MODEL_REFERENCE.schemaVersion})`,
);
