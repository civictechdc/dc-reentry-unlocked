/**
 * Fast-check model-based test of the map↔card hover/selection precedence,
 * including the dismissal state machine. Generated command sequences drive
 * the REAL handlers (mocked-maplibre click dispatch, mounted unit-card
 * buttons, sr pin buttons, detail close button, window Escape) over one
 * mounted tree — map, cards, and detail slide-over sharing the uiState
 * singleton — while an independent model replicates each call site's
 * semantics. After EVERY command the uiState triple must equal the model,
 * the label and highlight layers' current filters must follow hover-then-
 * selection precedence — never a stale pin hover left behind by an earlier
 * interaction — the detail panel must be present exactly while a selection
 * is open, and keyboard focus must rest where the model predicts.
 *
 * The model carries the close semantics: closing (close button, Escape, or
 * the canvas click-off) nulls every identity, then the close edge restores
 * focus to the opening control and re-clears the hover slot that
 * restoration lights — so after any close command the observable hover id
 * is null even though focus sits on the opener.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import { fc, test as fcTest } from "@fast-check/vitest";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { afterEach, describe, expect, vi } from "vitest";
import { tick } from "svelte";
import { m as messages } from "#lib/paraglide/messages.js";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { uiState } from "#lib/state/ui-state.svelte.ts";
import { highlightLayerFilter, pinLabelLayerFilter } from "#lib/map/map-config.ts";

/**
 * maplibre-gl is mocked (same surface the wrapper exercises): the recorded
 * map captures source/layer mutations and exposes controllable click
 * dispatch — layer-scoped handlers fire via `clickPin`, map-wide handlers
 * via `clickCanvas`, with the hit-test stub settable per test.
 */
const h = vi.hoisted(() => ({
  instances: [] as Array<{
    sources: Map<string, { data: unknown; setDataCount: number }>;
    layers: Array<Record<string, unknown>>;
    styleLoaded: boolean;
    fireLoad(): void;
    setFilterLog: unknown[];
    flyToLog: Array<Record<string, unknown>>;
    clickPin: (unitId: string) => void;
    clickCanvas: (x: number, y: number) => void;
    queryRenderedFeaturesResult: Array<Record<string, unknown>>;
  }>,
}));

vi.mock("maplibre-gl", () => {
  class MockSource {
    data: unknown;
    setDataCount = 0;
    constructor(data: unknown) {
      this.data = data;
    }
    setData(data: unknown): void {
      this.data = data;
      this.setDataCount += 1;
    }
  }
  class MockMap {
    sources = new Map<string, MockSource>();
    layers: Array<Record<string, unknown>> = [];
    styleLoaded = false;
    loadHandlers: Array<() => void> = [];
    moveendHandlers: Array<() => void> = [];
    setFilterLog: unknown[] = [];
    flyToLog: Array<Record<string, unknown>> = [];
    clickHandlers: unknown[] = [];
    mapWideClickHandlers: unknown[] = [];
    queryRenderedFeaturesResult: Array<Record<string, unknown>> = [];

    constructor(_options: Record<string, unknown>) {
      h.instances.push(this);
    }
    on(event: string, a: unknown, b?: unknown): void {
      if (event === "load" && typeof a === "function") {
        this.loadHandlers.push(a as () => void);
      } else if (event === "moveend" && typeof a === "function") {
        this.moveendHandlers.push(a as () => void);
      } else if (event === "click" && typeof b === "function") {
        this.clickHandlers.push(b);
      } else if (event === "click" && typeof a === "function") {
        this.mapWideClickHandlers.push(a);
      }
    }
    fireLoad(): void {
      const handlers = this.loadHandlers;
      this.loadHandlers = [];
      for (const handler of handlers) handler();
    }
    flyTo(options: Record<string, unknown>): void {
      this.flyToLog.push(options);
    }
    getCenter(): { lng: number; lat: number } {
      return { lng: 0, lat: 0 };
    }
    getZoom(): number {
      return 0;
    }
    isStyleLoaded(): boolean {
      return this.styleLoaded;
    }
    getSource(id: string): MockSource | undefined {
      return this.sources.get(id);
    }
    getLayer(id: string): Record<string, unknown> | undefined {
      return this.layers.find((layer) => layer.id === id);
    }
    addSource(id: string, definition: { data: unknown }): void {
      this.sources.set(id, new MockSource(definition.data));
    }
    addLayer(layer: Record<string, unknown>): void {
      this.layers.push(layer);
    }
    addImage(_id: string, _image: unknown, _options?: unknown): void {}
    setFilter(id: string, filter: unknown): void {
      this.setFilterLog.push({ layerId: id, filter });
      const layer = this.layers.find((candidate) => candidate.id === id);
      if (layer) layer.filter = filter;
    }
    remove(): void {}
    clickPin(unitId: string): void {
      for (const handler of this.clickHandlers) {
        (handler as (event: { features: unknown[] }) => void)({
          features: [{ properties: { id: unitId } }],
        });
      }
    }
    clickCanvas(x: number, y: number): void {
      for (const handler of this.mapWideClickHandlers) {
        (handler as (event: { point: { x: number; y: number } }) => void)({ point: { x, y } });
      }
    }
    queryRenderedFeatures(
      _point?: { x: number; y: number },
      _options?: { layers?: string[] },
    ): unknown[] {
      return this.queryRenderedFeaturesResult;
    }
  }
  return { Map: MockMap, setWorkerUrl: () => {} };
});

