import { Value, UnitsResponseSchema, UnitCardSchema, type UnitCard } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { expect, test } from "vitest";
import {
  SYNTHETIC_DISCLOSURE,
  createDatasetHousingUnitsSource,
  createMemoryHousingUnitsSource,
  defaultDatasetPath,
} from "../src/datasource";
import { SCHEMA_VERSION } from "@dc-reentry/shared";
import { buildApp } from "../src/app";

test("the running API serves only the available units of the frozen dataset", async () => {
  const source = await createDatasetHousingUnitsSource(defaultDatasetPath());
  const app = await buildApp({ unitSource: source, logLevel: "error" });

  const response = await app.inject("/units");
  const payload = response.json();

  expect(response.statusCode).toBe(200);
  expect(payload.units.length).toBe(919); // 1200 dataset units − not-available − unverified-availability
  expect(Value.Check(UnitsResponseSchema, payload)).toBe(true);
  expect(payload.units.every((unit: UnitCard) => unit.availabilityState === "available")).toBe(
    true,
  );
  expect(payload.units.every((unit: UnitCard) => Value.Check(UnitCardSchema, unit))).toBe(true);

  await app.close();
});

test("the data source is swappable: an injected dataset serves its available units", async () => {
  const source = createMemoryHousingUnitsSource([
    aUnit().withId("u1").inWard(1).build(),
    aUnit().withId("u2").build(),
  ]);
  const app = await buildApp({ unitSource: source, logLevel: "error" });

  const response = await app.inject("/units");
  const ids = response.json().units.map((unit: UnitCard) => unit.id);

  expect(ids).toEqual(["u1", "u2"]);
  await app.close();
});

test("unavailable and unverified-availability units never leave the data source", () => {
  const source = createMemoryHousingUnitsSource([
    aUnit().withId("available-1").build(),
    aUnit().withId("taken").unavailable().build(),
    aUnit().withId("hold").withUnverifiedAvailability().build(),
  ]);

  const ids = source.listUnits().map((unit) => unit.id);

  expect(ids).toEqual(["available-1"]);
  expect(ids).not.toContain("taken");
  expect(ids).not.toContain("hold");
});

test("available units keep the confirmation distinction: verified and needs-verification both surface", async () => {
  const source = await createDatasetHousingUnitsSource(defaultDatasetPath());
  const badges = new Set(source.listUnits().map((unit) => unit.verificationBadge));

  expect(badges).toContain("confirmed");
  expect(badges).toContain("needs-verification");
});
// ---------------------------------------------------------------------------
// Synthetic-provenance serving (seam guards): the envelope carries the
// dataset's own provenance sentence, and the source refuses everything that
// is not fictional-only and duplicate-id-free.
// ---------------------------------------------------------------------------

/** Flatten a built unit card into the frozen dataset's nested file shape. */
function cardToDatasetTree(card: UnitCard, header: Record<string, unknown>): object {
  return {
    ...header,
    providers: [
      {
        ...card.provider,
        programs: [
          {
            ...card.program,
            units: [
              {
                id: card.id,
                programId: card.programId,
                address: card.address,
                ward: card.ward,
                quadrant: card.quadrant,
                locationPrecision: card.locationPrecision,
                coordinates: card.coordinates,
                bedrooms: card.bedrooms,
                size: card.size,
                cost: card.cost,
                availabilityState: card.availabilityState,
                availabilityConfirmed: card.availabilityConfirmed,
              },
            ],
          },
        ],
      },
    ],
  };
}

async function writeScratchDataset(body: string): Promise<string> {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "dataset-guard-"));
  const datasetPath = join(dir, "units.guarded.json");
  await writeFile(datasetPath, body, "utf8");
  return datasetPath;
}

