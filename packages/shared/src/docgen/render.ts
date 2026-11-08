/**
 * Pure Markdown renderer for the data-model reference. Turns the exported
 * TypeBox schemas (which are JSON Schema) plus the pinned filter table into
 * a deterministic, human-facing reference document. No filesystem, no
 * clock, no environment reads: the same input always renders byte-identical
 * output (the drift gate depends on it).
 *
 * Prose comes from schema annotations — `description`, `examples`, and the
 * per-value `x-enum-meanings` record — never from this module. Any schema
 * construct the renderer does not know how to render throws with the schema
 * path: fail loud, never silently approximate.
 */
import type { TSchema } from "typebox";
import type { FilterDefinition } from "../filters";

/** One rendered schema: the heading it carries and the schema itself. */
export interface NamedSchema {
  /** Heading text and anchor source, e.g. `UnitCard` or `Error codes`. */
  title: string;
  schema: TSchema;
}

/** An ordered block of the reference document. */
export type ReferenceBlock =
  | { kind: "schemas"; entries: NamedSchema[] }
  | { kind: "filter-table"; title: string; filters: readonly FilterDefinition[] };

export interface ModelReferenceInput {
  /** The shared-contract schema version, shown in the document header. */
  schemaVersion: string;
  /** The ordered document blocks (after the generated-file notice). */
  blocks: ReferenceBlock[];
}

interface RenderContext {
  /** Schema identity → section title, for object references rendered as links. */
  namedObjects: Map<TSchema, string>;
}

/**
 * Every schema key the renderer understands: the JSON-Schema keywords it
 * implements and the annotation prose it renders. Anything else on a node —
 * an unrecognized constraint like `maxLength` or `minItems`, a construct
 * keyword like `oneOf`/`$ref`/`not`, or `additionalProperties` — would
 * otherwise render identically to an unconstrained schema while the drift
 * gate stays green, so its presence is a hard error.
 *
 * Verified against the real emissions (probe over every node of every
 * exported schema): typebox merges annotation options verbatim and emits no
 * symbol-keyed internals, so Object.keys sees the complete key surface.
 */
const HANDLED_SCHEMA_KEYS = new Set([
  // Structure / keywords the renderer dispatches on:
  "type",
  "enum",
  "const",
  "anyOf",
  "items",
  "properties",
  "required",
  // Scalar constraints the renderer renders into the Constraints column:
  "minimum",
  "maximum",
  "minLength",
  "pattern",
  // Annotation prose the renderer renders:
  "description",
  "examples",
  "x-enum-meanings",
]);

/**
 * Fail loud when a schema node carries keys the renderer does not handle:
 * the rendered reference must never silently approximate the contract.
 */
function throwOnUnhandledKeys(schema: TSchema, path: string): void {
  const unhandled = Object.keys(schema).filter((key) => !HANDLED_SCHEMA_KEYS.has(key));
  if (unhandled.length > 0) {
    throw new Error(
      `docgen: unhandled schema keys at ${path}: ${unhandled.join(", ")} — the rendered reference would silently omit them; teach the renderer or remove them`,
    );
  }
}

/** GitHub-style anchor slug: lowercase, non-alphanumerics collapse to hyphens. */
const anchorSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Escape a cell so it cannot break the enclosing Markdown table. Backslashes
 * are escaped first: an input backslash would otherwise pair with the pipe's
 * new escape character and leave the pipe unescaped again. CR, LF, and CRLF
 * line endings each flatten to a space so annotation prose cannot split a row.
 */
const tableCell = (text: string): string =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r\n?|\n/g, " ");

function markdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(tableCell).join(" | ")} |`);
  return [head, rule, ...body].join("\n");
}

/** Per-value meanings carried by the `x-enum-meanings` annotation, if any. */
function enumMeanings(schema: TSchema): Record<string, string> {
  const meanings = (schema as { "x-enum-meanings"?: Record<string, string> })["x-enum-meanings"];
  return meanings ?? {};
}

/** The enum values of an `{ enum: [...] }` schema; throws when absent. */
function enumValues(schema: TSchema, path: string): string[] {
  const values = (schema as { enum?: unknown[] }).enum;
  if (!Array.isArray(values)) {
    throw new Error(`docgen: schema at ${path} has no enum values to render`);
  }
  return values.map((value) => String(value));
}

/** Render one enum value list with parenthesized meanings where annotated. */
function renderEnumValues(values: string[], meanings: Record<string, string>): string {
  if (Object.keys(meanings).length === 0) {
    return values.map((value) => `\`${value}\``).join(" · ");
  }
  return values
    .map((value) => (meanings[value] ? `\`${value}\` (${meanings[value]})` : `\`${value}\``))
    .join(" · ");
}

