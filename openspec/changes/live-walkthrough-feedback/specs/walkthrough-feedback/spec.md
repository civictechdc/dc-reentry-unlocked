# Spec Delta

## Purpose

The guided live-session feedback workflow: running a synchronous walkthrough of the running web application with the user, capturing both conversational feedback and browser-session usage signals, and producing a structured, citable feedback record. Dev tooling only — never shipped product behavior.

## ADDED Requirements

### Requirement: Synchronous walkthrough with dual-stream capture

The agent SHALL be able to run a synchronous walkthrough of the running web application with the user: a live browser session the user directs, during which the agent captures two streams — the user's conversational feedback (recorded verbatim with attribution) and structured usage signals from the browser session (interactions taken, filter selections and their results, zero-result encounters, console errors, failed or slow requests).

#### Scenario: Guided session runs with both streams captured
- **WHEN** the agent runs a walkthrough with the user against the running stack
- **THEN** the session produces a structured usage-event log AND the user's spoken/typed reactions are recorded alongside it, time-correlated to the session

### Requirement: Structured feedback record

Each walkthrough SHALL produce a committed feedback document synthesizing both streams: what happened in the session, friction points and positive observations, the user's attributed feedback, and candidate follow-up items phrased so future changes can cite them.

#### Scenario: Record cites cleanly into future work
- **WHEN** a later change proposal needs the evidence behind a product decision
- **THEN** the feedback document provides the attributed quotes and the session signals that motivated it, findable by date under `docs/feedback/`

### Requirement: Walkthrough scope is dev-only

The walkthrough harness SHALL be development tooling: it SHALL NOT add analytics, telemetry, or session tracking to the shipped application.

#### Scenario: Product ships no instrumentation
- **WHEN** the web application is built for production
- **THEN** no walkthrough or feedback capture code ships with it