test("every served payload carries the synthetic markers, verbatim from the dataset header", async () => {
  const source = await createDatasetHousingUnitsSource(defaultDatasetPath());
  const app = await buildApp({ unitSource: source, logLevel: "error" });

  const response = await app.inject("/units");
  const payload = response.json();

  expect(response.statusCode).toBe(200);
  expect(payload.synthetic).toBe(true);

  // the disclosure travels from the dataset header into the envelope —
  // proved by pinning against the frozen file itself
  const { readFile } = await import("node:fs/promises");
  const dataset = JSON.parse(await readFile(defaultDatasetPath(), "utf8")) as {
    disclaimer: string;
  };
  expect(payload.disclosure).toBe(dataset.disclaimer);
  expect(payload.disclosure.length).toBeGreaterThan(0);

  await app.close();
});

test("a memory-backed source always serves the provenance markers too", () => {
  const source = createMemoryHousingUnitsSource([aUnit().build()]);

  expect(source.synthetic).toBe(true);
  expect(source.disclosure.length).toBeGreaterThan(0);
});

test("a dataset without the synthetic provenance marker refuses to boot", async () => {
  const card = aUnit().build();
  const datasetPath = await writeScratchDataset(
    JSON.stringify(
      cardToDatasetTree(card, {
        schemaVersion: SCHEMA_VERSION,
        disclaimer: SYNTHETIC_DISCLOSURE,
        // the tamper: the provenance marker is gone
      }),
    ),
  );

  await expect(createDatasetHousingUnitsSource(datasetPath)).rejects.toThrow(
    /does not carry synthetic: true — refuse the whole dataset/i,
  );
});

test("a dataset whose disclosure drifts from the served provenance sentence refuses to boot", async () => {
  const card = aUnit().build();
  const datasetPath = await writeScratchDataset(
    JSON.stringify(
      cardToDatasetTree(card, {
        schemaVersion: SCHEMA_VERSION,
        synthetic: true,
        disclaimer: "A different sentence that no longer matches the served provenance line.",
      }),
    ),
  );

  await expect(createDatasetHousingUnitsSource(datasetPath)).rejects.toThrow(
    /carries a disclosure that differs/i,
  );
});

test("a real-looking phone number in a tampered fixture fails source construction", () => {
  // a realistic Washington phone number that is not in the fictional 555-01XX block,
  // on its own uniquely-numbered card so the id guard does not fire first
  const card = aUnit().withId("phone-guard-a").build();
  card.provider.phone = "(202) 555-5735";

  expect(() => createMemoryHousingUnitsSource([card])).toThrow(
    /not the fictional phone pattern \(202\) 555-01XX/i,
  );
});

test("a non-example.org email in a tampered fixture fails source construction", () => {
  const card = aUnit().build();
  card.provider.email = "contact@attacker-real-estate.example.com";

  expect(() => createMemoryHousingUnitsSource([card])).toThrow(/not an example\.org/i);
});

test("a non-example.org website in a tampered fixture fails source construction", () => {
  const card = aUnit().build();
  card.provider.website = "https://attacker-real-estate.example.com";

  expect(() => createMemoryHousingUnitsSource([card])).toThrow(/not an example\.org/i);
});

test("a non-fictional phone also fails a dataset-source construction at the same seam", async () => {
  const card = aUnit().build();
  card.provider.phone = "(202) 555-5735";
  const datasetPath = await writeScratchDataset(
    JSON.stringify(
      cardToDatasetTree(card, {
        schemaVersion: SCHEMA_VERSION,
        synthetic: true,
        disclaimer: SYNTHETIC_DISCLOSURE,
      }),
    ),
  );

  await expect(createDatasetHousingUnitsSource(datasetPath)).rejects.toThrow(
    /not the fictional phone pattern/i,
  );
});

test("a subdomain of example.org still passes the contact pattern", () => {
  const card = aUnit().build();
  card.provider.website = "https://listings.example.org/search";
  card.provider.email = "intake@mail.example.org";

  expect(() => createMemoryHousingUnitsSource([card])).not.toThrow();
});

test("duplicate unit ids in the loaded dataset fail source construction", () => {
  const card = aUnit().build();

  expect(() => createMemoryHousingUnitsSource([card, card])).toThrow(
    /dataset carries duplicate unit ids/i,
  );
});
