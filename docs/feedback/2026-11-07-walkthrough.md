# Walkthrough record — 2026-11-07 (first synchronous session)

## Context

First guided walkthrough of the running prototype with the project's user,
per the live-walkthrough feedback workflow. The agent drove a headed
Playwright browser (capture harness: `apps/web/e2e/walkthrough.capture.ts`);
the user directed the session and commented in conversation. Two streams
were captured: the user's remarks (below, verbatim and attributed) and the
harness's structured event log; this record synthesizes both.

- **Session 1:** 21:39–21:51 UTC — web `:5173`, API `:3000`. Ended at the
  user's request to restart on a different port.
- **Session 2:** 21:51–23:45 UTC — web `:5190`, API `:3090` (fresh boot;
  see quote 6).
- **Event logs** (machine-local, gitignored, not committed):
  `.scratch/walkthrough/walkthrough-2026-11-07T21-39-33-969Z.json` and
  `.scratch/walkthrough/walkthrough-2026-11-07T21-51-39-293Z.json`.
- All times UTC. Quotes are verbatim (including typos and build-specific
  Svelte hash classes like `svelte-10hude5`; those hashes are
  build-specific — follow-ups below use durable names).

## Session timeline (condensed)

- **21:39** Session 1 boots; initial load fetches all 932 units.
- **21:42–21:49** User explores filters: `sobriety=yes` (437), `ward=8`
  (111), `housing-vouchers=no` (471), `sex-offense-restrictions=yes` (337);
  clicks into unit details; exercises map focus (tile zoom reaches
  address level).
- **~21:50** User reports batch of observations (quotes 1–5) including
  missing pins in a 400x685 device profile.
- **21:51** Session 1 ends; log shows the map-worker failure cascade
  (see friction F3). Restart requested on a new port.
- **21:51** Session 2 boots on `:5190`/`:3090`. No worker errors; pins and
  basemap render normally.
- **21:51–22:02** Mobile-view filter flow via the filter sheet:
  `sobriety=no` (495); ward multi-select `1` (126) → `1&4` (233) →
  `1&4&3` (358); `sex-offense-restrictions=yes` (337), `treatment=no`
  (640), `length-of-stay=short-term…` (257), `referral-required=no` (493).
- **21:55** Zoom-button request and the mobile chip-clipping report
  (quotes 7–8, with the 3-ward state live).
- **22:02** Map/label/filter-control feature batch (quotes 9–12).
- **mid-session** Feature-flag planning spawn (quote 13).
- **23:17–23:20** Detail-card batch: height, height previews, close
  button (quotes 14–16).
- **23:32** Page reload; full list again (932).
- **23:33–23:41** Research batch: no-JS functionality (verified empty
  shell), filter-area design, `tel:` links, tabbed detail card, tetradic
  color scheme, DESIGN.md (quotes 17–22).
- **23:45** User ends the session ("i think that's everythign for now").

## Friction points

- **F1 — Filter application shifts the map.** Applying a filter resizes
  the filter area (applied-chips row), visibly moving the map. The user
  wants the filter area static. (Quote 1.)
- **F2 — Applied-filter chips clipped on the mobile map tab.** With three
  wards applied (ward 1, 4, 3 — 358 results at 21:54), the map tab showed
  only the "Ward 3" chip. (Quote 8.)
- **F3 — Map-worker death in session 1 (dev stack).** After an HMR-error
  reload, MapLibre workers never reloaded: 18 "Worker failed to load"
  console errors and 227 aborted OpenStreetMap tile requests. CSP
  `worker-src 'self'` blocks MapLibre's blob-worker fallback
  (`src/lib/security/csp.ts`; the policy intends a bundled same-origin
  worker). Session 2 was clean (single benign blob-worker console error,
  no cascade) and pins rendered — so the user-visible "no pins at
  400x685" report (quote 5) is attributed to this transient failure, not
  the mobile profile. Session 2 also showed one `blob:` worker CSP
  console error without user impact.
