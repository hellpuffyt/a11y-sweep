import { describe, expect, it } from "vitest";

import { auditSource } from "../src/audit.js";
import { main } from "../src/cli.js";
import { decodeEntities, parse, textContent } from "../src/html.js";
import { fakeIo, tempTree } from "./helpers.js";

describe("resource robustness", () => {
  it("audits deeply nested markup without overflowing the stack", () => {
    const depth = 50_000;
    const html = `<html lang="en"><title>t</title>${"<div>".repeat(depth)}<img src="x">${"</div>".repeat(depth)}</html>`;
    const result = auditSource("deep.html", html);
    expect(result.findings.map((f) => f.rule)).toEqual(["missing-alt"]);
  });

  it("stays linear on pages with many <script> blocks", () => {
    const html = `<html lang="en"><title>t</title>${"<script>if (a < b) x()</script><p>x</p>".repeat(40_000)}</html>`;
    const started = performance.now();
    auditSource("scripts.html", html);
    // Was quadratic (whole document lower-cased once per <script>): ~3 s for 20k scripts.
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("finds a mixed-case closing script tag", () => {
    const doc = parse("<script>x < y</SCRIPT><img src=a>");
    expect(doc.root.children.map((c) => (c.type === "element" ? c.tag : "#text"))).toEqual(["script", "img"]);
  });
});

describe("accessible-name text", () => {
  it("decodes character references and treats &nbsp; as whitespace", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &#65;&#x42; &unknown;")).toBe("a & b <c> AB &unknown;");
    const doc = parse("<a href=x>&nbsp;&#160;</a>");
    const link = doc.root.children[0];
    expect(link && link.type === "element" ? textContent(link) : "?").toBe("");
  });
});

describe("--rule validation", () => {
  it("rejects an unknown rule instead of silently auditing nothing", () => {
    const root = tempTree({ "a.html": '<img src="x.png">' });
    const { io, err } = fakeIo();
    expect(main([`${root}/a.html`, "--rule", "missing-alt-typo"], io)).toBe(1);
    expect(err()).toContain("unknown rule missing-alt-typo");
  });

  it("rejects a finding id that is not a rule name, with a hint", () => {
    const { io, err } = fakeIo();
    expect(main(["a.html", "--rule", "empty-link"], io)).toBe(1);
    expect(err()).toContain("link-text rule reports empty-link");
  });
});