import DetailSlideOver from "./DetailSlideOver.svelte";
import MapView from "./MapView.svelte";
import UnitCard from "./UnitCard.svelte";

const UNIT_IDS = ["unit-a", "unit-b", "unit-c"] as const;

/** The control the detail's close edge would hand keyboard focus back to. */
type Trigger = { kind: "card" | "pin"; unitId: string };

/**
 * Independent model of the three identity fields the precedence reads, plus
 * the close-path bookkeeping: which control holds the focus return
 * (`trigger`) and which card/pin button currently holds keyboard focus
 * (`focusOn`) — both silently move hover state, so the model must track them
 * to predict the observable identity after every command.
 */
type Model = {
  hoveredCard: string | null;
  hoveredPin: string | null;
  selected: string | null;
  trigger: Trigger | null;
  focusOn: `card:${string}` | `pin:${string}` | null;
};
type Real = { created: (typeof h.instances)[number]; unitIds: string[] };

class FakeTransport {
  async filters() {
    return UNIT_FILTERS;
  }
  async units() {
    return UNIT_IDS.map((id, index) =>
      aUnit()
        .withId(id)
        .inWard(index + 1)
        .withCoordinates(38.9, -77.03)
        .build(),
    );
  }
}

/** The card list's button for one unit, found through the unit's labelled title. */
function cardButtonFor(unitId: string): HTMLButtonElement {
  const article = document.getElementById(`card-title-${unitId}`)?.closest("article");
  const button = article?.querySelector("button");
  if (!button) throw new Error(`card button for unit ${unitId} not found`);
  return button as HTMLButtonElement;
}

/** The sr pin-list button for one unit, keyed by the units' store order. */
function pinButtonFor(real: Real, unitId: string): HTMLButtonElement {
  const buttons = document.querySelectorAll('[data-testid="map-pin-list"] button');
  const index = real.unitIds.indexOf(unitId);
  const button = buttons[index];
  if (!button) throw new Error(`pin button for unit ${unitId} not found`);
  return button as HTMLButtonElement;
}

/**
 * The label layer's current filter: the stored layer mirrors the latest
 * setFilter call, and before any setFilter has run it holds the attach-time
 * initial filter — either way the value the precedence must produce.
 */
function currentLabelFilter(real: Real): unknown {
  return real.created.layers.find((layer) => layer.id === "units-pins-label")?.filter;
}

/** The highlight layer's current filter (the stored layer mirrors the latest call). */
function currentHighlightFilter(real: Real): unknown {
  return real.created.layers.find((layer) => layer.id === "units-pins-highlight")?.filter;
}

