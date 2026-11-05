# Design

## Context

The Studio change (archived before this one) established the pattern: the
bedrooms VALUE on the card line and detail row is a per-surface function of
the pair (bedrooms, roomType) — `detail-values.ts` exports
`cardBedroomsValue` / `detailBedroomsValue`, with the pair decision
single-sourced in `isStudioPresentation`-style private helpers and per-surface
numeric fallbacks. The card shows the program-level housing type, not the
unit room type, so the shared-room nature of a 0BR unit is currently
invisible on the card.

## Goals / Non-Goals

**Goals:**
- A 0BR shared-room reads as a bed offer, not missing data
- Same pattern, same surfaces, same test doctrine as Studio

**Non-Goals:**
- No contract/data change; no room-type line added to the card (a future
  change could surface room type explicitly if walkthrough feedback still
  wants it after this lands)

## Decisions

**D1 — Vocabulary: "Bed available"** (user example, walkthrough 2026-11-03).
Alternatives considered: "Bed in shared room" (clearest but long for the
card's spec line), "Shared room" (describes the room, not the offer). The
detail row may carry the longer form if implementation finds the line has
room; the card keeps the short form. Revisit only with user feedback from a
walkthrough.

**D2 — Sibling pair-mapping, not a lookup table.** A second private
pair-check (bedrooms === 0 && roomType === "shared-room") beside the Studio
check in `detail-values.ts`, with one new message key. Two explicit
pair-checks read better than a generalized (bedrooms, roomType) → label
table while there are exactly two special pairs; generalize at three.

**D3 — sr-only dt label stays "Bedrooms".** The line remains the bedrooms
dimension of the spec list; screen readers hear "Bedrooms: Bed available",
which is honest. Introducing a second sr-only label per room type fragments
the spec list the detail steps iterate.

## Risks / Trade-offs

- [Vocabulary taste] "Bed available" is a product-voice choice; wrong-guess
  cost is one message-key value, trivially revisable (walkthrough-verifiable).
- [Pin coupling] The shared-room numeric pins from the Studio change must
  FLIP to expect "Bed available" — the pins that guarded against
  over-widening now pin the widened-intentionally behavior; new pins guard
  the remaining numeric case (1BR private-room) and Studio absence on
  shared-room cards.
