# Production readiness — a11y-sweep

Audit of the `audit/production-readiness` branch. This document records evidence;
it does not award a production-ready label.

## Scope and architecture

A zero-dependency static HTML accessibility checker: a minimal positional HTML parser
(`src/html.ts`), ten rules that each name the affected user (`src/rules.ts`; the `link-text`
rule emits `empty-link` and `vague-link-text`), file discovery, text/JSON reports and a CLI with
CI exit codes. It does not render pages, compute styles (no contrast checks) or implement HTML5
implicit tag closing — documented in the README.

## Platforms and prerequisites

Node.js >= 20. Verified locally on macOS (Apple Silicon): full gate on Node 24.19.0, test suite on
Node 20 and 22. CI matrix (default branch): ubuntu / windows / macOS x Node 20 / 22 / 24; Windows
not run locally.

## Clean-clone setup (README "Install" and "Development")

The README "Install" section (clone, `npm ci && npm run build`, `npm link`) was also run from a
fresh clone with `npm link` pointed at a throwaway npm prefix; `a11y-sweep fixtures/example.html`
then ran from PATH. The package is not on the npm registry, which the README now says.


```bash
npm ci && npm test && npm run typecheck && npm run lint && npm run build
npx a11y-sweep fixtures/example.html
```

Fresh clone of the audit branch: all steps exit 0; 133 tests passed / 0 failed / 0 skipped;
`npx a11y-sweep fixtures/example.html` exits 3 (findings), `fixtures/negatives` exits 0 with
no findings, `./bin/a11y-sweep.js --version` works, and the tree stays clean after install
(before the fix, `npm ci` flipped the bin's mode and dirtied the checkout).

## Commands executed (CI-equivalent, local)

| Command | Baseline (main @ 25de427) | Audit branch |
|---|---|---|
| `npm ci` | 0 | 0 |
| `npm test` | 0 — 123 passed, 0 failed, 0 skipped | 0 — 133 passed, 0 failed, 0 skipped (Node 24, 20, 22) |
| `npm run build && node bin/a11y-sweep.js --version` | 0 | 0 |
| `npm run typecheck` / `npm run lint` | 0 / 0 | 0 / 0 |
| `npm run coverage` (thresholds 95/95/100/90) | 0 — lines 97.67 %, branches 94.09 % | 0 — lines 97.87 %, branches 94.6 % |
| CI fixture job (exit 3, exactly 11 finding ids) | pass | pass |
| `npm audit --omit=dev` | 0 vulnerabilities (no runtime deps) | 0 |
| `npm audit` (dev) | 7 (2 critical, 3 high, 2 moderate) | 4 (2 critical, 2 moderate): vitest 3 / coverage-v8 / tinypool, fix needs vitest 5 (semver-major) |

## Fixture-based accuracy (true/false positives)

New fixtures: `fixtures/negatives/accessible-edge-cases.html`, `fixtures/negatives/partial.html`
(must produce zero findings) and `fixtures/positives/tricky-defects.html` (must produce exactly 9
planted findings), asserted in `test/fixtures.test.ts`.

| Fixture | Baseline | Audit branch |
|---|---|---|
| accessible-edge-cases.html | 16 false positives (aria-labelled / decorative / hidden images, `title`-named and `reset` controls, svg-named and `title`-named links, `onclick` on `<body>`/`<summary>`, widget roles `tab`/`checkbox`, layout table, `aria-label`led and hidden iframes) | 0 findings |
| partial.html (no `<html>`) | 1 false positive (`missing-title`) | 0 findings |
| tricky-defects.html (9 planted defects) | 4 found, 5 missed (svg `<title>` as page title, `&nbsp;` link, entity-encoded "Read more", blank `aria-label` on input, nested-table `<th>`) | 9 found, exactly |

The baseline counts were produced by building the baseline commit and running the CLI on the new
fixtures.

## Bugs fixed (regression tests: `test/fixtures.test.ts`, `test/robustness.test.ts`)

8 of the 10 new tests fail on the baseline source.

- Rule accuracy as above (accessible-name semantics, blank values, entity decoding, nested tables,
  `tabindex` parsing, widget roles).
- Stack overflow (`RangeError`) on documents nested ~20k deep: walk and text extraction are iterative.
- Quadratic parsing with many `<script>`/`<style>` blocks (whole document lower-cased per block):
  20k scripts took ~3 s, 40k timed out at 16 s in the test; now well under 1 s.
- `--rule typo` selected no rules and exited 0 (silent CI pass); now exit 1 with the rule list.
- Bin launcher was committed without the executable bit.

## Security review

| Area | Finding | Severity | Status |
|---|---|---|---|
| Resource exhaustion | deep nesting crash; quadratic script scan | Medium (CLI crash / CI hang on large input) | Fixed |
| Silent failure | unknown `--rule` passed the gate | Medium (CI correctness) | Fixed |
| Code execution | file content is never executed or fetched; no runtime deps | Info | Verified by review |
| Path handling | discovery reads only given paths; directory walk does not follow symlinked directories | Info | Verified by review |
| Workflow permissions | already `contents: read` | Info | none |
| Secrets in tree/history | 1 commit scanned, no hits | Info | none |

## Acceptance checklist

| Item | Expected behaviour | Command / test | Result | Reference |
|---|---|---|---|---|
| Ten rules fire on real defects | example fixture trips all 11 finding ids | `test/fixtures.test.ts`, CI fixture job | pass | `src/rules.ts` |
| No false positives on accessible markup | negatives fixtures produce 0 findings | `test/fixtures.test.ts` | pass | `src/rules.ts` |
| Tricky defects found | exact planted set | `test/fixtures.test.ts` | pass | `src/rules.ts`, `src/html.ts` |
| Affected-user text on every finding | `affected` in text and JSON | `test/report.test.ts` | pass | `src/report.ts` |
| Positions | 1-based line:column | `test/position.test.ts` | pass | `src/position.ts` |
| Exit codes 0 / 1 / 3 and `--fail-on` | as documented | `test/cli.test.ts`, `test/robustness.test.ts` | pass | `src/cli.ts` |
| Robust on hostile input | deep nesting, many scripts, malformed HTML | `test/robustness.test.ts`, `test/html.test.ts` | pass | `src/html.ts` |
| Zero runtime dependencies | bin runs with `node_modules` removed | CI job, clean clone | pass | `package.json` |

## CI status

- Default branch (`main` @ 25de427): last run `success`.
- Audit branch: pending until pushed.

## Limitations

No contrast checks, no HTML5 implicit tag closing, no rendering (CSS-hidden content and
`display:none` are not known), heuristic link-text list, `onclick` on `<body>`/`<label>` treated as
delegation. Dev-tooling advisories need a vitest major upgrade.

## Tested commit

`06c440b2adbe38b4813e8e452b1d9b78f59ca41f` (clean clone), 2026-10-22.

## Classification proposal

**Partially Verified** — documented scope is implemented and tested locally (macOS, Node 20/22/24)
and from a clean clone; CI on the audit branch (including Windows) has not run yet.