/** The button the model believes holds keyboard focus, resolved in the DOM. */
function focusedButtonFor(focusOn: NonNullable<Model["focusOn"]>, real: Real): HTMLButtonElement {
  const [kind, unitId] = focusOn.split(":") as ["card" | "pin", string];
  return kind === "card" ? cardButtonFor(unitId) : pinButtonFor(real, unitId);
}

/**
 * The invariant after every command: the state triple and both layer
 * filters match the model, the detail panel is present exactly while a
 * selection is open, the focus-return trigger lives exactly as long as the
 * selection it opened, and keyboard focus rests where the model predicts.
 */
function verifyAgainstModel(m: Model, real: Real): void {
  const labeledUnit = m.hoveredCard ?? m.hoveredPin ?? m.selected;
  expect(uiState.hoveredCardUnitId).toBe(m.hoveredCard);
  expect(uiState.hoveredPinUnitId).toBe(m.hoveredPin);
  expect(uiState.selectedUnitId).toBe(m.selected);
  expect(screen.queryByTestId("unit-detail") !== null).toBe(m.selected !== null);
  expect(uiState.detailTriggerElement === null).toBe(m.selected === null);
  expect(currentLabelFilter(real)).toEqual(pinLabelLayerFilter(labeledUnit));
  expect(currentHighlightFilter(real)).toEqual(highlightLayerFilter(labeledUnit));
  if (m.focusOn !== null) {
    expect(document.activeElement).toBe(focusedButtonFor(m.focusOn, real));
  }
}

/**
 * The detail panel grabbing focus on a FRESH open blurs whichever button
 * held focus, and that button's own handler clears its hover slot. A
 * re-selection while the panel is already open does not re-grab focus (the
 * panel-presence derived value is unchanged), so focus — and hover — stay
 * untouched there.
 */
function focusLostToFreshlyOpenedPanel(m: Model): void {
  if (m.focusOn !== null) m.hoveredCard = null;
  m.focusOn = null;
}

/**
 * Empty-canvas click-off: the one dismissal action of the state machine.
 * The map-wide handler clears every identity; an open detail additionally
 * closes, restoring focus to the opening control whose focus slot the close
 * re-clears — so the observable state after one click-off is fully
 * dismissed, with focus resting on the opener and nothing able to re-light.
 */
const canvasClickOffCommand = {
  check: (): boolean => true,
  run: async (m: Model, real: Real): Promise<void> => {
    const wasSelected = m.selected;
    // No pin rendered under the click point: the dismissal path fires.
    real.created.queryRenderedFeaturesResult = [];
    real.created.clickCanvas(12, 34);
    m.hoveredCard = null;
    m.hoveredPin = null;
    m.selected = null;
    if (wasSelected !== null) {
      m.focusOn = `${m.trigger!.kind}:${m.trigger!.unitId}`;
      m.trigger = null;
    }
    await tick();
    verifyAgainstModel(m, real);
  },
  toString: () => "canvasClickOff()",
};

