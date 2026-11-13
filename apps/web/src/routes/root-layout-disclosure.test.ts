import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/svelte";
import { SCHEMA_VERSION, SYNTHETIC_DISCLOSURE, UNIT_FILTERS } from "@dc-reentry/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
import { m } from "#lib/paraglide/messages.js";
import RootLayoutHarness from "./root-layout-disclosure.harness.svelte";

// jsdom provides no WebGL canvas, so the page's real MapView cannot mount a
// real MapLibre GL map here. Only the third-party GL engine is stubbed (its
// real-browser behavior is covered by the Playwright e2e layer); MapView and
// every other component stay real.
vi.mock("maplibre-gl", () => {
  class StubMap {
    on() {}
    addSource() {}
    addLayer() {}
    addImage() {}
    setFilter() {}
    flyTo() {}
    jumpTo() {}
    resize() {}
    getLayer(): unknown {
      return undefined;
    }
    getSource(): unknown {
      return undefined;
    }
    project(): { x: number; y: number } {
      return { x: 0, y: 0 };
    }
    queryRenderedFeatures(): unknown[] {
      return [];
    }
    getCenter(): { lng: number; lat: number } {
      return { lng: 0, lat: 0 };
    }
    getZoom(): number {
      return 0;
    }
    remove() {}
  }
  return { Map: StubMap, setWorkerUrl: () => {} };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Fetch double serving the real published filter schema but rejecting the
 * units request at the network level — the same transport failure an
 * unreachable backend produces (requestJson wraps it into ClientError,
 * classified "unreachable" by the housing store).
 */
function stubFetchWithUnreachableUnits(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.pathname === "/filters") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ schemaVersion: SCHEMA_VERSION, filters: UNIT_FILTERS }),
      } as unknown as Response;
    }
    throw new TypeError("fetch failed");
  });
}

describe("the root-layout disclosure banner", () => {
  test("stays rendered with the complete contract sentence when the initial units request fails", async () => {
    // Arrange: no cached units response exists; the initial /units request
    // will reject while the filter schema loads fine
    const fetchMock = stubFetchWithUnreachableUnits();
    vi.stubGlobal("fetch", fetchMock);

    // Act: mount the real root layout with the real page as its children
    render(RootLayoutHarness);

    // The units failure settles into the retry error surface (units stayed
    // unloaded — the store went through its real transport, not a stub)
    await waitFor(() => {
      expect(screen.getByText(m.results_error_headline())).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: m.results_retry() })).toBeInTheDocument();
    const requestedPaths = fetchMock.mock.calls.map(
      ([request]) => new URL(String(request)).pathname,
    );
    expect(requestedPaths).toContain("/units");

    // Assert: the root layout's banner is still in the document, carrying
    // the complete synthetic-data sentence and the catalog heading
    const banner = screen.getByRole("note");
    expect(within(banner as HTMLElement).getByText(SYNTHETIC_DISCLOSURE)).toBeInTheDocument();
    expect(within(banner as HTMLElement).getByText(m.banner_heading())).toBeInTheDocument();
  });
});
