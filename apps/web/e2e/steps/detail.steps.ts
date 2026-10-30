import { expect, type Page } from "@playwright/test";
import { When, Then } from "./bdd.ts";
import { openApp, expectResultsLoaded } from "./app.steps.ts";

/**
 * Golden-path steps for the unit-detail scenarios: a pin (or card) opens
 * the slide-over detail for that unit while the map stays visible, the
 * panel carries every spec/policy/contact block, and unknown policy fields
 * stay honestly listed as "not publicly listed".
 */

let openedAddress: string | null = null;

When("a user clicks a map pin", async ({ page }: { page: Page }) => {
  await openApp(page);
  await expectResultsLoaded(page);
  // The sr pins are the keyboard-accessible stand-ins for the canvas pins:
  // focusing one and pressing Enter selects that unit (the canvas overlay
  // swallows pointer clicks for direct DOM buttons behind it).
  const firstPin = page.getByTestId("map-pin-list").locator("button").first();
  openedAddress = (await firstPin.getAttribute("aria-label")) ?? null;
  await firstPin.focus();
  await firstPin.press("Enter");
});

Then(
  "the slide-over detail opens for that unit with the map still visible",
  async ({ page }: { page: Page }) => {
    const detail = page.getByTestId("unit-detail");
    await expect(detail).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("map-view")).toBeVisible();
    // Same unit, not a random one: the pin's address is the detail address.
    if (openedAddress) {
      const firstAddressLine =
        openedAddress.replace("Select housing unit at ", "").split(",")[0] ?? "";
      await expect(
        detail.getByRole("region", { name: "Unit details" }).getByText(firstAddressLine).first(),
      ).toBeVisible();
    }
  },
);

When("the detail panel renders for a unit", async ({ page }: { page: Page }) => {
  await openApp(page);
  await expectResultsLoaded(page);
  await page.locator(".unit-list article button.card-body").first().click();
  await expect(page.getByTestId("unit-detail")).toBeVisible({ timeout: 20_000 });
});

Then(
  "it shows unit specs \\(address, bedrooms, size, cost), program policies \\(referral, sobriety, background check, sex-offense restrictions, treatment, vouchers, population, gender, length of stay), and the provider contact block \\(organization, program, phone, email, website, application process)",
  async ({ page }: { page: Page }) => {
    const detail = page.getByTestId("unit-detail");

    const specs = detail.getByRole("region", { name: "Unit details" });
    for (const label of ["Address", "Bedrooms", "Size", "Monthly cost", "Ward"]) {
      await expect(specs.locator("dt").filter({ hasText: label }).first()).toBeVisible();
    }

    const policies = detail.getByRole("region", { name: "Program policies" });
    for (const label of [
      "Referral required",
      "Sobriety required",
      "Background check required",
      "Sex-offense restrictions apply",
      "Treatment required",
      "Housing vouchers accepted",
      "Housing type",
      "Length of stay",
      "Population served",
      "Gender served",
    ]) {
      await expect(policies.locator("dt").filter({ hasText: label }).first()).toBeVisible();
    }

    const contact = detail.getByRole("region", { name: "Contact" });
    for (const label of [
      "Organization",
      "Program",
      "Phone",
      "Email",
      "Website",
      "Application process",
    ]) {
      await expect(contact.locator("dt").filter({ hasText: label }).first()).toBeVisible();
    }
  },
);

When("a policy field is unknown at the source", async ({ page }: { page: Page }) => {
  await openApp(page);
  await expectResultsLoaded(page);
  // The first card's program carries an unknown treatment field in the
  // frozen dataset — the honest-unknown path opens on it.
  await page.locator(".unit-list article button.card-body").first().click();
  await expect(page.getByTestId("unit-detail")).toBeVisible({ timeout: 20_000 });
});

Then(
  'the detail panel displays "not publicly listed" for that field',
  async ({ page }: { page: Page }) => {
    await expect(
      page.getByTestId("unit-detail").getByText("Not publicly listed").first(),
    ).toBeVisible();
  },
);
