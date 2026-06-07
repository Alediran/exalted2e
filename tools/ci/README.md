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
- **Foundry: v14**, pinned via the workflow `env.FOUNDRY_VERSION` (currently
  `14.363`). `system.json` requires Foundry v14 (compatibility min/verified/max
  = "14"); the fixture world's `coreVersion` is `"14"` (lenient — migrates up).
- **Quench: 0.10.0**, downloaded in the `Install Quench` step (matches the
  locally-used version).

## Foundry download caching (avoids re-supplying the release URL)
`actions/cache` persists `fvtt-data/container_cache` (felddy's
`CONTAINER_CACHE`, which holds `foundryvtt-<FOUNDRY_VERSION>.zip`) across runs,
keyed on `foundry-${FOUNDRY_VERSION}`.
- **First run / version bump (cache miss):** felddy needs `FOUNDRY_RELEASE_URL`
  (or working account auth) to download the build; it then preserves the zip and
  the cache is saved post-job.
- **Subsequent runs (cache hit):** felddy installs from the cached zip — no
  download, no `FOUNDRY_RELEASE_URL`, no account auth needed.
- **To move to a newer build:** bump `env.FOUNDRY_VERSION` in the workflow and
  supply a fresh `FOUNDRY_RELEASE_URL` once; the new version repopulates the
  cache under the new key.
- GitHub evicts caches after ~7 days of no use (or LRU at 10 GB), so an idle repo
  may occasionally need the release URL again.

Note: the **license signature** is host-bound and is *not* cached — the
`Sign license` + restart steps run every time regardless of the download cache.

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
5. V8 coverage is collected during the run and written both as a JSON summary
   (`quench-coverage`) and as an istanbul `coverage-final.json`
   (`quench-coverage-final`, via `v8-to-istanbul`) for merging — see below.

## Combined coverage (Vitest + Quench)
Quench V8 coverage alone undercounts — the pure logic layer is covered by the
Vitest suite. A dedicated `coverage` CI job merges both:
- `vitest` job → `vitest-coverage` artifact (`coverage/vitest/coverage-final.json`, istanbul, `all: true`).
- `quench` job → `quench-coverage-final` artifact (V8→istanbul via `v8-to-istanbul`).
- `coverage` job (`needs: [vitest, quench]`, `if: always()`) → `node tools/ci/merge-coverage.mjs`
  normalizes file keys to repo-relative `module/...` (`tools/ci/coverage-paths.mjs`),
  merges with `istanbul-lib-coverage`, prints a combined summary + worst-first
  per-file table to the log, and uploads `coverage-combined` (lcov + html).

Locally: `npm run test:coverage` gives the Vitest (pure-layer) coverage in
`coverage/vitest/`. The full merge runs only in CI (it needs the Quench run).
**Report-only — no threshold gate yet.**

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

## Coverage gate

The `coverage` CI job merges the Vitest + Quench coverage and enforces a **line-coverage floor** via `tools/ci/merge-coverage.mjs` + `tools/ci/coverage-gate.mjs`:

- Set by `COVERAGE_MIN_LINES` (env on the "Merge coverage" step in `.github/workflows/test.yml`). Unset/non-numeric → gate is **off** (report-only).
- The job **fails** (exit 1) when combined line coverage is below the floor — but only when BOTH coverage inputs are present. If a source job (e.g. Quench) produced no coverage artifact, the gate is **skipped** (exit 0) so a degraded run doesn't false-fail on a Vitest-only number.
- Metric is **lines only** (branch/function coverage is noisier).
- Every run prints `Combined coverage — lines X%`; ratchet the floor up to ~1 point below X after a green run to lock in gains. The combined html/lcov report still uploads as the `coverage-combined` artifact even on a gate failure.
