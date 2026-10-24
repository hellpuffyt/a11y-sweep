/**
 * The rules. Each one names *who* is affected and *what happens to them* —
 * a rule that could be satisfied by restating its own name ("img missing
 * alt") does not belong here.
 */

import type { Document, ElementNode } from "./html.js";
import { textContent, walk } from "./html.js";
import type { Finding, Severity } from "./model.js";

type Rule = (doc: Document) => Finding[];

function finding(
  el: ElementNode,
  partial: Omit<Finding, "tag" | "position">,
): Finding {
  return { ...partial, tag: el.tag, position: el.position };
}

const VAGUE_LINK_TEXT = new Set([
  "click here", "here", "read more", "more", "link", "click", "this",
]);

/** Natively focusable/activatable elements, plus elements whose click is
 * forwarded or delegated (label -> its control; body/html -> event delegation). */
const INTERACTIVE_TAGS = new Set([
  "a", "button", "input", "select", "textarea", "summary", "area", "option", "label", "body", "html",
]);

/** ARIA widget roles: an element with one of these plus a tabindex acts as a control. */
const WIDGET_ROLES = new Set([
  "button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox",
  "menuitemradio", "option", "slider", "spinbutton", "textbox", "combobox", "searchbox",
  "treeitem", "gridcell", "scrollbar",
]);

/** True if the attribute is present with a non-blank value. */
function hasText(el: ElementNode, attr: string): boolean {
  const value = el.attributes.get(attr);
  return value !== undefined && value.trim() !== "";
}

/** aria-label / aria-labelledby give an element an accessible name (blank values do not). */
function hasAriaName(el: ElementNode): boolean {
  return hasText(el, "aria-label") || hasText(el, "aria-labelledby");
}

/** Removed from the accessibility tree, so there is nothing for AT to announce. */
function isHiddenFromAT(el: ElementNode): boolean {
  return el.attributes.get("aria-hidden")?.trim().toLowerCase() === "true" || el.attributes.has("hidden");
}

function roleOf(el: ElementNode): string | undefined {
  return el.attributes.get("role")?.trim().toLowerCase().split(/\s+/)[0];
}

const missingAltText: Rule = (doc) => {
  const findings: Finding[] = [];
  for (const el of walk(doc.root)) {
    if (el.tag !== "img") continue;
    // An image named by aria-label/labelledby, or explicitly decorative/hidden,
    // is announced correctly (or not at all) without an alt attribute.
    const role = roleOf(el);
    if (hasAriaName(el) || role === "presentation" || role === "none" || isHiddenFromAT(el)) continue;
    if (!el.attributes.has("alt")) {
      findings.push(
        finding(el, {
          rule: "missing-alt",
          severity: "error",
          message: "<img> has no alt attribute at all",
          affected:
            "a screen reader user hears only 'image' (or the raw file name), " +
            "with no idea what the image shows or why it is there",
        }),
      );
    }
  }
  return findings;
};

const unlabelledFormControl: Rule = (doc) => {
  const findings: Finding[] = [];
  const ids = collectIds(doc.root);
  for (const el of walk(doc.root)) {
    if (!["input", "select", "textarea"].includes(el.tag)) continue;
    const type = el.attributes.get("type")?.trim().toLowerCase();
    // hidden is not exposed; submit/reset/button take their name from `value`
    // (or a default like "Submit"); image takes it from `alt`.
    if (type === "hidden" || type === "submit" || type === "reset" || type === "button" || type === "image") {
      continue;
    }
    if (isHiddenFromAT(el)) continue;
    // `title` is the last-resort accessible name in the HTML-AAM name computation.
    if (hasAriaName(el) || hasText(el, "title")) continue;
    const id = el.attributes.get("id");
    const hasLabelFor = id !== undefined && ids.labelFor.has(id);
    const hasWrappingLabel = hasAncestor(el, "label");
    if (hasLabelFor || hasWrappingLabel) continue;
    findings.push(
      finding(el, {
        rule: "unlabelled-form-control",
        severity: "error",
        message: `<${el.tag}> has no associated <label>, aria-label, aria-labelledby, or title`,
        affected:
          "a screen reader user tabbing into this field hears only its type " +
          "('edit text', 'combo box'), with no idea what information to enter",
      }),
    );
  }
  return findings;
};

