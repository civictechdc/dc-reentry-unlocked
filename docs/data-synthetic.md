# Synthetic dataset — generation, provenance, and seed policy

The housing inventory ships with one frozen synthetic dataset,
`data/units.v2.json`: a `Provider → Program → Unit` hierarchy of fictional
providers and programs on real Washington DC geography. This document explains
how it is produced, how the geography corpus is licensed and sourced, and what
the data does and does not guarantee.

## Regenerating the dataset

```sh
pnpm datagen
```

That runs the deterministic generator (`tools/datagen`) against the committed
geography corpus and rewrites `data/units.v2.json`. Regeneration is
byte-identical: run the command as many times as you like, the file does not
change. The regression check after touching the generator or the corpus is:

```sh
pnpm datagen && git diff --exit-code -- data/
```

The freeze test lives in the generator's test suite: if the file on disk
ever stops matching a fresh in-memory regeneration, that failure message
points here.

## Seed policy

- The RNG is hand-rolled [mulberry32], seeded once per run with the fixed
  default seed **20261029** (a pure, 32-bit constant written in the generator
  module). There is no `Math.random`, no crypto and no wall-clock anywhere on
  the generation path.
- Output bytes are a pure function of `(seed, corpus)`. The seed is embedded
  in the dataset's `seed` field; change it deliberately (it becomes part of
  the frozen contract) rather than experimentally.
- Serialization is stable: fixed object-insertion order, 2-space indent,
  trailing newline. Fast-check properties run the full invariant set over an
  explicit seed list (1–5, 42, 1234, 98765, 777 and the default seed) plus an
  arbitrary-seed property over 1..2000, so accidental seed-coupled behavior is
  caught by tests.

The dataset currently carries ~1,200 units (inside the 1,000–1,500 unit
performance envelope the prototype assumes) across 8 wards. Realistic aspects:
roughly three quarters of units are available with the rest not-available or
unverified-availability, both confirmed and needs-verification flags appear,
and every policy or eligibility field carries honest `unknown`
("not publicly listed") states.

## Geography corpus provenance and licensing

The generator runs **offline** on a committed, curated corpus under
`data/geography/` (wards, ZIP polygons, street segments). That corpus is a
modified subset of DC GIS Open Data, built by the committed script
`tools/datagen/scripts/fetch-corpus.mjs` (network access happens only at
corpus-build time, never during dataset generation).

Attribution block (CC BY 4.0 — attribution mandatory for all three datasets):

> - **Wards from 2022** (Washington DC GIS Open Data). Creator: DC Office of
>   Planning; published by the DC Office of the Chief Technology Officer
>   (OCTO).
>   <https://opendata.dc.gov/api/download/v1/items/c5cd8b40fb784548a6680aead5f919ed/geojson?layers=53>
> - **Roadway Block** (Washington DC GIS Open Data). Creator: DC District
>   Department of Transportation (DDOT); published by DC OCTO.
>   <https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/163>
> - **Zip Codes** (Washington DC GIS Open Data). Credited source: U.S.
>   Postal Service (ZIP code areas); published by DC OCTO.
>   <https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Location_WebMercator/MapServer/4>
>
> All three are licensed CC BY 4.0
> (<https://creativecommons.org/licenses/by/4.0/>). This repository modifies
> the source data, per layer: ward and ZIP geometry is filtered and simplified
> (Douglas–Peucker vertex deletion) with coordinates kept at full source
> precision; street-layer geometry is filtered (road-type "Street" with a
> known quadrant), clipped to ward interiors, resampled (≤ 25 m steps) and
> quantized to 5 decimal places (~1 m), carrying only street names,
> street-type words, quadrant and road-type codes and geometry. No source
> field holding address ranges, block names or unique address keys is read or
> carried into the corpus.

OpenStreetMap was deliberately **not** used: its ODbL share-alike terms are
ambiguous for a derived database like this protected dataset.

### How coordinates and addresses are made

- Each unit's coordinates are linearly interpolated
  (`A + t(B − A)`) on a segment of a real street from the Roadway Block layer,
  clipped so the sample lies **strictly inside a single ward polygon** and
  **inside exactly one ZIP polygon** (ward boundaries legally follow street
  centerlines, so boundary-straddling intervals are clipped/skipped). The
  sampled quadrant is the street's own quadrant code (1=NW, 2=NE, 3=SE, 4=SW;
  unknown-ramp/alley/trail road types are excluded).
