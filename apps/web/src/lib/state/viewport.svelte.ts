/** Phone-width detection for the mobile tabbed layout (SSR-safe default: desktop). */

// 900px boundary (portrait tablets 768–899 stay phone-form; 900 itself is
// desktop): the 0.02px epsilon hands the boundary width to the desktop grid.
// CSS cannot consume this constant, so the structural tests enforce the
// equality instead — the detail sheet's media query is pinned equal to this
// value, and drift would leave in-between viewport widths a mixed
// phone/desktop layout.
export const PHONE_QUERY = "(max-width: 899.98px)";

class ViewportState {
  isPhone = $state(false);

  constructor() {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(PHONE_QUERY);
    this.isPhone = query.matches;
    query.addEventListener("change", (event) => {
      this.isPhone = event.matches;
    });
  }
}

export const viewportState = new ViewportState();