/** Model semantics of every call site, driven through the real handler. */
const commands = [
  ...UNIT_IDS.map((unitId) =>
    fc.constant({
      check: (): boolean => true,
      run: async (m: Model, real: Real): Promise<void> => {
        const wasClosed = m.selected === null;
        real.created.clickPin(unitId);
        m.hoveredPin = unitId;
        m.selected = unitId;
        m.trigger = { kind: "pin", unitId };
        if (wasClosed) focusLostToFreshlyOpenedPanel(m);
        await tick();
        verifyAgainstModel(m, real);
      },
      toString: () => `canvasPinClick(${unitId})`,
    }),
  ),
  ...UNIT_IDS.map((unitId) =>
    fc.constant({
      check: (): boolean => true,
      run: async (m: Model, real: Real): Promise<void> => {
        const wasClosed = m.selected === null;
        pinButtonFor(real, unitId).click();
        m.hoveredPin = null;
        m.selected = unitId;
        m.trigger = { kind: "pin", unitId };
        if (wasClosed) focusLostToFreshlyOpenedPanel(m);
        await tick();
        verifyAgainstModel(m, real);
      },
      toString: () => `pinButtonClick(${unitId})`,
    }),
  ),
  ...UNIT_IDS.map((unitId) =>
    fc.constant({
      check: (): boolean => true,
      run: async (m: Model, real: Real): Promise<void> => {
        const wasClosed = m.selected === null;
        cardButtonFor(unitId).click();
        m.hoveredPin = null;
        m.selected = unitId;
        m.trigger = { kind: "card", unitId };
        if (wasClosed) focusLostToFreshlyOpenedPanel(m);
        await tick();
        verifyAgainstModel(m, real);
      },
      toString: () => `cardClick(${unitId})`,
    }),
  ),
  ...UNIT_IDS.map((unitId) =>
    fc.constant({
      check: (): boolean => true,
      run: async (m: Model, real: Real): Promise<void> => {
        cardButtonFor(unitId).dispatchEvent(new MouseEvent("pointerenter"));
        m.hoveredCard = unitId;
        await tick();
        verifyAgainstModel(m, real);
      },
      toString: () => `cardHover(${unitId})`,
    }),
  ),
  fc.constant({
    check: (): boolean => true,
    run: async (m: Model, real: Real): Promise<void> => {
      cardButtonFor(UNIT_IDS[0]).dispatchEvent(new MouseEvent("pointerleave"));
      m.hoveredCard = null;
      await tick();
      verifyAgainstModel(m, real);
    },
    toString: () => "cardUnhover()",
  }),
  ...UNIT_IDS.map((unitId) =>
    fc.constant({
      check: (): boolean => true,
      run: async (m: Model, real: Real): Promise<void> => {
        const focusKey = `card:${unitId}` as const;
        cardButtonFor(unitId).focus();
        if (m.focusOn !== focusKey) {
          // blurring the previously focused button clears its hover slot;
          // the newly focused card lights its own
          m.hoveredCard = unitId;
          m.focusOn = focusKey;
        }
        await tick();
        verifyAgainstModel(m, real);
      },
      toString: () => `focusCard(${unitId})`,
    }),
  ),
  fc.constant({
    check: (): boolean => true,
    run: async (m: Model, real: Real): Promise<void> => {
      (document.activeElement as HTMLElement | null)?.blur();
      if (m.focusOn !== null) {
        // the blurred button's own handler clears its hover slot
        m.hoveredCard = null;
        m.focusOn = null;
      }
      await tick();
      verifyAgainstModel(m, real);
    },
    toString: () => "blurFocus()",
  }),
  fc.constant({
    check: (m: Model): boolean => m.selected !== null,
    run: async (m: Model, real: Real): Promise<void> => {
      const trigger = m.trigger!;
      // the close button dismisses every identity; the close edge then
      // restores focus to the opening control and re-clears the hover slot
      // that restoration lights
      screen.getByRole("button", { name: messages.detail_close() }).click();
      m.hoveredCard = null;
      m.hoveredPin = null;
      m.selected = null;
      m.focusOn = `${trigger.kind}:${trigger.unitId}`;
      m.trigger = null;
      await tick();
      verifyAgainstModel(m, real);
    },
    toString: () => "closeButton()",
  }),
  fc.constant({
    check: (m: Model): boolean => m.selected !== null,
    run: async (m: Model, real: Real): Promise<void> => {
      const trigger = m.trigger!;
      // Escape runs the same close path as the close button: identical
      // dismissal semantics, identical focus restoration
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      m.hoveredCard = null;
      m.hoveredPin = null;
      m.selected = null;
      m.focusOn = `${trigger.kind}:${trigger.unitId}`;
      m.trigger = null;
      await tick();
      verifyAgainstModel(m, real);
    },
    toString: () => "escapeKey()",
  }),
  fc.constant(canvasClickOffCommand),
];