const emptyLink: Rule = (doc) => {
  const findings: Finding[] = [];
  for (const el of walk(doc.root)) {
    if (el.tag !== "a" || !el.attributes.has("href")) continue;
    if (isHiddenFromAT(el)) continue;
    if (hasAriaName(el)) continue;
    const text = textContent(el);
    const hasImgAlt = findFirstDescendant(
      el,
      (d) => (d.tag === "img" && hasText(d, "alt")) || (d.tag !== "a" && hasAriaName(d)),
    );
    if (text === "" && !hasImgAlt && hasText(el, "title")) continue;
    if (text === "" && !hasImgAlt) {
      findings.push(
        finding(el, {
          rule: "empty-link",
          severity: "error",
          message: "<a> has an href but no accessible text, label, or image alt text",
          affected:
            "a screen reader user browsing by links hears an empty or 'unlabeled " +
            "link' entry, with no way to know where it goes without following it",
        }),
      );
    } else if (VAGUE_LINK_TEXT.has(text.toLowerCase())) {
      findings.push(
        finding(el, {
          rule: "vague-link-text",
          severity: "warning",
          message: `<a> text is only "${text}"`,
          affected:
            "a screen reader user browsing the page's link list out of context " +
            "sees this link indistinguishable from every other 'click here' on the page",
        }),
      );
    }
  }
  return findings;
};

const headingHierarchySkip: Rule = (doc) => {
  const findings: Finding[] = [];
  let lastLevel = 0;
  for (const el of walk(doc.root)) {
    const match = /^h([1-6])$/.exec(el.tag);
    if (!match) continue;
    const level = Number(match[1]);
    if (lastLevel > 0 && level > lastLevel + 1) {
      findings.push(
        finding(el, {
          rule: "heading-hierarchy-skip",
          severity: "warning",
          message: `<h${level}> follows <h${lastLevel}>, skipping level(s) in between`,
          affected:
            "a screen reader user navigating by heading outline expects each " +
            "level to nest one deeper than the last; a skipped level reads as " +
            "a missing section, not a passed-over one",
        }),
      );
    }
    lastLevel = level;
  }
  return findings;
};

const missingDocumentLanguage: Rule = (doc) => {
  const html = findFirstDescendant(doc.root, (el) => el.tag === "html");
  if (!html) return [];
  const lang = html.attributes.get("lang");
  if (lang === undefined || lang.trim() === "") {
    return [
      finding(html, {
        rule: "missing-lang",
        severity: "error",
        message: "<html> has no lang attribute",
        affected:
          "a screen reader defaults to its own language's pronunciation rules " +
          "for the whole page, so non-English text is read with wrong sounds " +
          "and wrong stress, sometimes unintelligibly",
      }),
    ];
  }
  return [];
};

const keyboardUnreachableInteractive: Rule = (doc) => {
  const findings: Finding[] = [];
  for (const el of walk(doc.root)) {
    if (INTERACTIVE_TAGS.has(el.tag)) continue;
    const hasClickHandler = [...el.attributes.keys()].some((name) => name === "onclick");
    if (!hasClickHandler) continue;
    if (isHiddenFromAT(el)) continue;
    const role = roleOf(el);
    const tabindex = el.attributes.get("tabindex")?.trim();
    const isInteractiveRole = role !== undefined && WIDGET_ROLES.has(role);
    const isFocusable = tabindex !== undefined && /^-?\d+$/.test(tabindex) && Number(tabindex) >= 0;
    if (isInteractiveRole && isFocusable) continue;
    findings.push(
      finding(el, {
        rule: "keyboard-unreachable-interactive",
        severity: "error",
        message: `<${el.tag}> has an onclick handler but is not keyboard-focusable ` +
          "(no widget role + tabindex >= 0 making it act like a button or link)",
        affected:
          "a keyboard-only or switch-device user cannot Tab to this element " +
          "or activate it at all — the action exists only for a mouse",
      }),
    );
  }
  return findings;
};

const missingPageTitle: Rule = (doc) => {
  // A fragment/partial (no <html> element) is not a page; it has no title by design.
  if (!findFirstDescendant(doc.root, (el) => el.tag === "html")) return [];
  // <title> inside inline SVG names the graphic, not the page.
  const title = findFirstDescendant(doc.root, (el) => el.tag === "title" && !hasAncestor(el, "svg"));
  const head = findFirstDescendant(doc.root, (el) => el.tag === "head") ?? doc.root;
  if (!title || textContent(title) === "") {
    return [
      finding(title ?? head, {
        rule: "missing-title",
        severity: "error",
        message: title ? "<title> is empty" : "document has no <title>",
        affected:
          "a screen reader announces the page title the moment it loads, and " +
          "a browser tab/history entry shows it too; without one, a user " +
          "arriving on this page (including via search results) has no idea " +
          "what it is before reading further",
      }),
    ];
  }
  return [];
};

