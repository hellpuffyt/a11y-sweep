/**
 * A minimal HTML parser sized to this tool's actual job: locate elements,
 * their attributes, and their text content, with a source position on
 * every element. It is not a spec-compliant HTML5 parser — there is no
 * implicit tag-closing (`<p>` auto-closing on the next `<p>`, `<li>`
 * closing its sibling, and so on), because getting that exactly right
 * needs the full HTML5 tree-construction algorithm, and an accessibility
 * *auditor* only needs the tree well-formed HTML actually produces.
 *
 * Malformed input degrades gracefully rather than throwing: an unmatched
 * closing tag is ignored, and any tags still open at end-of-input are
 * closed implicitly. A tool whose job is finding real problems must not
 * itself crash on the messy HTML most real pages contain.
 */

import type { Position } from "./position.js";
import { PositionTracker } from "./position.js";

export interface ElementNode {
  readonly type: "element";
  readonly tag: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: Node[];
  readonly position: Position;
  parent: ElementNode | null;
}

export interface TextNode {
  readonly type: "text";
  readonly value: string;
}

export type Node = ElementNode | TextNode;

export interface Document {
  readonly root: ElementNode;
}

/** Elements with no closing tag and no children, per the HTML spec. */
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const TAG_NAME = /^[a-zA-Z][a-zA-Z0-9:-]*/;
const ATTR_NAME = /^[^\s"'>/=]+/;

export function parse(html: string): Document {
  const tracker = new PositionTracker(html);
  const root: ElementNode = {
    type: "element",
    tag: "#document",
    attributes: new Map(),
    children: [],
    position: { line: 1, column: 1 },
    parent: null,
  };
  const stack: ElementNode[] = [root];
  let i = 0;
  const n = html.length;

  const current = (): ElementNode => stack[stack.length - 1] as ElementNode;

  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      appendText(current(), html.slice(i));
      break;
    }
    if (lt > i) appendText(current(), html.slice(i, lt));

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      // Doctype or processing instruction: skip to the closing '>'.
      const end = html.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (html.startsWith("</", lt)) {
      const close = html.indexOf(">", lt);
      if (close === -1) {
        i = n;
        break;
      }
      const name = (html.slice(lt + 2, close).match(TAG_NAME)?.[0] ?? "").toLowerCase();
      // Close back up the stack to the matching open ancestor, if any
      // (searching from the top down; index 0 is the #document root and is
      // never closed). An unmatched closing tag is simply ignored.
      let match = stack.length - 1;
      while (match > 0 && (stack[match] as ElementNode).tag !== name) match -= 1;
      if (match > 0) stack.length = match;
      i = close + 1;
      continue;
    }

    // An opening tag, or something that merely starts with '<' but is not
    // a valid tag name (a stray '<' in text) — treated as text either way.
    const nameMatch = html.slice(lt + 1).match(TAG_NAME);
    if (!nameMatch) {
      appendText(current(), "<");
      i = lt + 1;
      continue;
    }
    const tagStart = lt;
    const tag = nameMatch[0].toLowerCase();
    let cursor = lt + 1 + nameMatch[0].length;
    const attributes = new Map<string, string>();

    while (cursor < n) {
      while (cursor < n && /\s/.test(html[cursor] as string)) cursor += 1;
      if (html.startsWith("/>", cursor)) {
        cursor += 2;
        break;
      }
      if (html[cursor] === ">") {
        cursor += 1;
        break;
      }
      if (cursor >= n) break;
      const attrMatch = html.slice(cursor).match(ATTR_NAME);
      if (!attrMatch) {
        cursor += 1; // skip one stray character rather than loop forever
        continue;
      }
      const attrName = attrMatch[0].toLowerCase();
      cursor += attrMatch[0].length;
      while (cursor < n && /\s/.test(html[cursor] as string)) cursor += 1;
      let value = "";
      if (html[cursor] === "=") {
        cursor += 1;
        while (cursor < n && /\s/.test(html[cursor] as string)) cursor += 1;
        const quote = html[cursor];
        if (quote === '"' || quote === "'") {
          const end = html.indexOf(quote, cursor + 1);
          const valueEnd = end === -1 ? n : end;
          value = html.slice(cursor + 1, valueEnd);
          cursor = end === -1 ? n : end + 1;
        } else {
          const rest = html.slice(cursor);
          const unquoted = rest.match(/^[^\s>]*/);
          value = unquoted?.[0] ?? "";
          cursor += value.length;
        }
      }
      attributes.set(attrName, value);
    }

    const selfClosing = html.slice(tagStart, cursor).trimEnd().endsWith("/>");
    const element: ElementNode = {
      type: "element",
      tag,
      attributes,
      children: [],
      position: tracker.at(tagStart),
      parent: current(),
    };
    current().children.push(element);

    if (tag === "script" || tag === "style") {
      // Content is not HTML; scan verbatim to the matching closing tag so
      // '<' inside JS/CSS is never mistaken for markup.
      // Case-insensitive search from `cursor` only: lower-casing the whole
      // document once per <script> made many-script pages quadratic.
      const closeRe = new RegExp(`</${tag}`, "ig");
      closeRe.lastIndex = cursor;
      const closeIndex = closeRe.exec(html)?.index ?? -1;
      const contentEnd = closeIndex === -1 ? n : closeIndex;
      appendText(element, html.slice(cursor, contentEnd));
      if (closeIndex === -1) {
        i = n;
      } else {
        const tagEnd = html.indexOf(">", closeIndex);
        i = tagEnd === -1 ? n : tagEnd + 1;
      }
    } else if (!selfClosing && !VOID_ELEMENTS.has(tag)) {
      stack.push(element);
      i = cursor;
    } else {
      i = cursor;
    }
  }

  return { root };
}

function appendText(parent: ElementNode, value: string): void {
  if (value === "") return;
  const last = parent.children[parent.children.length - 1];
  if (last && last.type === "text") {
    parent.children[parent.children.length - 1] = { type: "text", value: last.value + value };
  } else {
    parent.children.push({ type: "text", value });
  }
}

/** Depth-first walk over every element in document order. Iterative, so
 * deeply nested markup cannot overflow the call stack. */
export function* walk(node: ElementNode): Generator<ElementNode> {
  const pending: ElementNode[] = [];
  const pushChildren = (el: ElementNode): void => {
    for (let i = el.children.length - 1; i >= 0; i -= 1) {
      const child = el.children[i] as Node;
      if (child.type === "element") pending.push(child);
    }
  };
  pushChildren(node);
  while (pending.length > 0) {
    const el = pending.pop() as ElementNode;
    yield el;
    pushChildren(el);
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

/** Decode the character references that matter for an accessible name
 * (`&nbsp;` alone must count as empty text, `&amp;` as one character). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/** The concatenation of every text descendant, entity-decoded and
 * whitespace-collapsed — an element's "accessible name from content", the
 * same signal a screen reader falls back to when nothing more specific is
 * declared. Iterative, like `walk`. */
export function textContent(node: ElementNode): string {
  let out = "";
  const pending: Node[] = [...node.children].reverse();
  while (pending.length > 0) {
    const child = pending.pop() as Node;
    if (child.type === "text") {
      out += child.value;
    } else {
      for (let i = child.children.length - 1; i >= 0; i -= 1) pending.push(child.children[i] as Node);
    }
  }
  return decodeEntities(out).replace(/[\s\u00a0]+/g, " ").trim();
}

export function findFirst(
  root: ElementNode,
  predicate: (el: ElementNode) => boolean,
): ElementNode | undefined {
  for (const el of walk(root)) {
    if (predicate(el)) return el;
  }
  return undefined;
}
