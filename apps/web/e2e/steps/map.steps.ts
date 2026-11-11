import { expect, type Page } from "@playwright/test";
import { CARD_FOCUS_ZOOM } from "../../src/lib/map/map-config.ts";

/** Readiness window for the flyTo landing, shared by the map specs. */
export const FOCUS_WAIT = { timeout: 20_000 };
export const API_BASE = process.env.VITE_API_URL ?? "http://localhost:3000";
/** flyTo lands exactly on the pin; the tolerance absorbs serialization only. */
export const NEARNESS_TOLERANCE = 1e-4;

/** The unit fields the camera helpers read; the served payload is larger. */
export type CameraUnit = {
  id: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
};

/**
 * The unit behind the first card: the card's heading anchor carries the unit
 * id (`card-title-<unit.id>`), which resolves unambiguously against the
 * served result set even where addresses repeat across programs.
 */
export async function unitBehindFirstCard(page: Page): Promise<CameraUnit> {
  const article = page.getByRole("article").first();
  const labelledby = await article.getAttribute("aria-labelledby");
  expect(labelledby, "card heading anchor embeds the unit id").toContain("card-title-");
  const unitId = labelledby!.replace(/^card-title-/, "");
  const response = await page.request.get(`${API_BASE}/units`);
  expect(response.ok(), "the units endpoint answers for the camera helper").toBeTruthy();
  const { units } = (await response.json()) as { units: CameraUnit[] };
  const unit = units.find((candidate) => candidate.id === unitId);
  expect(unit, "the selected card's unit is in the served result set").toBeTruthy();
  return unit!;
}

/** A pin center in canvas-local CSS px (the map attribute's coordinate space). */
export type PinPoint = { x: number; y: number };

/**
 * Parses the map section's `data-pin-points` attribute (`"x,y;x,y"` — the
 * projected canvas-local centers of every rendered pin, refreshed on
 * `moveend` and unit-set changes) into points. Empty string → empty array.
 * A malformed pair throws loudly: the viewport filters below would
 * otherwise silently drop an unparseable pin.
 */
export function parsePinPoints(attribute: string | null): PinPoint[] {
  return (attribute ?? "")
    .split(";")
    .filter((pair) => pair.trim().length > 0)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number) as [number, number];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`malformed pin-point pair in data-pin-points: "${pair}"`);
      }
      return { x, y };
    });
}

/** The camera settled on the unit's pin: focus zoom, center within tolerance. */
export async function expectCameraFocusedOn(page: Page, unit: CameraUnit): Promise<void> {
  const map = page.getByTestId("map-view");
  await expect(map).toHaveAttribute("data-map-zoom", String(CARD_FOCUS_ZOOM), FOCUS_WAIT);
  const [lng, lat] = (await map.getAttribute("data-map-center"))!.split(",").map(Number) as [
    number,
    number,
  ];
  expect(
    Math.abs(lng - unit.coordinates.longitude),
    "camera longitude sits on the unit's pin",
  ).toBeLessThan(NEARNESS_TOLERANCE);
  expect(
    Math.abs(lat - unit.coordinates.latitude),
    "camera latitude sits on the unit's pin",
  ).toBeLessThan(NEARNESS_TOLERANCE);
}
