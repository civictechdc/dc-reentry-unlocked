/** View-level UI state shared between the map, the card list, and detail. */

/** Which mobile view is active (phone-width tabs); desktop shows both. */
export type MobileTab = "map" | "list";

class UiState {
  /** Unit currently hovered/focused in the card list — the map pin highlights. */
  hoveredCardUnitId: string | null = $state.raw(null);
  /** Unit whose map pin is selected — the matching card highlights. */
  hoveredPinUnitId: string | null = $state.raw(null);
  /** Unit whose detail slide-over is open (selected card or pin). */
  selectedUnitId: string | null = $state.raw(null);
  /** Phone-width tab state. */
  mobileTab: MobileTab = $state.raw("map");
  /** Mobile filter sheet open state. */
  filterSheetOpen: boolean = $state.raw(false);
}

export const uiState = new UiState();
