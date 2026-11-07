# Tasks

## 1. Triage the CodeQL baseline, then arm the gate

- [ ] 1.1 Triage the four open CodeQL alerts (run IDs via `gh api repos/civictechdc/dc-reentry-unlocked/code-scanning/alerts`): for each, read the flagged escape helper and its input path — fix with tests where the path is real (expected shape: `replaceAll` or a regex loop in the docgen/i18n-audit helpers, closed by the next scan), otherwise dismiss with a written reason and removal condition under the repo's exact-finding exception discipline (never a blanket rule/directory exclusion); verify the alert states on GitHub match the recorded dispositions and every dismissal cites its reason
- [ ] 1.2 Enable the code-scanning merge-protection ruleset on `main` (code scanning results required, CodeQL tool, threshold high-or-worse) — only after 1.1 leaves no untriaged high alerts; verify via API that the ruleset is active and scoped correctly, and that a fresh CodeQL run on `main` is green with no open high alerts

## Workflow follow-up

- After all tasks complete: code review per project policy (any code fix from task 1.1), then archive this change (`openspec archive`) and verify the archived state.
