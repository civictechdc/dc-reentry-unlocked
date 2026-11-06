import { expect, test } from "vitest";
import Type, { type TSchema } from "typebox";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  ErrorCodeSchema,
  ERROR_CODES,
  HOUSING_TYPES,
  UnitSchema,
  UNIT_FILTERS,
  Value,
} from "../index";
import { MODEL_REFERENCE } from "./reference";
import { renderModelReference, type ModelReferenceInput } from "./render";

// Spot-verifies the rendered data-model reference against the schemas it
// claims to document: the generated doc is committed, so the claims it
// makes must be provably the schemas' claims.

const rendered = renderModelReference(MODEL_REFERENCE);

/** The rendered markdown of one "##" section, from its heading to the next. */
const section = (title: string): string => {
  const start = rendered.indexOf(`## ${title}\n`);
  if (start === -1) throw new Error(`section not rendered: ${title}`);
  const next = rendered.indexOf("\n## ", start + 1);
  return rendered.slice(start, next === -1 ? rendered.length : next);
};

/** Every table's data rows in the markdown slice, as cell arrays. */
const tableRows = (markdown: string): string[][] =>
  markdown
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| ---"))
    .slice(1) // drop the header row; the rule row never matches the filter above
    .map((line) => line.slice(2, -2).split(" | "));

const rowsByField = (markdown: string): Map<string, string[]> =>
  new Map(tableRows(markdown).map((row) => [row[0]!.replaceAll("`", ""), row]));

test("the unit section lists every Unit property exactly once with honest required marks", () => {
  const rows = tableRows(section("Unit"));
  const listedFields = rows.map((row) => row[0]!.replaceAll("`", ""));

  // Insertion order, each field exactly once.
  expect(listedFields).toEqual(Object.keys(UnitSchema.properties));

  const required = new Set<string>(UnitSchema.required ?? []);
  for (const row of rows) {
    const field = row[0]!.replaceAll("`", "");
    expect(row[2]).toBe(required.has(field) ? "required" : "optional");
  }
});

test("the unit card marks program and provider required and pins the schema version literal", () => {
  const rows = rowsByField(section("UnitCard"));

  const programRow = rows.get("program");
  expect(programRow?.[2]).toBe("required");
  expect(programRow?.[1]).toContain("[Program](#program)");

  const providerRow = rows.get("provider");
  expect(providerRow?.[2]).toBe("required");
  expect(providerRow?.[1]).toContain("[Provider](#provider)");

  const schemaVersionRow = rows.get("schemaVersion");
  expect(schemaVersionRow?.[3]).toBe('const "0.2"');
});

test("the error codes section lists every ERROR_CODES value with its annotated meaning", () => {
  const meanings =
    (ErrorCodeSchema as { "x-enum-meanings"?: Record<string, string> })["x-enum-meanings"] ?? {};
  const rows = tableRows(section("Error codes"));

  expect(rows.map((row) => row[0]!.replaceAll("`", ""))).toEqual([...ERROR_CODES]);
  for (const [i, row] of rows.entries()) {
    expect(row[1]).toBe(meanings[ERROR_CODES[i]!]);
  }
});

test("the ward constraint renders the ward range as minimum 1 and maximum 8", () => {
  const wardRow = rowsByField(section("Unit")).get("ward");
  expect(wardRow?.[3]).toContain("minimum 1");
  expect(wardRow?.[3]).toContain("maximum 8");
});

test("the address constraint renders the non-empty minimum length", () => {
  const addressRow = rowsByField(section("Unit")).get("address");
  expect(addressRow?.[3]).toBe("minLength 1");
});

test("unknown eligibility fields render the taxonomy plus the honest unknown", () => {
  const housingRow = rowsByField(section("Program")).get("housingType");
  const constraints = housingRow?.[3] ?? "";
  for (const value of HOUSING_TYPES) {
    expect(constraints).toContain(`\`${value}\``);
  }
  expect(constraints).toContain("`unknown`");
  expect(constraints).toContain("Not publicly listed");
});