- Roadway Block carries no ZIP: it is assigned spatially from the ZIP polygon
  layer, matching what lands in the address string.
- Building numbers are **generated, not copied**: each street gets a
  deterministic name-hash-based floor and a ceiling derived from the street's
  own geometry length (~52 ft of frontage per number). Nothing reads real
  listing or address-range, address-point, or MAR-key sources.

## Provenance guarantees and non-guarantees

**Guaranteed:**

- All providers, programs and contacts are fictional and generated from
  generic name-part composition. Phone numbers use the fictional reserved
  exchange `(202) 555-01XX`; websites/emails stay under the reserved
  `example.org` domain so no generated contact can resolve to a real
  endpoint. A machine-local exclusion list (below) is cross-checked when
  present.
- Coordinates always sit on real street geometry, strictly inside their real
  ward boundary, inside exactly one real ZIP, with matching quadrant.
- Building numbers are sampled from per-street ranges derived from street
  geometry length — never from any real listing, address-point, or
  address-range source.

**Not guaranteed:**

- A generated address might coincidentally match a real address (street
  geometries and numbering conventions are real; the numbers are
  generated). Synthetic output **cannot guarantee** that a given generated
  address fails to exist in the real world, and the package never claims
  verified-nonexistence for any address. Treat every unit as synthetic.
- The corpus geometry is simplified/quantized (~1 m), which is why points are
  asserted _strictly inside_ (with a margin) rather than merely inside.

## Fictional-name exclusion list (machine-local)

The collision test reads a maintainable, gitignored list of real DC reentry
housing provider names from:

- `.agents/local/real-providers.txt` beside the repo root, or
- the matching path one level up in the container-style local directory.

The list is maintained from public directories (DC DHS Permanent Supportive
Housing providers, DC CJCC Directory of Housing Resources for Returning
Citizens, CSOSA reentry resources). Only organization **names** are kept —
never addresses, phone numbers, contacts or availability details from those
directories. When the list is absent (fresh clone or CI), the collision test
**skips with an explicit skip reason** rather than failing: the dataset
itself is already fictional-by-construction, and the list check is an extra
belt-and-braces guard maintained locally.

The check compares with strengthened normalization: lowercase, punctuation
stripped, single-letter initialism runs collapsed (so `L.L.C.` and `LLC`
reduce identically), and **generic suffix words stripped iteratively**
(housing, services, house, home(s), center, inc, llc, corp, coalition,
project, group, associates, foundation, trust, ministry, mission, shelter,
place, program, residence(s), village, and a few type-of-org words) — a
fictional name whose suffix-stripped stem equals the stem of a real provider
on the list collides and is rejected. When a new generator/seed does collide
with a real entry, the workflow is: adjust the generator
vocabulary/seed deterministically, regenerate (`pnpm datagen`), and commit
the re-frozen dataset — the test stays local and never silently skips on a
surfaced collision (only a missing/empty list skips; a read error fails
loudly).

The dataset header (`synthetic`, `disclaimer`, `seed`, `generation` in
`data/units.v2.json`) keeps the synthetic disclosure embedded in the file
itself, so the data cannot be mistaken for a real inventory when it travels
out of context. The disclosure fields are part of the frozen contract and
guarded by a test invariant.

## Where things live

| Path                                     | Purpose                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| `tools/datagen/`                         | Generator source, corpus loader, CLI, tests             |
| `tools/datagen/scripts/fetch-corpus.mjs` | Rebuilds `data/geography/` from the DC GIS endpoints    |
| `data/geography/`                        | Committed curated corpus (wards, ZIPs, street segments) |
| `data/units.v2.json`                     | Frozen synthetic dataset — never hand-edit              |
| `packages/shared/`                       | The schemas every generated record conforms to          |

[mulberry32]: https://gist.github.com/tommyettinger/46f8849