interface RenderedCell {
  type: string;
  constraints: string;
}

/**
 * Render one property schema into its table cells. Object references that
 * name a rendered section become links; every other construct renders
 * inline. Anything unrecognized throws with the schema path.
 */
function renderPropertySchema(schema: TSchema, path: string, ctx: RenderContext): RenderedCell {
  throwOnUnhandledKeys(schema, path);

  const namedObject = ctx.namedObjects.get(schema);
  if (namedObject !== undefined) {
    return { type: `object — see [${namedObject}](#${anchorSlug(namedObject)})`, constraints: "" };
  }

  if ("anyOf" in schema) {
    const branches = (schema as { anyOf?: TSchema[] }).anyOf;
    if (!Array.isArray(branches) || branches.length === 0) {
      throw new Error(`docgen: union at ${path} has no anyOf branches to render`);
    }
    const meanings = enumMeanings(schema);
    const parts: string[] = [];
    for (const [i, branch] of branches.entries()) {
      const branchPath = `${path}.anyOf[${i}]`;
      throwOnUnhandledKeys(branch, branchPath);
      if ("enum" in branch) {
        parts.push(renderEnumValues(enumValues(branch, branchPath), meanings));
      } else if ("const" in branch) {
        const value = String((branch as { const: unknown }).const);
        parts.push(meanings[value] ? `\`${value}\` (${meanings[value]})` : `\`${value}\``);
      } else {
        throw new Error(
          `docgen: cannot render union branch at ${branchPath}: only enum and const branches are supported`,
        );
      }
    }
    return { type: "enum", constraints: parts.join(" · ") };
  }

  if ("enum" in schema) {
    return {
      type: "enum",
      constraints: renderEnumValues(enumValues(schema, path), enumMeanings(schema)),
    };
  }

  if ("const" in schema) {
    const value = (schema as { const: unknown }).const;
    const literal = typeof value === "string" ? `"${value}"` : String(value);
    return { type: jsonTypeOf(value, path), constraints: `const ${literal}` };
  }

  const type = (schema as { type?: string }).type;
  if (type === "object") {
    // An unnamed nested object would render an approximation of its shape.
    throw new Error(
      `docgen: cannot render nested object at ${path}: give it a named section and reference it`,
    );
  }
  if (type === "array") {
    const items = (schema as { items?: TSchema }).items;
    if (items === undefined) {
      throw new Error(`docgen: array at ${path} has no items schema to render`);
    }
    const inner = renderPropertySchema(items, `${path}[items]`, ctx);
    return { type: `array of ${inner.type}`, constraints: inner.constraints };
  }
  if (type === "string" || type === "number" || type === "integer" || type === "boolean") {
    const constraints: string[] = [];
    const s = schema as {
      minimum?: number;
      maximum?: number;
      minLength?: number;
      pattern?: string;
    };
    if (s.minimum !== undefined) constraints.push(`minimum ${s.minimum}`);
    if (s.maximum !== undefined) constraints.push(`maximum ${s.maximum}`);
    if (s.minLength !== undefined) constraints.push(`minLength ${s.minLength}`);
    if (s.pattern !== undefined) constraints.push(`pattern \`${s.pattern}\``);
    return { type, constraints: constraints.join(" · ") };
  }

  throw new Error(`docgen: cannot render schema at ${path}: unrecognized construct`);
}

function jsonTypeOf(value: unknown, path: string): string {
  switch (typeof value) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    default:
      throw new Error(`docgen: cannot render const of type ${typeof value} at ${path}`);
  }
}

const CONSTRAINT_HEADER = "Constraints";

/** One "##" schema section: heading, annotated prose, field/value table, examples. */
function renderSchemaSection(named: NamedSchema, ctx: RenderContext): string {
  throwOnUnhandledKeys(named.schema, named.title);
  const parts: string[] = [`## ${named.title}`];
  const description = (named.schema as { description?: string }).description;
  if (description !== undefined) parts.push("", description);

  if ("enum" in named.schema || "anyOf" in named.schema) {
    const table = renderEnumSectionTable(named.schema, named.title);
    parts.push("", markdownTable(table.headers, table.rows));
  } else if ((named.schema as { type?: string }).type === "object") {
    const schema = named.schema as {
      properties?: Record<string, TSchema>;
      required?: string[];
      description?: string;
    };
    if (schema.properties === undefined) {
      throw new Error(`docgen: object schema at ${named.title} has no properties to render`);
    }
    const required = new Set(schema.required ?? []);
    const rows = Object.entries(schema.properties).map(([field, prop]) => {
      const cell = renderPropertySchema(prop, `${named.title}.${field}`, ctx);
      const propDescription =
        ctx.namedObjects.get(prop) !== undefined
          ? ""
          : ((prop as { description?: string }).description ?? "");
      return [
        `\`${field}\``,
        cell.type,
        required.has(field) ? "required" : "optional",
        cell.constraints,
        propDescription,
      ];
    });
    parts.push(
      "",
      markdownTable(["Field", "Type", "Required", CONSTRAINT_HEADER, "Description"], rows),
    );
  } else {
    throw new Error(
      `docgen: cannot render section ${named.title}: only object and enum schemas are supported as sections`,
    );
  }

  for (const exampleBlock of renderExamples(named)) {
    parts.push("", exampleBlock);
  }
  return parts.join("\n");
}

