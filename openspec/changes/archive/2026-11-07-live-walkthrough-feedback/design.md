# Design

## Context

The repo already owns every ingredient: Playwright boots the full stack (`webServer`, both servers) and drives browsers for e2e; the agent converses with the user synchronously; docs are committed. The walkthrough is these composed into a feedback workflow. The product's non-goals forbid analytics — so the harness lives in dev tooling only, with zero product-code changes.

## Goals / Non-Goals

**Goals:**
- A live, user-directed session against the running stack with structured usage capture
- Dual-stream synthesis: attributed conversational feedback + session signals, time-correlated
- A committed, citable feedback document per session

**Non-Goals:**
- No app instrumentation, no shipped telemetry, no accounts/saving (product non-goals stand)
- No automated analysis of the user's words — the agent synthesizes, the user approves
- No remote/multi-user sessions — local walkthroughs with the project's user

## Decisions

**D1 — Agent-driven browser, user directing.** The agent runs the session via Playwright (headed browser visible to the user); the user says what to try and reacts to what they see. Alternative considered: attaching to the user's own browser via CDP (most natural browsing, but requires the user to launch Chrome with a debug port and complicates capture). Chosen for instrumentation completeness with the smallest moving parts; the user's direction makes it their session.

**D2 — Usage capture via a walkthrough-mode Playwright script, not app hooks.** A dedicated spec-class script (e.g. `apps/web/e2e/walkthrough.capture.ts` — NOT part of the CI suites) listens to page events: clicks on interactive elements (best-effort labels via aria/testid), filter applications and result counts (the store's requests are observable via network), zero-result states, console errors/warnings, failed requests, and slow interactions (>500ms). Output: a structured JSON event log with timestamps. No app code changes — everything is observable from the session.

**D3 — Time-correlated synthesis.** The agent keeps a running note of the user's remarks (conversation), then merges both streams into `docs/feedback/<date>-walkthrough.md`: a session timeline (events), friction points, positive observations, attributed quotes, and candidate follow-up items phrased for citation. The user reviews the document before it's committed — the record is their feedback, accuracy requires their sign-off.

**D4 — Scope guard.** The capture script lives under the e2e directory but outside both CI configs' test patterns; `pnpm -C apps/web e2e` never runs it. The production build ships none of it (it's devDependency tooling). The i18n/arch/lint gates apply to the script like any repo code.

## Risks / Trade-offs

- [Best-effort event labels] Playwright sees DOM/network, not intent — some events will be coarse ("clicked button 'Filters'"); the user's commentary carries the meaning — acceptable, the synthesis step is where the two streams meet.
- [Synchronous cost] The walkthrough needs the user present; scheduled at their convenience, one session at a time — no automation of the human part.
