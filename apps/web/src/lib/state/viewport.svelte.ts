/** Phone-width detection for the mobile tabbed layout (SSR-safe default: desktop). */

const PHONE_QUERY = "(max-width: 768px)";

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