- **F4 — Detail card spans full screen height on large screens** (quote
  14); user wants it shorter, with candidate heights previewed during
  implementation (quote 15).
- **F5 — Close-detail button** uses a wordy label; user wants an icon or
  "×" (quote 16).
- **F6 — Fullscreen header gap (unverified).** User saw a gap right of
  the header at fullscreen (quote 4). The capture harness pins its
  viewport at 1280x720, which can masquerade as exactly this artifact;
  verdict needs a native-browser check before any work follows.
- **F7 — Zero functionality without JavaScript (by architecture).**
  Verified during the session: the SPA shell serves an empty `<body>`;
  the API itself is plain JSON and works without JS. (Quote 17.)
- **F8 — `favicon.ico` 404** in both sessions (dev server).
- **F9 — Full-list refetch churn.** Every load and every filter clear
  refetched the full 932-unit list, twice on initial load (16 and 30
  `filter-applied` events across the sessions; steady-state API latency
  3–40 ms, initial cold fetch 642 ms).

## Positive observations

- Mobile filter flow worked: `Filters` → sheet → multi-ward selection
  felt natural enough that the user moved through 7+ distinct filters
  without confusion remarks.
- Pin labels legible — the user quoted label text verbatim from the
  screen (quote 10's example).
- Map focus to address level (tile zoom 17–20) exercised without remark
  — landed behavior went unremarked, i.e. usable.
- Session 2 ran ~2 hours with one benign console error; no page errors,
  no failed API requests, all filters sub-100 ms.
- No zero-result encounters in either session — also an untested surface
  (see O2).

## Attributed quotes (verbatim, the user)

1. (21:51Z) "when selecting a filter, can we keep the filter area static so the map doesn't move? e.g. chips svelte-10hude5"
2. (21:51Z) "anything we render using JS we can offload to pure, well-formed CSS to help free up the js thread?"
3. (21:51Z) "possibly scroll list to the selected item when the pin is selected?"
4. (21:51Z) "full screen on browser till leaves a gap on the right of the header. It could potentially expand/center the items? verify best practises"
5. (21:51Z) "i don't see pins on the map when switching to 400x685 profile"
6. (21:51Z) "stop the preview and see if you can run it on a different port?"
7. (21:55Z) "we want to have zoom buttons plus/minus on screen too"
8. (21:55Z) "currently im showing mobile view and applied 3 ward filters. On the map tab, i only see ward 3 chip"
9. (22:02Z) "have a 'recenter' which recenters to the configured locale (DC right now, but potentially for other cities later)"
10. (22:02Z) "add the housing title above the address line in the pin label e.g. Westgate Bridge Housing / 1692 MISSOURI AVE NW, 20011"
11. (22:02Z) "can the text in the label be highlightable?"
12. (22:02Z) "move clear-all/reset filters button to be near top line? maybe only appear once there's a filter applied"
13. (mid-session) "add a separate block of tasks to plan a feature flag functionality that we can toggle at command time or potentially at run time for dev builds. The features guarded by feature flags should be stripped from the production or pre-prod/beta builds but kept for dev builds"
14. (23:17Z) "detail card should be vertically shorter rather than spanning the full height of the screen on larger screens - detail svelte-5c6icw"
15. (23:18Z) "for that feature wehn we work on it, we should preview potential height options"
16. (23:20Z) "the close detail button should be an icon or just close e.g. x"
17. (23:33Z) "we should test how functional this will be without javascript (looks like none at all) and see if it is possble to provide some minimal functionality without javascript (if possible)"
18. (23:34Z) "we should research best designs for filter areas - chips vs drop downs/checkboxes etc. See whta best practises are"
19. (23:36Z) "the phone number should be a tel: link"
20. (23:37Z) "research if detail card should tab between main details/contact and policies tab - we should try previews to see if feasable while being accessible/navigable"
21. (23:38Z) "research a tetradic color scheme for the web app that still follows wcag/a11y guidelines"
22. (23:41Z) "research if https://github.com/google-labs-code/design.md will be useful"

## Candidate follow-up items (phrased for citation)

These are inputs for future change proposals, not commitments.

**Map and pins**

- **W1** On-screen map zoom controls (+ / −).
- **W2** Recenter control that re-centers the map on the configured
  locale (DC today; locale should be configuration so other cities can
  follow).
- **W3** Pin label shows the housing title above the address line.
- **W4** Pin-label text selectable/highlightable for copying.
- **W5** Selecting a pin scrolls the unit list to that unit's card.

**Filter UI**

- **W6** Applying/removing filters must not shift the map — the filter
  area stays static (layout-stable applied-chips row or equivalent).
- **W7** Applied-filter chips on the mobile map tab are clipped (three
  wards applied, one chip visible) — wrap, scroll, or a count affordance.
- **W8** Clear-all/reset control near the top line, visible only when
  filters are active.
- **W9** Research filter-area design patterns (chips vs dropdowns vs
  checkboxes; multi-select best practices) before further filter UI work.

**Detail card**

- **W10** Cap detail-card height on large screens; implementation must
  preview candidate height options for the user to choose from.
- **W11** Close-detail control as an icon / "×".
- **W12** Research a tabbed detail card (main details/contact vs
  policies): previewable prototypes, required to stay accessible and
  keyboard-navigable.
- **W13** Render phone numbers as `tel:` links.

**Foundation / engineering**

- **W14** Audit JS-rendered presentation for offload to pure, well-formed
  CSS to reduce main-thread work.
- **W15** Explore minimal no-JS functionality. Verified this session: the
  SPA shell renders no content without JS; the API is plain JSON.
  Architecture-level (SPA mode is the deliberate current posture).
- **W16** Feature-flag mechanism — spawned during this session as a
  proposal-stage change (named by `openspec list`): command-time toggles,
  possibly run-time toggles for dev builds only, flagged code stripped
  from production/pre-prod/beta builds.
- **W17** Design-system research: a tetradic color scheme that meets WCAG
  contrast; evaluate the DESIGN.md format
  (google-labs-code/design.md — YAML design tokens + prose for coding
  agents; its linter checks WCAG contrast ratios) as this repo's
  design-token contract for agents.

**Dev-stack robustness**

- **W18** Make dev map-worker loading resilient: after an HMR-error
  reload the map workers died permanently (blob-worker fallback is
  CSP-blocked; `worker-src 'self'` is deliberate). Prod posture is the
  bundled same-origin worker; dev needs the same reliability.
- **W19** Serve a favicon (404 in every boot observed).
- **W20** Research and investigate the feasibility of monkey testing for
  the web app — spawned during this session as a proposal-stage change
  (named by `openspec list`); user-supplied starting guides: the TestMu,
  QA Source, and TestUnity complete guides to monkey testing.

**Open / unverified**

- **O1** Fullscreen header gap — obtain a native-browser verdict first;
  may be a capture-harness viewport artifact.
- **O2** Zero-result states were never encountered — empty-state UX
  remains untested by a walkthrough.

## Session signal summary

| Signal                                 | Session 1                                             | Session 2                               |
| -------------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| Duration                               | ~12 min                                               | ~1 h 54 min                             |
| Clicks                                 | 41                                                    | 80                                      |
| Filter applications (network-observed) | 16                                                    | 30                                      |
| Zero-result encounters                 | 0                                                     | 0                                       |
| Console errors/warnings                | 21                                                    | 2                                       |
| Failed requests                        | 240 (227 OSM tiles + 13 worker loads, worker cascade) | 802 (OSM tile abort churn; map healthy) |
| Slow requests (>500 ms)                | 1 (initial 932-unit fetch, 642 ms cold)               | 2                                       |
| Page errors                            | 0                                                     | 0                                       |

Production-build instrumentation check (workflow verification): a
production `vite build` of the web app produces 121 files with zero
occurrences of any walkthrough marker — the capture harness ships nothing.

## Review & sign-off

- [x] User reviewed this record and approved it as an accurate account of
      their session and feedback (2026-11-07: "looks good").
