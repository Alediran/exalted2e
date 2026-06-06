# Headless Quench Runner (CI)

Runs the in-Foundry Quench suite automatically in GitHub Actions and reports V8
coverage over `module/**`. (This file is the committed/tracked runbook —
`docs/` is gitignored, so operational notes live here.)

## Required GitHub secrets
- `FOUNDRY_USERNAME` + `FOUNDRY_PASSWORD` — felddy uses these to download Foundry.
  (Alternatively switch the workflow to a timed `FOUNDRY_RELEASE_URL`.)
- `FOUNDRY_LICENSE_KEY` — license activation.
- `FOUNDRY_ADMIN_KEY` — admin access key for the running instance.

## Versions
- **Foundry: v14.** `system.json` requires Foundry v14 (compatibility min/verified/max = "14"),
  so the fixture world's `coreVersion` is `"14"` and the workflow uses the
  `felddy/foundryvtt:release` image (latest stable, currently v14). To pin a
  specific build, re-add `-e FOUNDRY_VERSION="14.xxx"` to the `Start Foundry`
  docker step and set the same value as `coreVersion` in
  `tools/ci/fixtures/test-world/{world.json, src/users/*, src/scenes/*}`.
- **Quench: 0.10.0**, downloaded in the `Install Quench` step. This matches the
  locally-used version. If a Quench/v14 incompatibility surfaces on the first
  CI run, bump this to a v14-compatible Quench release (update the URL).

## How it works
1. `npm run pack` builds compendiums (`packs/` is gitignored).
2. Committed `world.json` + GM user + scene JSON are packed to the world LevelDB
   via the `fvtt` CLI (`!users!…`, `!scenes!…` keys).
3. felddy boots Foundry (host `fvtt-data` → container `/data`) and auto-launches
   `exalted2e-test`.
4. `tools/ci/run-quench.mjs` (Playwright) joins as the passwordless `Gamemaster`
   user, runs `quench.runBatches("**", { json: true })` (writes
   `Data/quench-report.json`), reads it from `QUENCH_REPORT_PATH`, and exits
   non-zero on any failure. The whole run is hard-capped by
   `QUENCH_BATCH_TIMEOUT_MS` (default 600000) so a hung batch can't stall CI.
5. V8 coverage is collected during the run and written as a JSON summary
   (per-file pct + worst-first uncovered list), uploaded as the `quench-coverage`
   artifact. Full lcov export (via `v8-to-istanbul`) is a planned follow-up.

## Running locally
Point the runner at your own Foundry instance (already serving the test world):

```
FOUNDRY_URL=http://localhost:30000 \
QUENCH_REPORT_PATH=/absolute/path/to/Data/quench-report.json \
npm run test:quench
```

`QUENCH_REPORT_PATH` must be the **host** path to the userdata `Data` dir's
`quench-report.json` (the orchestrator's default is the in-container path used by
the workflow).

## First-run checklist (maintainer)
- Add the four secrets above.
- Confirm `felddy/foundryvtt:release` resolves to a v14 build and Quench 0.10.0
  loads under it; adjust pins if not.
- The `/join` selectors in `run-quench.mjs` may need tuning for the exact v14 UI.
- Verify Quench writes `quench-report.json` to the userdata `Data/` root (the
  highest-risk assumption); if it lands elsewhere, update `QUENCH_REPORT_PATH`.
