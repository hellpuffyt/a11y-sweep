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

const INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "textarea"]);

const missingAltText: Rule = (doc) => {
  const findings: Finding[] = [];
  for (const el of walk(doc.root)) {
    if (el.tag !== "img") continue;
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
    const type = el.attributes.get("type");
    if (type === "hidden" || type === "submit" || type === "button" || type === "image") {
      continue;
    }
    if (el.attributes.has("aria-label") || el.attributes.has("aria-labelledby")) continue;
    const id = el.attributes.get("id");
    const hasLabelFor = id !== undefined && ids.labelFor.has(id);
    const hasWrappingLabel = hasAncestor(el, "label");
    if (hasLabelFor || hasWrappingLabel) continue;
    findings.push(
      finding(el, {
        rule: "unlabelled-form-control",
        severity: "error",
        message: `<${el.tag}> has no associated <label>, aria-label, or aria-labelledby`,
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
    if (el.attributes.has("aria-label") || el.attributes.has("aria-labelledby")) continue;
    const text = textContent(el);
    const hasImgAlt = findFirstDescendant(el, (d) => d.tag === "img" && !!d.attributes.get("alt"));
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
    const role = el.attributes.get("role");
    const tabindex = el.attributes.get("tabindex");
    const isInteractiveRole = role !== undefined && ["button", "link"].includes(role);
    const isFocusable = tabindex !== undefined && tabindex !== "-1";
    if (isInteractiveRole && isFocusable) continue;
    findings.push(
      finding(el, {
        rule: "keyboard-unreachable-interactive",
        severity: "error",
        message: `<${el.tag}> has an onclick handler but is not keyboard-focusable ` +
          "(no role + tabindex making it act like a button or link)",
        affected:
          "a keyboard-only or switch-device user cannot Tab to this element " +
          "or activate it at all — the action exists only for a mouse",
      }),
    );
  }
  return findings;
};

const missingPageTitle: Rule = (doc) => {
  const title = findFirstDescendant(doc.root, (el) => el.tag === "title");
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
    const hasHeaderCell = !!findFirstDescendant(el, (d) => d.tag === "th");
    const hasDataRow = !!findFirstDescendant(el, (d) => d.tag === "td");
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
    const title = el.attributes.get("title");
    if (title === undefined || title.trim() === "") {
      findings.push(
        finding(el, {
          rule: "iframe-missing-title",
          severity: "warning",
          message: "<iframe> has no title attribute",
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
