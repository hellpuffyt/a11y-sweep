# Changelog

## Unreleased

### Fixed

- False positives on correct markup: images named by `aria-label` or marked
  `role="presentation"`/`aria-hidden`; controls named by `title`; `type="reset"`
  and upper-case `type` values; links named by a descendant's `aria-label` or
  by `title`; `onclick` on `<summary>`, `<label>`, `<body>` or on elements with
  ARIA widget roles other than `button`/`link`; layout tables; hidden or
  `aria-label`led iframes; `missing-title` on partials without `<html>`.
- Missed defects: blank `aria-label`/`aria-labelledby`/`title` counted as a
  name; `&nbsp;`-only links and entity-encoded vague text; `<title>` inside
  `<svg>` counted as the page title; a nested table's `<th>` hid a headerless
  outer table; `tabindex` values like `abc` counted as focusable.
- Deeply nested documents (~20k levels) crashed with a stack overflow; the
  tree walk and text extraction are now iterative.
- Pages with many `<script>`/`<style>` blocks were parsed in quadratic time.
- `--rule` with an unknown name selected nothing and passed silently; it is
  now a usage error (exit 1).
- Dev dependencies updated with `npm audit fix`.

## 0.1.0 — 2026-09-01

Initial release.

- A minimal, from-scratch HTML parser (`src/html.ts`) with source
  positions on every element — not a spec-compliant HTML5 parser (no
  implicit tag-closing), but well-formed, explicitly-closed HTML parses
  correctly and malformed input degrades gracefully rather than throwing.
- Ten accessibility rules, each naming the affected user and what happens
  to them: missing `alt`, unlabelled form controls, empty/vague link text,
  heading hierarchy skips, missing document `lang`, keyboard-unreachable
  `onclick` handlers, missing/empty `<title>`, headerless data tables,
  duplicate `id`s, and titleless `<iframe>`s.
- `a11y-sweep <path...>` CLI over files and directories (recursive): text
  and JSON output, per-rule filtering, `--list-rules`, CI exit codes (`0`
  clean, `1` input error, `3` findings at or above `--fail-on`, default
  `error`).
- Zero runtime dependencies; Node 20+.
