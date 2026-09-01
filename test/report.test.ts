import { describe, expect, it } from "vitest";

import { auditSource } from "../src/audit.js";
import { renderJson, renderText } from "../src/report.js";

describe("renderText", () => {
  it("says explicitly when a file has no findings", () => {
    const result = auditSource("a.html", '<html lang="en"><head><title>T</title></head></html>');
    const text = renderText([result]);
    expect(text).toContain("a.html");
    expect(text).toContain("no findings");
  });

  it("includes the rule, position, message and affected line", () => {
    const result = auditSource("a.html", '<img src="x.png">');
    const text = renderText([result]);
    expect(text).toContain("[missing-alt]");
    expect(text).toContain("1:1");
    expect(text).toContain("<img>");
    expect(text).toContain("screen reader");
  });

  it("renders multiple files each under their own heading", () => {
    const a = auditSource("a.html", '<img src="x.png">');
    const b = auditSource("b.html", '<iframe src="y"></iframe>');
    const text = renderText([a, b]);
    expect(text.indexOf("a.html")).toBeLessThan(text.indexOf("missing-alt"));
    expect(text.indexOf("b.html")).toBeGreaterThan(text.indexOf("missing-alt"));
  });
});

describe("renderJson", () => {
  it("round-trips file, findings, and affected field", () => {
    const result = auditSource("a.html", '<img src="x.png">', ["missing-alt"]);
    const payload = JSON.parse(renderJson([result])) as {
      file: string;
      findings: { rule: string; affected: string; line: number; column: number }[];
    }[];
    expect(payload[0]!.file).toBe("a.html");
    expect(payload[0]!.findings[0]!.rule).toBe("missing-alt");
    expect(payload[0]!.findings[0]!.affected).toMatch(/screen reader/);
    expect(payload[0]!.findings[0]!.line).toBe(1);
  });

  it("an empty findings list renders as an empty array", () => {
    const clean = '<html lang="en"><head><title>T</title></head><body><p>clean</p></body></html>';
    const result = auditSource("a.html", clean);
    const payload = JSON.parse(renderJson([result])) as { findings: unknown[] }[];
    expect(payload[0]!.findings).toEqual([]);
  });
});
