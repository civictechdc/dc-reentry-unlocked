// Advisory agent-hook nudge — one shared script for Claude Code, VS Code
// (Copilot harness), and Codex.
//
// NUDGES, NOT GATES: deterministic enforcement lives ONLY in the git hooks
// (gitconfig/hooks.config -> scripts/hooks/{pre-commit,pre-push,commit-msg}).
// This script must never block, deny, rewrite, or duplicate a git-hook check
// — it only prints advisory context and ALWAYS exits 0. Fail-open is total:
// on unparsable input, oversized input (capped at 1 MiB, treated as a no-op),
// stdout/stderr stream errors (EPIPE handlers), or any uncaught exception
// (swallowed by the process handler below), the process still exits 0.
//
// Per-event payload (token discipline):
// - SessionStart: the full base nudge (once per session).
// - UserPromptSubmit: a one-line pointer (fires every prompt — kept short).
// - PostToolUse: ONLY the unknown-honesty line, and only when the edited
//   path matches /inventory|filter|schema|glossary/i; otherwise `{}`.
//
// Anti-injection rules (AV1):
// - Nothing from the input is ever echoed — the emitted context strings are
//   fixed constants in this file.
// - The emitted hookEventName is derived ONLY from an allowlist of
//   recognized event spellings; a NON-STRING (corrupt/hostile)
//   hook_event_name resolves to the fixed default event "SessionStart"
//   (orientation nudge — safe for an unclassifiable moment, rare by
//   construction). An unrecognized-but-string event name stays silent: we
//   can read it, deliberately classify it as not-a-nudge-moment, and emit
//   `{}` to protect token discipline.
//
// Output contract per platform-verified docs (2026-08+):
// - Claude (.claude/settings.json) and Codex (.codex/hooks.json): stdout JSON
//   hookSpecificOutput { hookEventName, additionalContext } — no decision or
//   block fields, so nothing blocks.
// - VS Code Copilot harness (.github/hooks/*.json, camelCase event names):
//   camelCase payloads carry sessionId/toolName (no hook_event_name key at
//   all). sessionStart and postToolUse consume ONLY a top-level
//   { additionalContext } — emitting the Claude shape is silently dropped.
//   Dispatch is structural, not by name: hook_event_name key present →
//   Claude/Codex shape; toolName => Copilot postToolUse; sessionId (with no
//   hook_event_name key) => Copilot sessionStart.
// Event input is one JSON object on stdin (differs per platform).

import fs from "node:fs";

const MAX_STDIN_BYTES = 1024 * 1024; // 1 MiB cap — larger input => no-op

const KNOWN_EVENTS = new Set(["SessionStart", "UserPromptSubmit", "PostToolUse"]);
const DEFAULT_EVENT = "SessionStart"; // fixed default for corrupt event names

const BASE_NUDGE = [
  "House rules (AGENTS.md is the standard — details there):",
  "- Work from the OpenSpec change's tasks.md; do not improvise scope.",
  "- Context/token discipline: link or point to files instead of pasting them; keep subagent briefs curated (context needed, not exhaustive).",
  "- Verify before done: run the task's verification commands, never claim untested work.",
  "- Commits: Conventional Commits `type(scope): subject` (commit-msg gate enforces).",
  "- If AGENTS.local.md exists at repo root, read it after AGENTS.md.",
].join("\n");

const POINTER_NUDGE =
  "House rules: AGENTS.md (local overrides in AGENTS.local.md if present) — work OpenSpec tasks first, run the task verification before claiming done.";

const UNKNOWN_NUDGE =
  'Unknown is a real state — inventory/filter fields unknown at source stay "not publicly listed" (boolean filters match unknown as no; enum filters match unknown with a "policy not listed" marker). Never fabricate a yes/no.';

const SUSPECT_PATH_RE = /inventory|filter|schema|glossary/i;

// EPIPE and friends must never exit non-zero (A1): advisory channel only.
process.stdout.on("error", () => {});
process.stderr.on("error", () => {});
// Belt and braces (AV2): an uncaught exception must not flip exitCode to 1.
// This script is tiny, stateless, and advisory — swallowing is safe here.
process.on("uncaughtException", () => {
  process.exitCode = 0;
});

