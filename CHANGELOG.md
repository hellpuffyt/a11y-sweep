# Changelog

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
