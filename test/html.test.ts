import { describe, expect, it } from "vitest";

import { findFirst, parse, textContent, walk } from "../src/html.js";

function elements(html: string): string[] {
  return [...walk(parse(html).root)].map((e) => e.tag);
}

describe("parse: basics", () => {
  it("parses a single element", () => {
    expect(elements("<p>hi</p>")).toEqual(["p"]);
  });

  it("parses nested elements in document order", () => {
    expect(elements("<div><span>a</span><b>c</b></div>")).toEqual(["div", "span", "b"]);
  });

  it("lower-cases tag names", () => {
    expect(elements("<DIV><SPAN></SPAN></DIV>")).toEqual(["div", "span"]);
  });

  it("captures text content", () => {
    const doc = parse("<p>hello world</p>");
    const p = findFirst(doc.root, (el) => el.tag === "p")!;
    expect(textContent(p)).toBe("hello world");
  });

  it("collapses whitespace in text content", () => {
    const doc = parse("<p>  hello \n   world  </p>");
    const p = findFirst(doc.root, (el) => el.tag === "p")!;
    expect(textContent(p)).toBe("hello world");
  });
});

describe("parse: attributes", () => {
  it("reads double-quoted attribute values", () => {
    const doc = parse('<a href="/x">l</a>');
    const a = findFirst(doc.root, (el) => el.tag === "a")!;
    expect(a.attributes.get("href")).toBe("/x");
  });

  it("reads single-quoted attribute values", () => {
    const doc = parse("<a href='/x'>l</a>");
    const a = findFirst(doc.root, (el) => el.tag === "a")!;
    expect(a.attributes.get("href")).toBe("/x");
  });

  it("reads unquoted attribute values", () => {
    const doc = parse("<input type=text>");
    const input = findFirst(doc.root, (el) => el.tag === "input")!;
    expect(input.attributes.get("type")).toBe("text");
  });

  it("treats a bare attribute as an empty string, not absent", () => {
    const doc = parse("<input disabled>");
    const input = findFirst(doc.root, (el) => el.tag === "input")!;
    expect(input.attributes.has("disabled")).toBe(true);
    expect(input.attributes.get("disabled")).toBe("");
  });

  it("lower-cases attribute names but preserves value casing", () => {
    const doc = parse('<div ID="Foo">x</div>');
    const div = findFirst(doc.root, (el) => el.tag === "div")!;
    expect(div.attributes.get("id")).toBe("Foo");
  });

  it("handles multiple attributes", () => {
    const doc = parse('<a href="/x" class="btn" title="go">l</a>');
    const a = findFirst(doc.root, (el) => el.tag === "a")!;
    expect(a.attributes.get("href")).toBe("/x");
    expect(a.attributes.get("class")).toBe("btn");
    expect(a.attributes.get("title")).toBe("go");
  });
});

describe("parse: void and self-closing elements", () => {
  it("does not expect a closing tag for void elements", () => {
    expect(elements("<img src=a.png><p>after</p>")).toEqual(["img", "p"]);
  });

  it("treats an explicit self-close the same as a void element", () => {
    expect(elements('<br/><p>after</p>')).toEqual(["br", "p"]);
  });

  it("a non-void element written self-closed still does not swallow siblings", () => {
    // <custom-el/> is not a real void tag; the parser does not special-case
    // it, but the explicit '/>' still ends the start tag.
    expect(elements("<div/><p>after</p>")).toEqual(["div", "p"]);
  });
});

