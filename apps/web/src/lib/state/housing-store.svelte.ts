import type { FilterDefinition, UnitCard } from "@dc-reentry/shared";
import { ApiError, ClientError, housingApi, type HousingTransport } from "#lib/api/client.js";
import { buildUnitsQueryPath } from "#lib/api/query.js";
import {
  newSelection,
  reconcileSelection,
  reduceSelection,
  type SelectionAction,
} from "#lib/api/selection.js";

/** The control types this interface can render. Anything else degrades: hidden, never crashing. */
export const SUPPORTED_CONTROLS = ["boolean", "single-select", "multi-select"] as const;

export type LoadPhase = "idle" | "loading" | "ready" | "error";

export type LoadFailureReason = "unreachable" | "server" | "unexpected";

/** Distinguishes a backend envelope failure from a transport failure from a bug. */
function classifyFailure(cause: unknown): LoadFailureReason {
  if (cause instanceof ApiError) return "server";
  if (cause instanceof ClientError) return "unreachable";
  return "unexpected";
}

export interface LoadFailure {
  scope: "schema" | "units";
  reason: LoadFailureReason;
}

/** One active selection rendered as a chip substance (labels resolved in the view). */
export interface ActiveChip {
  filterId: string;
  value: string;
}

class HousingStore {
  units: UnitCard[] | null = $state.raw(null);
  phase: LoadPhase = $state.raw("idle");
  failure: LoadFailure | null = $state.raw(null);
  filtersSchema: FilterDefinition[] = $state.raw([]);
  selection: Record<string, string[]> = $state.raw(newSelection());

  #transport: HousingTransport;
  #refreshCycle: Promise<void> | null = null;
  #refetchRequestedWhileInFlight = false;

  constructor(transport: HousingTransport = housingApi) {
    this.#transport = transport;
  }

  /**
   * Filters this interface actually renders. A definition with an
   * unsupported control type is absent here (graceful degradation) instead
   * of crashing the bar.
   */
  #renderableFilters(): FilterDefinition[] {
    return this.filtersSchema.filter((definition) =>
      (SUPPORTED_CONTROLS as readonly string[]).includes(definition.control),
    );
  }

  async apply(action: SelectionAction): Promise<void> {
    const next = reconcileSelection(
      reduceSelection(this.selection, action),
      this.#renderableFilters(),
    );
    this.selection = next;
    await this.refresh();
  }

  /** Remove one chip's value exactly (zero-results panel: chip-by-chip removal). */
  removeChip(chip: ActiveChip): Promise<void> {
    return this.apply({ kind: "remove-value", filterId: chip.filterId, value: chip.value });
  }

  clearAll(): Promise<void> {
    return this.apply({ kind: "clear" });
  }

  async initialize(): Promise<void> {
    if (this.filtersSchema.length === 0) {
      try {
        this.filtersSchema = await this.#transport.filters();
        this.selection = reconcileSelection(this.selection, this.#renderableFilters());
      } catch (cause) {
        this.failure = { scope: "schema", reason: classifyFailure(cause) };
        this.phase = "error";
        return;
      }
    }
    await this.refresh();
  }

  /**
   * Re-fetch the filter schema after a schema failure (the retry affordance)
   * — a schema that grew or shrank between fetches reconciles the active
   * selection: removed filters' selections are discarded gracefully.
   */
  async reloadSchema(): Promise<void> {
    this.filtersSchema = [];
    await this.initialize();
  }

  async refresh(): Promise<void> {
    if (this.#refreshCycle) {
      // A change arrived while a refresh is in flight — the in-flight cycle
      // drains the request below instead of interleaving stale results.
      this.#refetchRequestedWhileInFlight = true;
      return this.#refreshCycle;
    }
    this.phase = "loading";
    const cycle = this.#drainRequests();
    this.#refreshCycle = cycle;
    try {
      await cycle;
    } finally {
      this.#refreshCycle = null;
    }
  }

  async #drainRequests(): Promise<void> {
    do {
      this.#refetchRequestedWhileInFlight = false;
      await this.#refetch();
    } while (this.#refetchRequestedWhileInFlight);
  }

  async #refetch(): Promise<void> {
    try {
      const path = buildUnitsQueryPath(this.selection, this.#renderableFilters());
      const units = await this.#transport.units(path);
      this.units = units;
      this.failure = null;
      this.phase = "ready";
    } catch (cause) {
      // Honest degradation: the failing refresh never destroys the last
      // successfully rendered results — the retry banner takes over.
      this.failure = { scope: "units", reason: classifyFailure(cause) };
      this.phase = "error";
    }
  }
}

/** The component-consumed instance (constructed with the real API transport). */
export const housingStore = new HousingStore();

export { HousingStore };
