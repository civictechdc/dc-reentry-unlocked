import { createBdd } from "playwright-bdd";

/**
 * playwright-bdd step constructors: `createBdd()` (without a custom test)
 * binds Given/When/Then to the library's own Playwright test — the
 * playwright-style step definitions the generated suite runs with.
 */
export const { Given, When, Then } = createBdd();