/**
 * Fresh model run: reset the shared uiState singleton between generated
 * runs (initialization only — no command drives behavior through raw
 * writes), then mount the map, the cards, and the detail slide-over over a
 * resolved store and play the healthy first-load sequence.
 */
async function setupModelRun(): Promise<{ model: Model; real: Real }> {
  uiState.hoveredCardUnitId = null;
  uiState.hoveredPinUnitId = null;
  uiState.selectedUnitId = null;
  uiState.detailTriggerElement = null;
  cleanup();
  h.instances.length = 0;

  const store = new HousingStore(new FakeTransport() as never);
  await store.initialize();
  render(MapView, { props: { store } });
  for (const unit of store.units ?? []) {
    render(UnitCard, { props: { card: unit } });
  }
  // the detail slide-over joins the tree so the close paths (close button,
  // Escape, canvas click-off) and their focus restoration are live behavior
  render(DetailSlideOver, { props: { store } });
  await tick();
  const created = h.instances.at(0)!;
  created.styleLoaded = true;
  created.fireLoad();
  await tick();

  return {
    model: {
      hoveredCard: null,
      hoveredPin: null,
      selected: null,
      trigger: null,
      focusOn: null,
    } satisfies Model,
    real: { created, unitIds: [...UNIT_IDS] } satisfies Real,
  };
}

/**
 * The full terminal-state predicate: every identity cleared, the detail
 * panel gone, both layer filters on the explicit no-match, the focus-return
 * trigger dropped — and a further settle proving the focus restoration
 * cannot re-light anything.
 */
async function expectAllDismissedTerminalState(real: Real): Promise<void> {
  expect(uiState.hoveredCardUnitId).toBeNull();
  expect(uiState.hoveredPinUnitId).toBeNull();
  expect(uiState.selectedUnitId).toBeNull();
  expect(uiState.detailTriggerElement).toBeNull();
  expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
  expect(currentLabelFilter(real)).toEqual(pinLabelLayerFilter(null));
  expect(currentHighlightFilter(real)).toEqual(highlightLayerFilter(null));
  await tick();
  expect(uiState.hoveredCardUnitId).toBeNull();
  expect(currentLabelFilter(real)).toEqual(pinLabelLayerFilter(null));
  expect(currentHighlightFilter(real)).toEqual(highlightLayerFilter(null));
}

describe("map selection precedence and dismissal convergence (fc.commands + asyncModelRun)", () => {
  afterEach(() => {
    cleanup();
    h.instances.length = 0;
    uiState.hoveredCardUnitId = null;
    uiState.hoveredPinUnitId = null;
    uiState.selectedUnitId = null;
    uiState.detailTriggerElement = null;
  });

  fcTest.prop(
    { commandSequence: fc.commands(commands, { size: "small" }) },
    // The vitest per-test timeout is the inner call's third argument
    // (`@fast-check/vitest`), NOT a fast-check parameter — a `timeout` key
    // in the params object is ignored by fast-check, leaving vitest's
    // 5-second default to flake cold runs red.
    { numRuns: 100 },
  )(
    "for any interaction sequence, the labeled unit follows hover-then-selection precedence, never a stale pin hover; the detail panel and focus-return trigger track the selection; and keyboard focus rests where the model predicts",
    async ({ commandSequence }) => {
      await fc.asyncModelRun(setupModelRun, commandSequence);
    },
    120_000,
  );

  fcTest.prop({ commandSequence: fc.commands(commands, { size: "small" }) }, { numRuns: 100 })(
    "any interaction sequence followed by one empty-canvas click-off converges to the all-dismissed terminal state",
    async ({ commandSequence }) => {
      let realHandle: Real;
      // asyncModelRun returns void, so the setup closure captures the real
      // handle for the explicit terminal-state predicate after the run
      await fc.asyncModelRun(async () => {
        const state = await setupModelRun();
        realHandle = state.real;
        return state;
      }, [...Array.from(commandSequence), canvasClickOffCommand]);
      await expectAllDismissedTerminalState(realHandle!);
    },
    120_000,
  );
});
