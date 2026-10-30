import { describe, expect, test } from "vitest";
import { UNIT_FILTERS, type FilterDefinition } from "@dc-reentry/shared";
import { MalformedFilterSchemaError, parseFilterSchemaPayload } from "./filters-response";
import { buildUnitsQueryPath } from "./query";
import { newSelection, optionValues, reconcileSelection, reduceSelection } from "./selection";

const schema: FilterDefinition[] = UNIT_FILTERS;

describe("query path from selections", () => {
  test("single-select selections travel as one repeated parameter", () => {
    const path = buildUnitsQueryPath({ "housing-type": ["transitional"] }, schema);
    expect(path).toBe("/units?housing-type=transitional");
  });

  test("multi-select selections travel as repeated parameters", () => {
    const path = buildUnitsQueryPath({ ward: ["1", "5"] }, schema);
    expect(path).toBe("/units?ward=1&ward=5");
  });

  test("boolean selections travel as yes or no only", () => {
    expect(buildUnitsQueryPath({ "referral-required": ["yes"] }, schema)).toBe(
      "/units?referral-required=yes",
    );
  });

  test("selections narrow conjunctively across filters while unioning within one", () => {
    const path = buildUnitsQueryPath(
      { "housing-type": ["emergency-shelter"], ward: ["1", "2"] },
      schema,
    );
    expect(path).toBe("/units?housing-type=emergency-shelter&ward=1&ward=2");
  });

  test("an empty selection produces the plain endpoint", () => {
    expect(buildUnitsQueryPath({}, schema)).toBe("/units");
  });

  test("selections for definitions with unsupported control types are never sent", () => {
    const schemaWithUnsupported: FilterDefinition[] = [
      ...schema,
      {
        id: "bedroom-range",
        label: "Bedroom range",
        control: "range" as never,
        target: "unit.ward" as never,
      },
    ];
    const path = buildUnitsQueryPath({ "bedroom-range": ["1-2"] }, schemaWithUnsupported);
    expect(path).toBe("/units");
  });
});

describe("selection state machine", () => {
  test("single-select apply replaces the previous value", () => {
    const applied = reduceSelection(
      {},
      {
        kind: "apply",
        filterId: "housing-type",
        control: "single-select",
        values: ["emergency-shelter"],
      },
    );
    let next = reduceSelection(applied, {
      kind: "apply",
      filterId: "housing-type",
      control: "single-select",
      values: ["transitional"],
    });
    expect(next).toEqual({ "housing-type": ["transitional"] });
  });

  test("multi-select apply accumulates values", () => {
    let next = reduceSelection(
      {},
      { kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] },
    );
    next = reduceSelection(next, {
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["5"],
    });
    expect(next).toEqual({ ward: ["1", "5"] });
  });

  test("remove-value removes exactly one chip of one filter", () => {
    let next = reduceSelection(
      {},
      { kind: "apply", filterId: "ward", control: "multi-select", values: ["1", "5"] },
    );
    next = reduceSelection({ ...next, "housing-type": ["transitional"] } as never, {
      kind: "remove-value",
      filterId: "ward",
      value: "5",
    });
    expect(next).toEqual({ ward: ["1"], "housing-type": ["transitional"] });
  });

  test("remove-filter leaves other selections alone", () => {
    let next = reduceSelection({ "housing-type": ["transitional"] } as never, {
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1", "5"],
    });
    next = reduceSelection(next, { kind: "remove-filter", filterId: "ward" });
    expect(next).toEqual({ "housing-type": ["transitional"] });
  });

  test("clear empties everything", () => {
    const cleared = reduceSelection({ ward: ["1"], "referral-required": ["yes"] } as never, {
      kind: "clear",
    });
    expect(cleared).toEqual({});
  });

  test("empty value lists fall out of the selection", () => {
    let next = reduceSelection(
      {},
      { kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] },
    );
    next = reduceSelection(next, { kind: "remove-value", filterId: "ward", value: "1" });
    expect(next).toEqual({});
  });
});

describe("schema intake", () => {
  test("a filter-definition with an unsupported control type survives schema intake and stays hidden", () => {
    const payload = {
      schemaVersion: "1.0",
      filters: [
        ...schema,
        { id: "bedroom-range", label: "Bedroom range", control: "range", target: "unit.ward" },
      ],
    };
    const parsed = parseFilterSchemaPayload(payload);
    expect(parsed.map((definition) => definition.id)).toContain("bedroom-range");
    expect(
      (parsed.find((definition) => definition.id === "bedroom-range") as FilterDefinition).control,
    ).toBe("range");
  });

  test("schema intake keeps a supported definition intact", () => {
    const parsed = parseFilterSchemaPayload({ schemaVersion: "1.0", filters: schema });
    expect(parsed).toEqual(schema);
  });

  test("a malformed schema payload goes to the failure path instead of a silent empty schema", () => {
    expect(() => parseFilterSchemaPayload({ schemaVersion: "1.0", filters: "nope" })).toThrow(
      MalformedFilterSchemaError,
    );
    expect(() => parseFilterSchemaPayload(null)).toThrow(MalformedFilterSchemaError);
    expect(() =>
      parseFilterSchemaPayload({ schemaVersion: "1.0", filters: [{ garbage: true }] }),
    ).toThrow(MalformedFilterSchemaError);
  });

  test("option values follow control shapes (unsupported controls render nothing)", () => {
    const broken: FilterDefinition = {
      id: "broken",
      label: "Broken",
      control: "single-select",
      target: "unit.ward",
    };
    expect(optionValues(broken)).toEqual([]);
  });
});

