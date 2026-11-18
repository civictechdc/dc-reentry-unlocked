import { describe, expect, test } from "vitest";
import { m } from "#lib/paraglide/messages.js";
import { detailValueLabel, telHref } from "./detail-values.ts";

describe("detailValueLabel taxonomy presentation", () => {
  test("a future taxonomy value renders a humanized form of the published value, never the honest unknown", () => {
    // the value is truthful published data — derived presentation, not a
    // message-catalog entry (a future value has no translation by definition)
    const label = detailValueLabel("rapid-rehousing");

    expect(label).toBe("Rapid rehousing");
    expect(label).not.toBe(m.detail_value_unknown());
  });

  test("a multi-word future value capitalizes only the first letter of the whole phrase", () => {
    expect(detailValueLabel("permanent-supportive-housing-plus")).toBe(
      "Permanent supportive housing plus",
    );
  });

  test("an inherited property name renders its humanized form, never an inherited prototype member", () => {
    // payload values named after Object.prototype members are still just
    // published taxonomy values — the catalogue lookup must stay own-property
    expect(detailValueLabel("constructor")).toBe("Constructor");
    expect(detailValueLabel("toString")).toBe("ToString");
    expect(detailValueLabel("__proto__")).toBe("__proto__");
  });

  test("inherited property names always resolve to a string label", () => {
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(typeof detailValueLabel(name)).toBe("string");
    }
  });

  test("known taxonomy values resolve to their catalogue labels byte-identical", () => {
    expect(detailValueLabel("transitional")).toBe(m.taxonomy_housing_transitional());
    expect(detailValueLabel("permanent-open-ended")).toBe(m.taxonomy_length_permanent());
    expect(detailValueLabel("families")).toBe(m.taxonomy_population_families());
    expect(detailValueLabel("all")).toBe(m.taxonomy_gender_all());
  });

  test("the honest Unknown marker stays reserved for values the source did not publish", () => {
    expect(detailValueLabel("unknown")).toBe(m.detail_value_unknown());
  });

  test("the tri-state policy literals keep their catalogue labels", () => {
    expect(detailValueLabel("yes")).toBe(m.detail_value_yes());
    expect(detailValueLabel("no")).toBe(m.detail_value_no());
  });
});

describe("telHref dialable links", () => {
  test("strips a formatted US number to its digits", () => {
    const href = telHref("(202) 555-0123");
    expect(href).toBe("tel:2025550123");
  });

  test("keeps a leading plus as the first character of the tel link", () => {
    const href = telHref("+1 202 555 0123");
    expect(href).toBe("tel:+12025550123");
  });

  test("drops pluses and separators that are not the leading character", () => {
    const href = telHref("202+555-0123");
    expect(href).toBe("tel:2025550123");
  });

  test("passes digits-only input through unchanged", () => {
    const href = telHref("2025550123");
    expect(href).toBe("tel:2025550123");
  });
});