function readStdinCapped() {
  const chunks = [];
  let total = 0;
  const buffer = Buffer.alloc(8192);
  while (total < MAX_STDIN_BYTES) {
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(0, buffer, 0, Math.min(buffer.length, MAX_STDIN_BYTES - total));
    } catch {
      break; // EAGAIN/EOF/error — treat as end of input
    }
    if (bytesRead <= 0) break;
    chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    total += bytesRead;
  }
  if (total >= MAX_STDIN_BYTES) return ""; // oversized => no-op
  return Buffer.concat(chunks).toString("utf8");
}

function candidatePaths(input) {
  return [
    input?.tool_input?.file_path,
    input?.tool_input?.filePath,
    input?.toolArgs?.file_path,
    input?.toolArgs?.filePath,
    // Codex apply_patch carries the patch in tool_input.command
    (typeof input?.tool_input?.command === "string" && input.tool_input.command) || undefined,
  ]
    .filter((value) => typeof value === "string")
    .map((value) => value.slice(0, 2048)); // capped scan, never echoed
}

function targetsSuspectField(input) {
  return candidatePaths(input).some((value) => SUSPECT_PATH_RE.test(value));
}

// Claude/Codex family membership is decided by the PRESENCE of the
// hook_event_name key (any type). Corrupt (non-string) values must not leak.
function resolveClaudeEvent(input) {
  if (!(typeof input === "object" && input !== null && "hook_event_name" in input)) return null;
  const value = input.hook_event_name;
  if (typeof value === "string" && KNOWN_EVENTS.has(value)) return value;
  if (typeof value === "string") return ""; // unrecognized string: silent ({})
  return DEFAULT_EVENT; // non-string/corrupt: fixed default, never the raw value
}

// Returns { hookEventName, message } for Claude/Codex shapes,
// { message } (Copilot top-level additionalContext), or null => "{}".
function nudgeFor(input) {
  const knownEvent = resolveClaudeEvent(input);
  if (knownEvent !== null) {
    if (knownEvent === "SessionStart") return { hookEventName: knownEvent, message: BASE_NUDGE };
    if (knownEvent === "UserPromptSubmit")
      return { hookEventName: knownEvent, message: POINTER_NUDGE };
    if (knownEvent === "PostToolUse") {
      return targetsSuspectField(input)
        ? { hookEventName: knownEvent, message: UNKNOWN_NUDGE }
        : null;
    }
    if (knownEvent === "") return null; // unrecognized string event: silent
    return null; // defensive — DEFAULT_EVENT and "" are both handled above
  }
  // Copilot harness (camelCase payloads — no hook_event_name key at all).
  if (typeof input.toolName === "string") {
    return targetsSuspectField(input) ? { message: UNKNOWN_NUDGE } : null; // postToolUse
  }
  // Pinned to the registered "sessionStart" event (CR3): this branch treats
  // ANY camelCase payload lacking toolName as sessionStart. Revisit if
  // .github/hooks/agent-nudges.json ever registers more camelCase events.
  if (typeof input.sessionId === "string") return { message: BASE_NUDGE };
  return null;
}

// No name fallback and no input echo here (CR4/AV1): the emitted
// hookEventName comes only from resolveClaudeEvent's fixed allowlist/default.
function serialize(nudge) {
  if (!nudge || !nudge.message) return "{}";
  if (nudge.hookEventName) {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: nudge.hookEventName,
        additionalContext: nudge.message,
      },
    });
  }
  return JSON.stringify({ additionalContext: nudge.message });
}

// Every statement below is inside the guarded path — any failure prints the
// no-op `{}` and exits 0 (A3/AV2 guarantee: exits 0 on all paths, incl.
// stream errors, oversized input, and uncaught exceptions).
try {
  const raw = readStdinCapped();
  let input = {};
  if (raw.trim()) {
    try {
      input = JSON.parse(raw);
    } catch {
      input = {};
    }
  }
  process.stdout.write(`${serialize(nudgeFor(input))}\n`);
} catch {
  try {
    process.stdout.write("{}\n"); // guarded fallback write (AV2)
  } catch {
    // stdout is gone (e.g. EPIPE) — nothing is recoverable, stay silent
  }
} finally {
  process.exitCode = 0;
}
