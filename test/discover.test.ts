import { describe, expect, it } from "vitest";

import { A11ySweepError } from "../src/errors.js";
import { discover } from "../src/discover.js";
import { tempTree } from "./helpers.js";

describe("discover", () => {
  it("accepts a single .html file", () => {
    const root = tempTree({ "a.html": "<p>x</p>" });
    const found = discover([`${root}/a.html`]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("a.html");
  });

  it("accepts .htm as well as .html", () => {
    const root = tempTree({ "a.htm": "<p>x</p>" });
    expect(discover([`${root}/a.htm`])).toHaveLength(1);
  });

  it("walks a directory recursively", () => {
    const root = tempTree({
      "a.html": "<p>x</p>",
      "sub/b.html": "<p>y</p>",
    });
    const found = discover([root]);
    expect(found).toHaveLength(2);
  });

  it("ignores non-html files inside a directory", () => {
    const root = tempTree({ "a.html": "<p>x</p>", "notes.txt": "not html" });
    const found = discover([root]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("a.html");
  });

  it("returns a sorted, deduplicated list", () => {
    const root = tempTree({ "b.html": "1", "a.html": "2" });
    const found = discover([root, `${root}/a.html`]);
    expect(found).toHaveLength(2);
    expect(found).toEqual([...found].sort());
  });

  it("rejects an explicit non-html file", () => {
    const root = tempTree({ "notes.txt": "x" });
    expect(() => discover([`${root}/notes.txt`])).toThrow(A11ySweepError);
  });

  it("reports a missing path with its name", () => {
    expect(() => discover(["/definitely/does/not/exist.html"])).toThrow(A11ySweepError);
  });
});
