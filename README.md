# a11y-sweep

Audit static HTML for accessibility defects — with findings that name the
**affected user and what happens to them**, never just the failing rule.
Zero runtime dependencies.

```console
$ a11y-sweep page.html
page.html
  ERROR   [missing-alt] 12:5 <img> <img> has no alt attribute at all
            a screen reader user hears only 'image' (or the raw file name),
            with no idea what the image shows or why it is there
  ERROR   [unlabelled-form-control] 20:3 <input> <input> has no associated
            <label>, aria-label, or aria-labelledby
            a screen reader user tabbing into this field hears only its
            type ('edit text', 'combo box'), with no idea what information
            to enter
```

## Why "affected user", not "rule name"

"img missing alt" tells you what to fix but not why it matters, and a
message that only restates a rule's name gets ignored the second time it's
seen. Every finding here names the *consequence*: who runs into it (a
screen reader user, a keyboard-only user, someone relying on the tab order)
and what actually happens to them. `affected` is a first-class field in
both the text and JSON output.

## The ten checks

| Rule | Catches |
|---|---|
| `missing-alt` | `<img>` with no `alt` attribute at all |
| `unlabelled-form-control` | `<input>`/`<select>`/`<textarea>` with no `<label>`, `aria-label`, or `aria-labelledby` |
| `link-text` | `<a href>` with no accessible text (empty, or only "click here"/"read more") |
| `heading-hierarchy-skip` | `<h1>` → `<h3>` skipping a level |
| `missing-lang` | `<html>` with no `lang` attribute |
| `keyboard-unreachable-interactive` | an `onclick` handler on an element with no keyboard role/focus |
| `missing-title` | no `<title>`, or an empty one |
| `table-missing-headers` | a data table (`<td>`) with no `<th>` |
| `duplicate-id` | an `id` used more than once (breaks `for`/`aria-labelledby`) |
| `iframe-missing-title` | `<iframe>` with no `title` |

## Usage

```console
a11y-sweep page.html other/                # files and directories mix freely
a11y-sweep site/ --format json              # machine-readable, same content
a11y-sweep page.html --rule missing-alt     # one check only (repeatable)
a11y-sweep page.html --fail-on warning      # stricter CI gate
a11y-sweep --list-rules
```

Exit codes: `0` clean at the chosen threshold (default `error`), `1` bad
input or usage, `3` findings at or above `--fail-on`.

## What it deliberately does not do

- **No color contrast checking.** Contrast is a *computed-style* problem —
  it needs a CSS engine, not a static HTML parser — and a tool that faked
  it from inline styles alone would produce confidently wrong results.
- **Not a full HTML5 parser.** There is no implicit tag-closing (`<p>`
  auto-closing on the next `<p>`); malformed input degrades gracefully
  rather than crashing, but this tool assumes reasonably well-formed,
  explicitly-closed HTML — which is what templating engines and static
  site generators actually emit.

## Development

```console
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

MIT licensed.
