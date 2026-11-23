# W9 — Filter-area design patterns

Research date: 2026-11-18. Scope: design research for the filter-area
planning session (change: filter-area-layout), not an implementation plan
or specification. Sources cited inline; app-specific synthesis is marked as
such.

## Findings

**Use chips and selection controls together, not as competing alternatives.** Checkboxes or multi-select controls let people choose criteria; removable applied-filter chips summarize choices and support quick removal. PatternFly explicitly recommends filter labels when selected values are otherwise hidden, particularly for multi-selection. [PatternFly: Filter labels](https://www.patternfly.org/patterns/filters/design-guidelines/#filter-labels)

**For this app, stability and complete access to selections matter more than replacing every control.** Reserved summary space plus explicit overflow access addresses F1 and F2 directly. This is an application-specific synthesis of layout-stability guidance, tag-overflow patterns, and accessibility requirements—not a universally proven filter layout. [web.dev: Reserve space](https://web.dev/articles/optimize-cls#reserve_space_for_late-loading_content), [Carbon: Tags](https://carbondesignsystem.com/components/tag/usage/), [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## 1. Patterns compared

Map-and-list strengths and weaknesses below are contextual analysis; linked sources establish component behavior and general guidance, not comparative research on this particular housing-search audience.

| Pattern | Strengths for this app | Weaknesses and cautions |
|---|---|---|
| **Applied-filter chips** | Keep active constraints visible after controls close; remove one ward or criterion without reopening filters. Particularly useful on mobile map view. | Additional summary, not complete selection interface. Unbounded wrapping changes map position; clipping hides state; many removal buttons lengthen keyboard navigation. PatternFly recommends labels when values are hidden, but says they are unnecessary when existing controls already convey selections. [PatternFly](https://www.patternfly.org/patterns/filters/design-guidelines/#filter-labels) |
| **Multi-select dropdown with checkboxes** | Compact desktop toolbar; supports several values in one category while preserving map/list width. Selected-count badge can communicate state when closed. | Hides available choices and requires opening controls. Keep it open during multiple selections rather than closing after every choice. PatternFly distinguishes checkbox-select dropdowns from typeahead controls, allowing a separate search field within the dropdown. [PatternFly](https://www.patternfly.org/patterns/filters/design-guidelines/#checkbox-select) |
| **Searchable combobox / token input** | Useful when a category has many options that users can identify by typing. | More complicated interaction and accessibility contract. Not automatically better for short lists. APG’s combobox pattern is single-select; it does **not** provide a ready-made generic multi-select-combobox pattern. [APG combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) |
| **Inline checkbox groups** | Options and selected states visible together; familiar multi-select behavior; good starting point for short categories. GOV.UK supports checkboxes for multiple choices and individual on/off choices. | More vertical space; placing every group above results would reduce map/list room. Use labels, legends and “Select all that apply” where necessary. [GOV.UK checkboxes](https://design-system.service.gov.uk/components/checkboxes/) |
| **Checkboxes within disclosure/accordion** | Reduces initial visual density; can expose category names while allowing users to open relevant groups. | Hidden options may go undiscovered. Expanding groups above a map moves it unless expansion is isolated from the map’s layout. GOV.UK recommends evidence before using accordions and warns against hidden essential content. Its accordion guidance is not blanket endorsement of accordion-based forms. [GOV.UK accordion](https://design-system.service.gov.uk/components/accordion/) |
| **Faceted-search sidebar** | Multiple categories remain visible while results update; useful for repeated case-manager workflows. Carbon identifies left-side and top-of-results placements for multiple categories. | In a map-plus-list layout, another column reduces width available to both results views. Benefits depend on available width, not desktop status alone. [Carbon filtering](https://carbondesignsystem.com/patterns/filtering/) |
| **Hybrid controls + applied summary + mobile sheet** | Each layer has one job: controls choose, chips summarize/remove, sheet accommodates mobile editing. MOJ demonstrates checkboxes plus selected filters and clear action at the top. | Duplicated representations must remain consistent. Count badges alone do not reveal which values are applied. MOJ’s component is marked “To be reviewed” and documents unresolved accessibility/layout questions. [MOJ filter](https://design-patterns.service.justice.gov.uk/components/filter/) |

**Civic-sector caution:** GOV.UK treats native selects as a last resort in public-facing services and specifically discourages adding multi-selection to its select component. This supports considering checkboxes first; it does not prove every custom dropdown or combobox is unsuitable. [GOV.UK select](https://design-system.service.gov.uk/components/select/)

## 2. Layout-stability techniques

### Reserved summary space

Reserve a summary region before the first selection and retain it after the last selection is removed. This avoids inserting/removing a row above the map. web.dev recommends reserving space for dynamic content and avoiding collapse of reserved space. Applying that principle to filter summaries is a reasoned transfer, not filter-specific experimental evidence. [web.dev](https://web.dev/articles/optimize-cls#reserve_space_for_late-loading_content)

**Important:** a minimum height prevents the initial jump only. It does not prevent later growth when chips wrap. Full F1 coverage requires bounded presentation plus a way to access overflow.

### Fixed-height or bounded chip well

A stable-height region keeps the map boundary predictable, but must not hide labels, removal buttons or keyboard focus. Fixed height is a layout technique, not permission to clip content. At narrow widths or enlarged text, alternate presentation may be necessary. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

### Overflow options

| Technique | Benefit | Cost / evidence |
|---|---|---|
| **Visible chips plus “+N more” / “View all filters”** | Explicitly signals hidden selections; can open a popover or sheet without pushing map downward. | Adds an interaction before reviewing/removing hidden items. Carbon’s operational tags explicitly disclose additional tags in another view. Exact “+N more” wording and optimal threshold are not established by that guidance. [Carbon tags](https://carbondesignsystem.com/components/tag/usage/#operational-tag) |
| **Horizontal chip scrolling** | Stable single-row height; many selections remain available. | Overflow may be missed; touch scrolling competes with nearby map gestures; keyboard focus must reveal the focused chip. W3C describes conforming horizontally scrolling sections when their individual content fits the narrow viewport, but does not endorse chip strips specifically. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| **Wrap to a bounded number of rows, then disclosure** | More selections visible without lateral scrolling. | Stable only if those rows are reserved from the start. Carbon supports modest multi-line groups for selectable tags, but its guidance is not a universal row-count rule for applied chips. [Carbon tags](https://carbondesignsystem.com/components/tag/usage/#selectable-tag) |
| **Unbounded wrapping** | All chips immediately visible. | Poor fit for F1: each new row reduces or displaces map area. |
| **Silent clipping** | Visually compact. | Unacceptable solution to F2: users cannot reliably perceive or reach active constraints. W3C identifies disappearing, unavailable content as a reflow failure. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |

**Metric caveat:** shifts within 500 ms of qualifying user input may be excluded from CLS. A good CLS score therefore does not establish that filter interactions keep the map still. [web.dev](https://web.dev/articles/optimize-cls#understand_the_causes_of_layout_shifts)

## 3. Multi-select best practices

- **Keep category identity visible.** A closed trigger such as “Ward · 3 selected” communicates both category and selection count. Carbon requires a visible applied-filter indicator when filters are hidden; PatternFly supports selected-count badges. [Carbon filtering](https://carbondesignsystem.com/patterns/filtering/#filter-states), [PatternFly badges](https://www.patternfly.org/patterns/filters/design-guidelines/#badge-count)
- **Keep multi-select open while choosing several options.** Avoid repetitive reopen/select/close cycles. [PatternFly checkbox select](https://www.patternfly.org/patterns/filters/design-guidelines/#checkbox-select)
- **Separate counts:** selected criteria and matching housing units mean different things. Prefer explicit labels such as “3 filters” and “18 matching units.” This wording is contextual synthesis from Carbon’s selection-indicator guidance and W3C’s result-count examples. [Carbon](https://carbondesignsystem.com/patterns/filtering/), [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

### Instant apply versus explicit Apply

There is no universal winner.

- **Instant apply:** useful for exploratory searching and fast updates; lets users see the effect of each choice. Avoid focus movement, page jumps and distracting repeated changes. [NN/G: User Intent Affects Filter Design](https://www.nngroup.com/articles/applying-filters/)
- **Explicit Apply:** useful for several known constraints, slower updates, and mobile filtering. Carbon recommends batching when users make several mentally demanding selections; NN/g recommends mobile Apply. [Carbon](https://carbondesignsystem.com/patterns/filtering/#multiple-filters-with-batch-updates), [NN/G](https://www.nngroup.com/articles/applying-filters/)
- **Result-count preview with Apply:** potentially combines feedback with deliberate commitment. If used, make pending and applied states distinguishable. This is synthesis, not a documented universal standard.

NN/g’s cited articles date from 2015–2016. Their observations remain useful, but assumptions about mobile latency should not substitute for measuring this SPA.

## 4. Clear-all / reset

### Supported placement patterns

1. **Beside the selected-filter heading near the top.** MOJ places “Clear filters” beside “Selected filters.” Strong civic-sector precedent for the user’s proposed top-line placement. [MOJ filter](https://design-patterns.service.justice.gov.uk/components/filter/)
2. **After applied labels.** PatternFly places “Clear filters” after the last label. This can become harder to find when chips overflow. Its normal collapse-to-one-row behavior also conflicts with F1 if copied literally. [PatternFly clearing filters](https://www.patternfly.org/patterns/filters/design-guidelines/#clearing-filters)
3. **Available outside a closed filter container.** Carbon calls for clearing without reopening the container and supports category-level plus global clearing. [Carbon filtering](https://carbondesignsystem.com/patterns/filtering/#filter-states)

### Conditional visibility

Showing clear-all only when filters are active is a reasonable app-specific choice. The reviewed sources do not establish consensus that conditional visibility is always superior to a persistent disabled action.

For F1, conditional **control visibility must not imply conditional region height**. Preserve surrounding geometry. If activating Clear removes the focused control, deliberately place focus on a stable nearby control rather than letting it disappear with the element. APG’s keyboard guidance supports maintaining logical focus when elements are removed. [APG keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

Use **“Clear all filters”** if it removes criteria; **“Reset filters”** if it restores meaningful defaults. Carbon defines clearing as returning to the original default state, so product language must make any difference explicit. [Carbon resetting filters](https://carbondesignsystem.com/patterns/filtering/#resetting-filters)

## 5. Mobile specifics

- **Retain a clearly labelled filter trigger and applied count when the sheet is closed.** NN/g favors words such as “Filter” over unexplained icons; Carbon requires visible indication of hidden applied filters. [NN/g mobile facets](https://www.nngroup.com/articles/mobile-faceted-search/), [Carbon](https://carbondesignsystem.com/patterns/filtering/#filter-states)
- **Keep result-count feedback visible during filter editing.** NN/g’s tray analysis specifically identifies a continuously visible total as beneficial. [NN/g](https://www.nngroup.com/articles/mobile-faceted-search/)
- **Bottom-sheet filters are compatible with the overlay principle**, but NN/g studied side trays, not bottom-sheet superiority. Retaining this app’s bottom sheet is a contextual recommendation, not a finding that bottom sheets outperform other mobile containers.
- **Over-map chips avoid document-flow displacement but consume map visibility.** Prefer a bounded, legible region; avoid covering essential map actions or focused controls. W3C warns that fixed/sticky content can obscure content and keyboard focus, especially at zoom. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- **For three wards, show all three or clearly expose the hidden remainder.** One visible chip without an overflow signal is not an adequate representation of three active constraints. Carbon supports overflow disclosure; W3C requires information/functionality remain available. [Carbon tags](https://carbondesignsystem.com/components/tag/usage/), [W3C](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- **Do not rely on hover to reveal full chip names on touch devices.** Carbon documents hover/focus disclosure; mobile needs another accessible route to full text, such as the filter sheet. This is a contextual limitation of applying desktop tooltip guidance.

## 6. Accessibility per pattern

### Checkboxes

Use associated labels and group related choices with `fieldset` and `legend`. Explain multi-selection when needed. Native checkbox behavior avoids inventing custom selection semantics. [GOV.UK checkboxes](https://design-system.service.gov.uk/components/checkboxes/)

### Combobox and multi-select listbox

APG’s combobox pattern is single-select, including its listbox-popup selection model. Do not describe a custom multi-select as “APG compliant” merely because it uses `role="combobox"`. [APG combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)

For a genuine multi-select listbox, APG documents:

- `aria-multiselectable="true"`;
- consistent selected/checked state;
- focus distinct from selection;
- a recommended keyboard model without modifier-key requirements;
- Space to toggle the focused option.

Listbox options must not contain interactive checkboxes or removal buttons. A disclosure containing native checkboxes is a different pattern. [APG listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)

### Disclosure / accordion

Disclosure trigger is a button, supports Enter/Space, and exposes `aria-expanded`; `aria-controls` may identify controlled content. [APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)

### Removable chips

Removal must be keyboard-operable and have a specific accessible name, for example **“Remove Ward 3 filter”**, not repeated unqualified “Remove” buttons. Carbon documents Tab access and Enter/Space removal; MOJ demonstrates hidden removal instructions combined with the visible value. [Carbon tag accessibility](https://carbondesignsystem.com/building-blocks/core/components/tag/accessibility), [MOJ filter](https://design-patterns.service.justice.gov.uk/components/filter/)

After removal, retain a logical focus position—another removal control or stable filter trigger. Do not let focus fall back to the page body when the focused chip disappears. [APG keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

### Result announcements and apply/clear focus

Expose concise result-count updates through a status region, commonly `role="status"`. W3C explicitly identifies “18 results returned” and “No results returned” as status messages when presented without a context change. Do not announce the entire result list or every marker update. Avoid excessively chatty announcements. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

For inline filtering, preserving focus supports continued selection; announce results rather than moving focus automatically. NN/g documents disruption from premature refreshes and page-position changes. [NN/g](https://www.nngroup.com/articles/applying-filters/)

If the bottom sheet is modal, move focus inside on open, contain its Tab sequence, support Escape and a visible close control, and normally return focus to the opener on close. Keep background interaction inert. These requirements depend on modal behavior, not whether the panel slides from the bottom. [APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## 7. Ranked recommendations for this app

| Rank | Recommendation | Friction addressed | Evidence and confidence |
|---|---|---|---|
| **1** | Reserve a stable applied-filter summary region, including its empty state; bound overflow instead of adding rows indefinitely. | **F1** | Strong layout principle; exact size/row count needs app-specific evaluation. [web.dev](https://web.dev/articles/optimize-cls#reserve_space_for_late-loading_content) |
| **2** | Replace silent clipping with visible overflow disclosure and full access to every selected value. Prefer explicit “View all” / “+N more” over relying solely on a hidden scroll strip. | **F2** | Strong access requirement and established overflow-disclosure pattern; preferred affordance is contextual synthesis. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Carbon](https://carbondesignsystem.com/components/tag/usage/#operational-tag) |
| **3** | Put “Clear all filters” near the top-line selected-filter summary, outside any scrolling chip content; conditional appearance can retain reserved space. | **Clear-all** | MOJ top-summary precedent; Carbon outside-container clearing. Conditional visibility remains a design choice. [MOJ](https://design-patterns.service.justice.gov.uk/components/filter/), [Carbon](https://carbondesignsystem.com/patterns/filtering/) |
| **4** | Keep the hybrid: selection controls plus removable summary chips. Prefer native checkbox groups for short lists; use compact dropdowns when space requires them; reserve searchable controls for genuinely long lists. | Overall clarity | Established patterns, not evidence for a wholesale redesign. [GOV.UK](https://design-system.service.gov.uk/components/checkboxes/), [PatternFly](https://www.patternfly.org/patterns/filters/design-guidelines/) |
| **5** | Keep mobile sheet editing deliberate with an explicit Apply action and visible count feedback; distinguish pending from applied choices if batching. | Mobile multi-selection | Supported by Carbon and NN/g; no bottom-sheet-specific comparative finding. [Carbon](https://carbondesignsystem.com/patterns/filtering/), [NN/g](https://www.nngroup.com/articles/applying-filters/) |
| **6** | Preserve focus and position through selection/removal; announce concise matching-unit counts. | Accessibility, continuity | Strong W3C/APG guidance. [W3C status](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [APG dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) |
| **7** | Treat an additional desktop sidebar as an alternative to investigate, not the default answer. | Map/list space | Left-side filters are established, but this app already divides results into two panes. No reviewed source establishes a third column as best. [Carbon](https://carbondesignsystem.com/patterns/filtering/) |

### Evidence limits

No reviewed source establishes one universally best filter area for reentry housing search. No comparative evidence found establishes a winning chip-row height, overflow threshold, bottom-sheet orientation, or conditional-clear policy. Recommendations above distinguish accessibility requirements, established design-system patterns, and app-specific synthesis. Existing walkthrough evidence supplies the strongest reason to prioritize F1 and F2.
