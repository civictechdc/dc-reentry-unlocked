import { expect, type Page } from "@playwright/test";
import { When, Then } from "./bdd.ts";
import { openApp, expectResultsLoaded } from "./app.steps.ts";

/**
 * Golden-path steps for the dynamic-filtering scenarios: map and card list
 * always render the same refreshed result set, whatever filter change was
 * applied in the schema-rendered bar.
 */

When(
  "a user selects {string} and {string}",
  async ({ page }: { page: Page }, valueA: string, valueB: string) => {
    await openApp(page);
    await expectResultsLoaded(page);
    // Ward: a multi-select, rendered as toggle buttons.
    await page.locator(".filter-bar").getByRole("button", { name: valueA }).click();
    // Housing type: a single-select, rendered as a native control.
    await page.selectOption("#filter-housing-type", { label: valueB });
    // The chip row confirms both selections landed in the filter store
    // (chip = "{filter label}: {option label}" — the ward chip reads
    // "Ward: Ward 5").
    await expect(page.getByText("Ward: Ward 5")).toBeVisible({ timeout: 20_000 });
  },
);

Then(
  "map pins and card list both reflect exactly the matching units",
  async ({ page }: { page: Page }) => {
    // Identity equality, three ways: the unit ids the API matched, the ids
    // the card list renders, and the ids the map pin list renders must be
    // the same set — equal-sized but different sets fail here, not just
    // equal counts. The oracle URL follows the same env override the app
    // bundle uses (VITE_API_URL), so the suite stays honest against a
    // relocated API base.
    const apiBase = process.env.VITE_API_URL ?? "http://127.0.0.1:3000";
    const apiUnitIds = await fetch(`${apiBase}/units?ward=5&housing-type=transitional`)
      .then((response) => {
        if (!response.ok) {
          // Origin + pathname only: a credential-bearing VITE_API_URL must
          // never echo its query or userinfo into CI logs.
          const oracleUrl = new URL(response.url);
          throw new Error(
            `oracle fetch failed: ${response.status} ${response.statusText} at ${oracleUrl.origin}${oracleUrl.pathname}`,
          );
        }
        return response.json();
      })
      .then((payload: { units: { id: string }[] }) => payload.units.map((unit) => unit.id))
      .then((ids) => ids.sort());
    // The refresh lands when the result-status line re-renders: gate the
    // synchronization assertions on it, not on a sleep.
    await expect(page.locator(".result-count")).toContainText(
      `${apiUnitIds.length} available unit`,
      {
        timeout: 20_000,
      },
    );
    const cardCount = await page.locator(".unit-list article").count();
    const pinCount = await page.getByTestId("map-pin-list").locator("button").count();
    const cardIds = (
      await page
        .locator(".unit-list article")
        .evaluateAll((cards) => cards.map((card) => card.getAttribute("data-unit-id")))
    ).sort();
    const pinIds = (
      await page
        .getByTestId("map-pin-list")
        .locator("button")
        .evaluateAll((pins) => pins.map((pin) => pin.getAttribute("data-unit-id")))
    ).sort();
    expect(cardCount, "the cards show every unit the API matched").toBe(apiUnitIds.length);
    expect(pinCount, "the map pins show the same result set").toBe(cardCount);
    expect(cardIds, "the cards show exactly the units the API matched").toEqual(apiUnitIds);
    expect(pinIds, "the map pins show the same result set").toEqual(apiUnitIds);
    // No stragglers: every rendered card carries the applied ward filter.
    await expect(page.locator(".unit-list article").filter({ hasText: "Ward 5" })).toHaveCount(
      cardCount,
    );
  },
);

When("the active filters match zero units", async ({ page }: { page: Page }) => {
  await openApp(page);
  await expectResultsLoaded(page);
  // The synthetic corpus is deliberately dense — two-way selections always
  // match, and enum selections also match unknown-at-source values (the
  // unknown-matches-every-selection honesty rule), so only stacked
  // boolean-yes requirements narrow hard. The minimal zero-match combination
  // (byte-frozen dataset, verified against the API:
  // /units?housing-type=emergency-shelter&population=families&referral-required=yes&ward=6
  // -> zero rows): no referral-required, emergency-shelter-or-unknown-at-source
  // family program exists in ward 6.
  await page.selectOption("#filter-housing-type", { label: "Emergency shelter" });
  await page.selectOption("#filter-population", { label: "Families" });
  await page
    .locator(".filter-bar")
    .locator(".control-boolean")
    .filter({ hasText: "Referral required" })
    .getByRole("button", { name: "Yes" })
    .click();
  await page.locator(".filter-bar").getByRole("button", { name: "Ward 6" }).click();
});

Then(
  "a clear empty-state panel appears explaining no units match, with controls to relax the filters",
  async ({ page }: { page: Page }) => {
    const zeroPanel = page.locator(".unit-list .zero-panel");
    await expect(zeroPanel).toBeVisible({ timeout: 20_000 });
    await expect(
      zeroPanel.getByRole("heading", { name: "No units match your filters" }),
    ).toBeVisible();
    await expect(
      zeroPanel.getByText("Try removing a filter, or clear them all and start over."),
    ).toBeVisible();
    // The active selections stay listed as removable chips with a clear-all.
    await expect(zeroPanel.getByText("Housing type: Emergency shelter")).toBeVisible();
    await expect(
      zeroPanel.getByRole("button", { name: "Remove all filter selections" }),
    ).toBeVisible();
  },
);
