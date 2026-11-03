# Design

## Context

The legend (MapView.svelte, one entry since the approximate entry's removal)
renders `map_legend_title` ("What the pins mean") + `map_legend_exact`
("Exact address"). The component test pins the single-entry shape and the
exact-pin copy.

## Decisions

**D1 — Copy: "Available unit."** It is the true semantics: the listing
serves only available units, and every pin corresponds to a served card.
Alternatives considered: "Available unit at exact address" (true but
wordy — exactness is now ambient, not a legend-worthy distinction);
"Unit" (weaker — availability is the useful signal).

**D2 — Rename the key with the copy** (`map_legend_exact` → e.g.
`map_legend_unit`): leaving an `_exact` identifier carrying
"Available unit" is drift-by-name. The rename touches only the message
catalog, the one MapView reference, and the test vocabulary.

**D3 — Test honesty.** The single-entry pin keeps its structural
assertions (one `.legend-item`, no approximate entry, no dead keys via the
i18n audit); its name and copy assertions move to the new vocabulary.

## Risks / Trade-offs

- [Taste] One-word product copy; wrong-guess cost is one message value,
  walkthrough-adjustable.
