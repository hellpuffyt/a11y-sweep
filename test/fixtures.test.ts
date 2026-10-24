import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { auditFile } from "../src/audit.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

describe("true negatives: accessible markup produces no findings", () => {
  it.each(["accessible-edge-cases.html", "partial.html"])("%s", (name) => {
    const result = auditFile(path.join(fixtures, "negatives", name));
    expect(result.findings.map((f) => `${f.rule}@${f.position.line}`)).toEqual([]);
  });
});

describe("true positives: defects that are easy to miss are reported", () => {
  it("tricky-defects.html reports exactly the planted defects", () => {
    const result = auditFile(path.join(fixtures, "positives", "tricky-defects.html"));
    const found = result.findings.map((f) => `${f.rule}@${f.position.line}`).sort();
    expect(found).toEqual(
      [
        "missing-title@3", // reported on <head>: a <title> only inside <svg> is not a page title
        "empty-link@7", // &nbsp; is not link text
        "vague-link-text@8", // "Read&#32;more" decodes to "Read more"
        "unlabelled-form-control@9", // a blank aria-label is no label
        "missing-alt@10", // a blank aria-label does not replace alt
        "keyboard-unreachable-interactive@11", // tabindex=-1 is not in the Tab order
        "keyboard-unreachable-interactive@12", // banner is not a widget role
        "table-missing-headers@13", // the nested table's <th> does not head the outer table
        "iframe-missing-title@16", // a blank title is no title
      ].sort(),
    );
  });

  it("the bundled example still trips every rule", () => {
    const result = auditFile(path.join(fixtures, "example.html"));
    expect(new Set(result.findings.map((f) => f.rule)).size).toBe(11);
  });
});