/** Value/meaning table for an enum (or enum-union) section. */
function renderEnumSectionTable(
  schema: TSchema,
  path: string,
): { headers: string[]; rows: string[][] } {
  const meanings = enumMeanings(schema);
  const values: string[] = [];
  if ("anyOf" in schema) {
    for (const [i, branch] of (schema as { anyOf: TSchema[] }).anyOf.entries()) {
      const branchPath = `${path}.anyOf[${i}]`;
      throwOnUnhandledKeys(branch, branchPath);
      if ("enum" in branch) values.push(...enumValues(branch, branchPath));
      else if ("const" in branch) values.push(String((branch as { const: unknown }).const));
      else
        throw new Error(
          `docgen: cannot render union branch at ${branchPath}: only enum and const branches are supported`,
        );
    }
  } else {
    values.push(...enumValues(schema, path));
  }
  if (Object.keys(meanings).length === 0) {
    return { headers: ["Value"], rows: values.map((value) => [`\`${value}\``]) };
  }
  return {
    headers: ["Value", "Meaning"],
    rows: values.map((value) => [`\`${value}\``, meanings[value] ?? "—"]),
  };
}

/** Fenced JSON blocks for the schema's `examples` annotation, if any. */
function renderExamples(named: NamedSchema): string[] {
  const examples = (named.schema as { examples?: unknown[] }).examples;
  if (!Array.isArray(examples) || examples.length === 0) return [];
  const lead = examples.length === 1 ? "Worked example:" : "Worked examples:";
  const blocks = examples.map(
    (example) => `\`\`\`json\n${JSON.stringify(example, null, 2)}\n\`\`\``,
  );
  return [lead, ...blocks];
}

/** The pinned-filter table section, rendered straight from `UNIT_FILTERS`. */
function renderFilterTable(title: string, filters: readonly FilterDefinition[]): string {
  const rows = filters.map((filter) => [
    `\`${filter.id}\``,
    filter.label,
    `\`${filter.control}\``,
    `\`${filter.target}\``,
    filter.options
      ? filter.options.map((option) => `\`${option.value}\` → ${option.label}`).join(" · ")
      : "—",
  ]);
  return [
    `## ${title}`,
    "",
    "The pinned filter set — exactly these definitions are published by the filter-schema endpoint; renderers stay generic over the control vocabulary.",
    "",
    markdownTable(["Id", "Label", "Control", "Target", "Options"], rows),
  ].join("\n");
}

/**
 * Render the full reference document: generated-file notice, schema version,
 * then the ordered blocks. Byte-identical for identical input.
 */
export function renderModelReference(input: ModelReferenceInput): string {
  const ctx: RenderContext = {
    namedObjects: new Map(
      input.blocks
        .flatMap((block) => (block.kind === "schemas" ? block.entries : []))
        .filter((entry) => (entry.schema as { type?: string }).type === "object")
        .map((entry) => [entry.schema, entry.title]),
    ),
  };

  const header = [
    "# Data model reference",
    "",
    "> **Generated file — do not hand-edit.** This reference is rendered from",
    "> the TypeBox schemas in `packages/shared`, the contract's source of",
    "> truth; hand edits will be overwritten by the next regeneration.",
    "> Regenerate with `pnpm docgen:model` and commit the result.",
    "",
    `Schema version: \`${input.schemaVersion}\``,
  ].join("\n");
  const parts: string[] = [header];

  for (const block of input.blocks) {
    if (block.kind === "filter-table") {
      parts.push(renderFilterTable(block.title, block.filters));
    } else {
      for (const entry of block.entries) {
        parts.push(renderSchemaSection(entry, ctx));
      }
    }
  }

  return `${parts.join("\n\n")}\n`;
}