const dataTableMissingHeaders: Rule = (doc) => {
  const findings: Finding[] = [];
  for (const el of walk(doc.root)) {
    if (el.tag !== "table") continue;
    // role=presentation/none marks a layout table: no headers expected.
    const role = roleOf(el);
    if (role === "presentation" || role === "none" || isHiddenFromAT(el)) continue;
    // Only this table's own cells count, not those of a table nested inside it.
    const ownCell = (d: ElementNode, tag: string): boolean => d.tag === tag && nearestTable(d) === el;
    const hasHeaderCell = !!findFirstDescendant(el, (d) => ownCell(d, "th"));
    const hasDataRow = !!findFirstDescendant(el, (d) => ownCell(d, "td"));
    if (hasDataRow && !hasHeaderCell) {
      findings.push(
        finding(el, {
          rule: "table-missing-headers",
          severity: "error",
          message: "<table> has data cells but no <th> header cells",
          affected:
            "a screen reader user navigating cell-by-cell hears only raw " +
            "values with no column/row context — 'forty two' instead of " +
            "'Age: forty two' — because there is no header to announce",
        }),
      );
    }
  }
  return findings;
};

const duplicateIds: Rule = (doc) => {
  const seen = new Map<string, ElementNode>();
  const findings: Finding[] = [];
  for (const el of walk(doc.root)) {
    const id = el.attributes.get("id");
    if (!id) continue;
    if (seen.has(id)) {
      findings.push(
        finding(el, {
          rule: "duplicate-id",
          severity: "error",
          message: `id="${id}" is also used elsewhere in the document`,
          affected:
            "aria-labelledby, aria-describedby, and <label for> all resolve " +
            "by id; a duplicate makes assistive technology pick whichever " +
            "element it finds first, silently mislabelling the other one",
        }),
      );
    } else {
      seen.set(id, el);
    }
  }
  return findings;
};

const iframeMissingTitle: Rule = (doc) => {
  const findings: Finding[] = [];
  for (const el of walk(doc.root)) {
    if (el.tag !== "iframe") continue;
    if (isHiddenFromAT(el) || hasAriaName(el)) continue;
    if (!hasText(el, "title")) {
      findings.push(
        finding(el, {
          rule: "iframe-missing-title",
          severity: "warning",
          message: "<iframe> has no non-blank title, aria-label, or aria-labelledby",
          affected:
            "a screen reader user tabbing through the page hears only " +
            "'iframe' with no indication of what content it embeds before " +
            "deciding whether to enter it",
        }),
      );
    }
  }
  return findings;
};

export const RULES: Record<string, Rule> = {
  "missing-alt": missingAltText,
  "unlabelled-form-control": unlabelledFormControl,
  "link-text": emptyLink,
  "heading-hierarchy-skip": headingHierarchySkip,
  "missing-lang": missingDocumentLanguage,
  "keyboard-unreachable-interactive": keyboardUnreachableInteractive,
  "missing-title": missingPageTitle,
  "table-missing-headers": dataTableMissingHeaders,
  "duplicate-id": duplicateIds,
  "iframe-missing-title": iframeMissingTitle,
};

export function runRules(doc: Document, only?: readonly string[]): Finding[] {
  const wanted = only ? RULES_SUBSET(only) : RULES;
  const findings: Finding[] = [];
  for (const rule of Object.values(wanted)) findings.push(...rule(doc));
  findings.sort((a, b) => {
    const bySeverity =
      severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    if (a.position.line !== b.position.line) return a.position.line - b.position.line;
    return a.position.column - b.position.column;
  });
  return findings;
}

function RULES_SUBSET(names: readonly string[]): Record<string, Rule> {
  const out: Record<string, Rule> = {};
  for (const name of names) {
    if (name in RULES) out[name] = RULES[name] as Rule;
  }
  return out;
}

function severityRank(severity: Severity): number {
  return { info: 0, warning: 1, error: 2 }[severity];
}

function collectIds(root: ElementNode): { labelFor: Set<string> } {
  const labelFor = new Set<string>();
  for (const el of walk(root)) {
    if (el.tag === "label") {
      const target = el.attributes.get("for");
      if (target) labelFor.add(target);
    }
  }
  return { labelFor };
}

function nearestTable(el: ElementNode): ElementNode | null {
  let node: ElementNode | null = el.parent;
  while (node && node.tag !== "table") node = node.parent;
  return node;
}

function hasAncestor(el: ElementNode, tag: string): boolean {
  let node: ElementNode | null = el.parent;
  while (node) {
    if (node.tag === tag) return true;
    node = node.parent;
  }
  return false;
}

function findFirstDescendant(
  root: ElementNode,
  predicate: (el: ElementNode) => boolean,
): ElementNode | undefined {
  for (const el of walk(root)) {
    if (predicate(el)) return el;
  }
  return undefined;
}