describe("hostile filter ids (prototype-pollution shape)", () => {
  const HOSTILE_IDS = ["constructor", "__proto__", "toString", "hasOwnProperty"] as const;

  test("hostile ids behave as ordinary keys in the selection state", () => {
    for (const hostileId of HOSTILE_IDS) {
      let next = reduceSelection(newSelection(), {
        kind: "apply",
        filterId: hostileId,
        control: "single-select",
        values: ["transitional"],
      });
      expect(Array.from(next[hostileId] ?? [])).toEqual(["transitional"]);

      next = reduceSelection(next, {
        kind: "remove-value",
        filterId: hostileId,
        value: "transitional",
      });
      expect(Object.hasOwn(next, hostileId)).toBe(false);
      expect(Object.keys(next)).not.toContain(hostileId);
      expect(Object.getPrototypeOf(next)).toBeNull();
    }
  });

  test("multi-select accumulates without duplicates and reconcile prunes hostile keys", () => {
    let next = reduceSelection(newSelection(), {
      kind: "apply",
      filterId: "__proto__",
      control: "multi-select",
      values: ["1", "1"],
    });
    expect(next["__proto__"]).toEqual(["1"]);

    const wardOnlySchema: FilterDefinition[] = [
      { id: "ward", label: "Ward", control: "multi-select", target: "unit.ward" },
    ];
    next = reconcileSelection(next, wardOnlySchema);
    expect(Object.getPrototypeOf(next)).toBeNull();
    expect(next["__proto__"]).toBeUndefined();
  });
});

describe("client-boundary caps on schema intake", () => {
  function inflatedSchema(count: number): FilterDefinition[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `filter-${index}`,
      label: "L",
      control: "single-select",
      target: "unit.ward",
      options: [{ value: "a", label: "A" }],
    }));
  }

  test("filter count is capped", () => {
    const parsed = parseFilterSchemaPayload({ schemaVersion: "1.0", filters: inflatedSchema(200) });
    expect(parsed.length).toBeLessThanOrEqual(64);
  });

  test("duplicate filter ids collapse to the first definition", () => {
    const first = inflatedSchema(1)[0]!;
    const parsed = parseFilterSchemaPayload({
      schemaVersion: "1.0",
      filters: [first, { ...first }],
    });
    expect(parsed).toHaveLength(1);
  });

  test("duplicate option values collapse within one definition", () => {
    const definition: FilterDefinition = {
      id: "ward",
      label: "Ward",
      control: "multi-select",
      target: "unit.ward",
      options: [
        { value: "1", label: "Ward 1" },
        { value: "1", label: "Ward 1 again" },
      ],
    };
    const parsed = parseFilterSchemaPayload({ schemaVersion: "1.0", filters: [definition] });
    expect(parsed[0]?.options).toEqual([{ value: "1", label: "Ward 1" }]);
  });

  test("a known control with an unrecognized target fails closed (retry path)", () => {
    const brokenDefinition = {
      id: "broken",
      label: "Broken",
      control: "boolean",
      target: "unreachable.nonsense",
    };
    expect(() =>
      parseFilterSchemaPayload({
        schemaVersion: "1.0",
        filters: [brokenDefinition, UNIT_FILTERS[0] as FilterDefinition],
      }),
    ).toThrow(MalformedFilterSchemaError);
  });

  test("any invalid entry in the filters array fails closed — a valid neighbor cannot rescue the load", () => {
    expect(() =>
      parseFilterSchemaPayload({
        schemaVersion: "1.0",
        filters: [UNIT_FILTERS[0], null],
      }),
    ).toThrow(MalformedFilterSchemaError);
    expect(() =>
      parseFilterSchemaPayload({
        schemaVersion: "1.0",
        filters: [
          UNIT_FILTERS[0],
          { id: "bad-label", label: "", control: "boolean", target: "unit.ward" },
        ],
      }),
    ).toThrow(MalformedFilterSchemaError);
    expect(() =>
      parseFilterSchemaPayload({
        schemaVersion: "1.0",
        filters: [
          {
            id: "bad-options",
            label: "Bad options",
            control: "single-select",
            target: "unit.ward",
            options: [{ value: "a", label: "A" }, null],
          },
        ],
      }),
    ).toThrow(MalformedFilterSchemaError);
    // the documented exception survives — ALL entries may be unsupported-control shaped
    const survived = parseFilterSchemaPayload({
      schemaVersion: "1.0",
      filters: [{ id: "range", label: "Range", control: "number-range", target: "unit.ward" }],
    });
    expect(survived).toHaveLength(1);
  });

  test("truncation happens before dedupe: colliding capped ids dedupe away", () => {
    const longA = "x".repeat(100) + "A";
    const longB = "x".repeat(100) + "B";
    const definition = (id: string): FilterDefinition => ({
      id,
      label: "L",
      control: "single-select",
      target: "unit.ward",
      options: [{ value: "a", label: "A" }],
    });
    const parsed = parseFilterSchemaPayload({
      schemaVersion: "1.0",
      filters: [definition(longA), definition(longB)],
    });
    // both raw ids are 101 chars; after the cap they are identical strings —
    // the second definition must be deduped away instead of colliding
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toHaveLength(100);
  });

  test("option values truncate before dedupe (colliding truncated values collapse)", () => {
    const definition: FilterDefinition = {
      id: "ward",
      label: "Ward",
      control: "multi-select",
      target: "unit.ward",
      options: [
        { value: "y".repeat(100) + "A", label: "Option A" },
        { value: "y".repeat(100) + "B", label: "Option B" },
      ],
    };
    const parsed = parseFilterSchemaPayload({ schemaVersion: "1.0", filters: [definition] });
    expect(parsed[0]?.options).toEqual([{ value: "y".repeat(100), label: "Option A" }]);
  });
});