test("every worked example the doc renders validates against its schema", () => {
  const entries = MODEL_REFERENCE.blocks.flatMap((block) =>
    block.kind === "schemas" ? block.entries : [],
  );

  let renderedExamples = 0;
  for (const entry of entries) {
    const examples = (entry.schema as { examples?: unknown[] }).examples ?? [];
    for (const example of examples) {
      expect(Value.Check(entry.schema, example)).toBe(true);
      renderedExamples++;
    }
  }

  // The doc renders exactly the schemas' examples — no more, no fewer —
  // and carries no fenced block beyond those examples (open + close each).
  expect(rendered.match(/```json/g)?.length).toBe(renderedExamples);
  expect(rendered.match(/^```/gm)?.length).toBe(renderedExamples * 2);
  expect(renderedExamples).toBeGreaterThanOrEqual(2); // UnitCard + one envelope at minimum
});

test("the committed model reference matches a fresh render byte-for-byte", async () => {
  // Local drift gate: if a schema changed without regenerating the doc,
  // `pnpm test` fails right here, before CI ever diffs the file.
  const committedPath = fileURLToPath(new URL("../../../../docs/data-model.md", import.meta.url));
  const committed = await readFile(committedPath, "utf8");

  expect(committed).toBe(rendered);
});

test("regeneration is byte-identical for unchanged schemas", () => {
  expect(renderModelReference(MODEL_REFERENCE)).toBe(rendered);
});

test("the pinned filter table renders exactly the eleven filters in pinned order", () => {
  const rows = tableRows(section("Filters"));
  expect(rows.map((row) => row[0]!.replaceAll("`", ""))).toEqual(UNIT_FILTERS.map((f) => f.id));
});

test("the renderer throws with the schema path on a construct it cannot render", () => {
  const broken: ModelReferenceInput = {
    schemaVersion: "0.2",
    blocks: [
      {
        kind: "schemas",
        entries: [{ title: "Broken", schema: Type.Object({ oops: Type.Null() }) }],
      },
    ],
  };

  expect(() => renderModelReference(broken)).toThrow(/Broken\.oops/);
});

/** A one-property reference input around the given property schema. */
const inputWithProperty = (title: string, field: string, schema: TSchema): ModelReferenceInput => ({
  schemaVersion: "0.2",
  blocks: [{ kind: "schemas", entries: [{ title, schema: Type.Object({ [field]: schema }) }] }],
});

test("a string field carrying an unhandled maxLength constraint throws naming its path", () => {
  const input = inputWithProperty("Broken", "rules", Type.String({ maxLength: 3 }));

  expect(() => renderModelReference(input)).toThrow(
    /unhandled schema keys at Broken\.rules: maxLength/,
  );
});

test("an object schema carrying additionalProperties throws naming its path", () => {
  const input = inputWithProperty(
    "Broken",
    "strict",
    Type.Object({ open: Type.Boolean() }, { additionalProperties: false }),
  );

  expect(() => renderModelReference(input)).toThrow(
    /unhandled schema keys at Broken\.strict: additionalProperties/,
  );
});

test("a schema the renderer does not dispatch on (oneOf, $ref, not) throws naming its path", () => {
  const unrecognized = [
    ["oneOf", { oneOf: [{ type: "string" }] }],
    ["$ref", { $ref: "#/$defs/somewhere" }],
    ["not", { not: { type: "string" } }],
  ] as const;

  for (const [field, node] of unrecognized) {
    const input = inputWithProperty("Broken", field, node as unknown as TSchema);
    expect(() => renderModelReference(input), `field ${field}`).toThrow(
      new RegExp(
        `unhandled schema keys at Broken\\.${field.replace("$", "\\$")}: ${field.replace("$", "\\$")}`,
      ),
    );
  }
});

test("an array field carrying an unhandled minItems constraint throws naming its path", () => {
  const input = inputWithProperty("Broken", "tags", Type.Array(Type.String(), { minItems: 1 }));

  expect(() => renderModelReference(input)).toThrow(
    /unhandled schema keys at Broken\.tags: minItems/,
  );
});

test("the rendered reference stays free of raw HTML and injection markers", () => {
  // The reference is built purely from annotation prose and schema data. If
  // a future annotation renders a "<", rephrase the prose — HTML does not
  // belong in the generated reference (tables and fences carry its markup).
  const offendingLines = rendered
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.includes("<"));

  expect(
    offendingLines,
    "annotation prose rendered a '<' character — rephrase the prose in the schema annotation; the generated reference carries no HTML",
  ).toEqual([]);
  expect(rendered.includes("<!--")).toBe(false);
});