describe("parse: closing tags (regression: stack must actually pop)", () => {
  it("a closed element does not absorb its following siblings", () => {
    // The bug this guards: closing the element at the TOP of the stack
    // (the ordinary, common case) must actually remove it.
    const doc = parse("<a href='/x'>click here</a><a href='/y'></a>");
    const links = [...walk(doc.root)].filter((el) => el.tag === "a");
    expect(links).toHaveLength(2);
    expect(textContent(links[0]!)).toBe("click here");
    expect(textContent(links[1]!)).toBe("");
  });

  it("closing an element pops exactly that element, not its ancestors", () => {
    const doc = parse("<div><span>a</span><em>b</em></div>");
    const div = findFirst(doc.root, (el) => el.tag === "div")!;
    expect(div.children.map((c) => (c.type === "element" ? c.tag : c.type))).toEqual([
      "span",
      "em",
    ]);
  });

  it("many same-tag siblings each close independently", () => {
    const doc = parse("<li>a</li><li>b</li><li>c</li>");
    const items = [...walk(doc.root)].filter((el) => el.tag === "li");
    expect(items.map((li) => textContent(li))).toEqual(["a", "b", "c"]);
  });

  it("deeply nested same-tag elements close to the correct ancestor", () => {
    const doc = parse("<div id='outer'><div id='inner'>x</div> y</div>");
    const outer = findFirst(doc.root, (el) => el.attributes.get("id") === "outer")!;
    const inner = findFirst(doc.root, (el) => el.attributes.get("id") === "inner")!;
    expect(textContent(inner)).toBe("x");
    // Text "y" belongs to outer, after inner closes - not swallowed by inner.
    expect(textContent(outer)).toBe("x y");
  });

  it("an unmatched closing tag is ignored rather than corrupting the stack", () => {
    const doc = parse("<div>a</span> b</div><p>after</p>");
    expect(elements("<div>a</span> b</div><p>after</p>")).toEqual(["div", "p"]);
    const div = findFirst(doc.root, (el) => el.tag === "div")!;
    expect(textContent(div)).toBe("a b");
  });
});

describe("parse: comments, doctype, processing-instruction-like content", () => {
  it("skips comments without parsing their contents as tags", () => {
    expect(elements("<!-- <div>fake</div> --><p>real</p>")).toEqual(["p"]);
  });

  it("skips a doctype declaration", () => {
    expect(elements("<!DOCTYPE html><p>x</p>")).toEqual(["p"]);
  });

  it("handles an unterminated comment gracefully", () => {
    expect(() => parse("<!-- never closes")).not.toThrow();
  });
});

describe("parse: script and style content", () => {
  it("does not parse '<' inside a script body as a tag", () => {
    const html = "<script>if (a < b) { console.log('<div>'); }</script><p>after</p>";
    expect(elements(html)).toEqual(["script", "p"]);
  });

  it("captures script text content verbatim", () => {
    const doc = parse("<script>const x = 1;</script>");
    const script = findFirst(doc.root, (el) => el.tag === "script")!;
    expect(textContent(script)).toContain("const x = 1;");
  });

  it("does not parse tags inside a style body", () => {
    const html = "<style>p::before { content: '<x>'; }</style><p>after</p>";
    expect(elements(html)).toEqual(["style", "p"]);
  });

  it("an unterminated script tag consumes to end of input without throwing", () => {
    expect(() => parse("<script>never closes")).not.toThrow();
  });
});

describe("parse: malformed input degrades gracefully", () => {
  it("an unclosed tag at end of input does not throw", () => {
    expect(() => parse("<div><p>text")).not.toThrow();
  });

  it("a stray '<' with no valid tag name is treated as text", () => {
    const doc = parse("<p>a < b</p>");
    const p = findFirst(doc.root, (el) => el.tag === "p")!;
    expect(textContent(p)).toContain("a");
  });

  it("an unterminated attribute value does not throw", () => {
    expect(() => parse('<div title="unterminated')).not.toThrow();
  });

  it("empty input parses to an empty document", () => {
    expect(elements("")).toEqual([]);
  });
});

describe("walk and findFirst", () => {
  it("findFirst returns undefined when nothing matches", () => {
    const doc = parse("<p>x</p>");
    expect(findFirst(doc.root, (el) => el.tag === "nope")).toBeUndefined();
  });

  it("walk visits elements depth-first in document order", () => {
    const doc = parse("<a><b><c/></b><d/></a>");
    expect([...walk(doc.root)].map((e) => e.tag)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("parse: position tracking", () => {
  it("records the line and column of each element's opening tag", () => {
    const doc = parse("<div>\n  <p>x</p>\n</div>");
    const p = findFirst(doc.root, (el) => el.tag === "p")!;
    expect(p.position).toEqual({ line: 2, column: 3 });
  });
});
