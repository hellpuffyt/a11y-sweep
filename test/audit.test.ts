import { describe, expect, it } from "vitest";

import { auditFile, auditSource } from "../src/audit.js";
import { A11ySweepError } from "../src/errors.js";
import { tempTree } from "./helpers.js";

describe("auditSource", () => {
  it("returns the file name and its findings", () => {
    const result = auditSource("a.html", '<img src="x.png">', ["missing-alt"]);
    expect(result.file).toBe("a.html");
    expect(result.findings.map((f) => f.rule)).toEqual(["missing-alt"]);
  });

  it("respects a rule filter", () => {
    const html = '<img src="x.png"><iframe src="y"></iframe>';
    const result = auditSource("a.html", html, ["iframe-missing-title"]);
    expect(result.findings.map((f) => f.rule)).toEqual(["iframe-missing-title"]);
  });
});

describe("auditFile", () => {
  it("reads and audits a real file", () => {
    const root = tempTree({ "a.html": '<img src="x.png">' });
    const result = auditFile(`${root}/a.html`, ["missing-alt"]);
    expect(result.findings.map((f) => f.rule)).toEqual(["missing-alt"]);
  });

  it("reports a missing file with its path", () => {
    expect(() => auditFile("/definitely/absent.html")).toThrow(A11ySweepError);
  });
});
