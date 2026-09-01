# Contributing

Thanks for looking into a11y-sweep.

## Setup

```console
npm ci
npm test          # vitest
npm run typecheck # tsc --noEmit, strict
npm run lint      # eslint
npm run build     # emits dist/, which the bin entry point imports
```

## Ground rules

- **Zero runtime dependencies.** `dependencies: {}` is a feature, not an
  oversight — including no HTML parsing library. The parser in `html.ts`
  is deliberately minimal, not a competitor to a real HTML5 parser.
- **Every rule names the affected user and the consequence**, never just
  restates the rule's own name. A new rule needs a real `affected` string
  describing who runs into the problem and what actually happens to them.
- **No color/contrast checking.** That needs a CSS engine and computed
  styles; a static-HTML-only tool that faked it would be confidently
  wrong. Out of scope by design.
- **Test each rule in isolation** with the `only(rule, html)` helper in
  `test/rules.test.ts` — a bare HTML fragment trips page-level rules
  (`missing-title`, `missing-lang`) that have nothing to do with what a
  specific-rule test is checking.
