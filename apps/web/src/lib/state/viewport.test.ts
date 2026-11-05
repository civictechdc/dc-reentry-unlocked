import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Structural pin for the phone/desktop boundary: the tabbed phone form owns
 * everything below 900px (portrait tablets included) and the desktop grid
 * owns 900px itself. jsdom cannot lay out media queries, so the registered
 * query string and the match flipping are asserted directly.
 */
const matchMedia = vi.hoisted(() => vi.fn());

const originalMatchMedia = window.matchMedia;
/** The boundary the mock simulates matching; asserted identical to the
    exported `PHONE_QUERY` below so the mock and the real query cannot drift. */
const matchedBoundary = "(max-width: 899.98px)";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.resetModules();
});

describe("the phone viewport boundary", () => {
  test("keeps portrait tablets on the tabbed phone form below 900px and hands the 900px boundary to the desktop grid", async () => {
    let changeListener: ((event: { matches: boolean }) => void) | undefined;
    matchMedia.mockImplementation((query: string) => ({
      matches: query === matchedBoundary,
      media: query,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        changeListener = listener;
      },
      removeEventListener: () => {},
    }));
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    const { viewportState, PHONE_QUERY } = await import("#lib/state/viewport.svelte.ts");

    expect(PHONE_QUERY).toBe(matchedBoundary);
    expect(matchMedia).toHaveBeenCalledWith(PHONE_QUERY);
    expect(viewportState.isPhone).toBe(true);

    changeListener?.({ matches: false });
    expect(viewportState.isPhone).toBe(false);

    changeListener?.({ matches: true });
    expect(viewportState.isPhone).toBe(true);
  });

  test("defaults to the desktop grid where matchMedia is unavailable", async () => {
    delete (window as { matchMedia?: unknown }).matchMedia;

    const { viewportState } = await import("#lib/state/viewport.svelte.ts");

    expect(viewportState.isPhone).toBe(false);
  });
});
