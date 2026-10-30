import {
  UNIT_FILTERS,
  WardSchema,
  FilterSchemaResponseSchema,
  UnitsResponseSchema,
} from "@dc-reentry/shared";
import { expect, test } from "vitest";
import { buildApp } from "../src/app";
import { createMemoryHousingUnitsSource } from "../src/datasource";

/** The OpenAPI document under test, served at GET /openapi.json. */
async function buildDocumentedApp() {
  return buildApp({
    unitSource: createMemoryHousingUnitsSource([]),
    logLevel: "error",
  });
}

type Document = {
  openapi: string;
  info: { title: string; description: string; version: string };
  paths: Record<
    string,
    Record<
      string,
      { parameters?: unknown[]; responses?: Record<string, unknown> } & Record<string, unknown>
    >
  >;
  components?: { schemas?: Record<string, { properties?: Record<string, { $ref?: string }> }> };
};

async function servedDocument() {
  const app = await buildDocumentedApp();
  const response = await app.inject("/openapi.json");
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toContain("application/json");
  const doc = response.json() as Document;
  await app.close();
  return doc;
}

test("a consumer can fetch a machine-readable OpenAPI document for the API", async () => {
  const doc = await servedDocument();

  expect(doc.openapi).toMatch(/^3\./);
  expect(doc.info.title).toBeTruthy();
  expect(doc.info.description).toContain("Synthetic");
  expect(typeof doc.paths).toBe("object");
});

test("the document covers the endpoints it serves: units, filters, health, and itself", async () => {
  const doc = await servedDocument();

  expect(Object.keys(doc.paths).sort()).toEqual(["/filters", "/health", "/openapi.json", "/units"]);
  for (const path of Object.keys(doc.paths)) {
    expect(doc.paths[path]?.get, `GET ${path}`).toBeTruthy();
  }
});

test("the generated document covers the shared error envelope on error status codes", async () => {
  const doc = await servedDocument();
  const envelope = doc.components?.schemas?.errorEnvelope;

  expect(envelope).toBeTruthy();
  expect(Object.keys(envelope?.properties ?? {}).sort()).toEqual([
    "code",
    "correlationId",
    "message",
    "schemaVersion",
  ]);

  for (const path of ["/units", "/filters", "/health", "/openapi.json"]) {
    const route = doc.paths[path];
    expect(route).toBeTruthy();
    const responses = (route?.get?.responses ?? {}) as Record<
      string,
      { content: { "application/json": { schema: { $ref: string } } } }
    >;
    const statuses = new Set(Object.keys(responses));
    for (const status of ["400", "404", "429", "500"]) {
      expect(statuses.has(status), `${path} documents ${status}`).toBe(true);
      const declaredResponse = responses[status];
      if (declaredResponse === undefined) {
        throw new Error(`${path} must document the ${status} error response`);
      }
      expect(
        declaredResponse.content["application/json"].schema.$ref,
        `${path} ${status} references the envelope`,
      ).toBe("#/components/schemas/errorEnvelope");
    }
  }
});

test("the published filter schema is reflected exactly in the query parameters", async () => {
  const doc = await servedDocument();
  const parameters = (doc.paths["/units"]?.get?.parameters ?? []) as Array<{
    name: string;
    schema: {
      type?: string;
      enum?: string[];
      minimum?: number;
      maximum?: number;
      items?: { type?: string; enum?: string[]; minimum?: number; maximum?: number };
    };
  }>;

  const byName = new Map(parameters.map((parameter) => [parameter.name, parameter]));
  expect(parameters.length).toBe(UNIT_FILTERS.length);

  for (const definition of UNIT_FILTERS) {
    const parameter = byName.get(definition.id);
    expect(parameter, `parameter ${definition.id}`).toBeTruthy();

    if (definition.control === "boolean") {
      expect(parameter?.schema.items?.enum).toEqual(["yes", "no"]);
      continue;
    }
    if (definition.target === "unit.ward") {
      // The ward parameter IS the shared ward contract.
      expect(parameter?.schema.items?.type).toBe("integer");
      expect(parameter?.schema.items?.minimum).toBe(1);
      expect(parameter?.schema.items?.maximum).toBe(8);
      continue;
    }
    expect(parameter?.schema.items?.enum).toEqual((definition.options ?? []).map((o) => o.value));
  }
});

test("the document's response schemas are the shared contract schemas, unedited", async () => {
  const app = await buildDocumentedApp();
  const doc = (await app.inject("/openapi.json")).json() as Document;

  const unitsRoute = doc.paths["/units"];
  expect(unitsRoute).toBeTruthy();
  const unitsResponses = (
    (unitsRoute?.get?.responses ?? {}) as Record<
      string,
      { content: { "application/json": { schema: unknown } } }
    >
  )["200"];
  if (unitsResponses === undefined) {
    throw new Error("/units must document its 200 response");
  }
  expect(unitsResponses.content["application/json"].schema).toEqual(
    JSON.parse(JSON.stringify(UnitsResponseSchema)),
  );

  const filtersRoute = doc.paths["/filters"];
  expect(filtersRoute).toBeTruthy();
  const filtersResponses = (
    (filtersRoute?.get?.responses ?? {}) as Record<
      string,
      { content: { "application/json": { schema: unknown } } }
    >
  )["200"];
  if (filtersResponses === undefined) {
    throw new Error("/filters must document its 200 response");
  }
  expect(filtersResponses.content["application/json"].schema).toEqual(
    JSON.parse(JSON.stringify(FilterSchemaResponseSchema)),
  );

  await app.close();
});

test("the ward contract keeps its shared range inside the generated document", async () => {
  const doc = await servedDocument();
  const wardParameter = (doc.paths["/units"]?.get?.parameters ?? []).find(
    (parameter) => (parameter as { name: string }).name === "ward",
  ) as { schema: { items?: { minimum?: number; maximum?: number } } };
  const wardContract = JSON.parse(JSON.stringify(WardSchema)) as {
    minimum?: number;
    maximum?: number;
  };

  expect(wardParameter.schema.items).toEqual({
    type: "integer",
    minimum: wardContract.minimum,
    maximum: wardContract.maximum,
  });
});
