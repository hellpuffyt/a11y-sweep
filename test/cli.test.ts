import { describe, expect, it } from "vitest";

import { main, parseArgs } from "../src/cli.js";
import { A11ySweepError } from "../src/errors.js";
import { VERSION } from "../src/version.js";
import { fakeIo, tempTree } from "./helpers.js";

describe("parseArgs", () => {
  it("defaults to text format and fail-on error", () => {
    const options = parseArgs(["page.html"]);
    expect(options).toEqual({
      paths: ["page.html"],
      format: "text",
      failOn: "error",
      rules: undefined,
    });
  });

  it("collects multiple positional paths", () => {
    const options = parseArgs(["a.html", "b.html"]);
    expect(options).toMatchObject({ paths: ["a.html", "b.html"] });
  });

  it("rejects zero paths", () => {
    expect(() => parseArgs([])).toThrow(A11ySweepError);
  });

  it("rejects an unknown flag", () => {
    expect(() => parseArgs(["--nope", "a.html"])).toThrow(/--nope/);
  });

  it("rejects a bad --format value", () => {
    expect(() => parseArgs(["a.html", "--format", "yaml"])).toThrow(/yaml/);
  });

  it("rejects a bad --fail-on value", () => {
    expect(() => parseArgs(["a.html", "--fail-on", "loud"])).toThrow(/loud/);
  });

  it("collects repeated --rule flags", () => {
    const options = parseArgs(["a.html", "--rule", "missing-alt", "--rule", "missing-title"]);
    expect(options).toMatchObject({ rules: ["missing-alt", "missing-title"] });
  });
});

describe("main", () => {
  it("exits 0 on a clean file", () => {
    const root = tempTree({
      "a.html": '<html lang="en"><head><title>T</title></head></html>',
    });
    const { io, out } = fakeIo();
    expect(main([`${root}/a.html`], io)).toBe(0);
    expect(out()).toContain("no findings");
  });

  it("exits 3 when an error finding exists", () => {
    const root = tempTree({ "a.html": '<img src="x.png">' });
    const { io } = fakeIo();
    expect(main([`${root}/a.html`], io)).toBe(3);
  });

  it("--fail-on never always exits 0", () => {
    const root = tempTree({ "a.html": '<img src="x.png">' });
    const { io } = fakeIo();
    expect(main([`${root}/a.html`, "--fail-on", "never"], io)).toBe(0);
  });

  it("--fail-on warning trips on a warning-only file", () => {
    const html =
      '<html lang="en"><head><title>T</title></head><body><iframe src="x"></iframe></body></html>';
    const root = tempTree({ "a.html": html });
    const { io } = fakeIo();
    expect(main([`${root}/a.html`], io)).toBe(0);
    expect(main([`${root}/a.html`, "--fail-on", "warning"], io)).toBe(3);
  });

  it("a missing file exits 1 with a message on stderr", () => {
    const { io, err, out } = fakeIo();
    expect(main(["/definitely/absent.html"], io)).toBe(1);
    expect(err()).toMatch(/error:/);
    expect(out()).toBe("");
  });

  it("an empty directory exits 1", () => {
    const root = tempTree({});
    const { io, err } = fakeIo();
    expect(main([root], io)).toBe(1);
    expect(err()).toMatch(/no \.html files/);
  });

  it("--format json emits parseable JSON", () => {
    const root = tempTree({ "a.html": '<img src="x.png">' });
    const { io, out } = fakeIo();
    main([`${root}/a.html`, "--format", "json", "--fail-on", "never"], io);
    const payload = JSON.parse(out()) as { file: string }[];
    expect(payload[0]!.file).toContain("a.html");
  });

  it("--rule restricts both output and the exit decision", () => {
    const root = tempTree({ "a.html": '<img src="x.png"><iframe src="y"></iframe>' });
    const { io } = fakeIo();
    expect(main([`${root}/a.html`, "--rule", "iframe-missing-title"], io)).toBe(0);
  });

  it("--list-rules prints every rule name", () => {
    const { io, out } = fakeIo();
    expect(main(["--list-rules"], io)).toBe(0);
    expect(out()).toContain("missing-alt");
    expect(out()).toContain("iframe-missing-title");
  });

  it("--help exits 0 with usage on stdout", () => {
    const { io, out } = fakeIo();
    expect(main(["--help"], io)).toBe(0);
    expect(out()).toContain("usage:");
  });

  it("--version prints the single-source version", () => {
    const { io, out } = fakeIo();
    expect(main(["--version"], io)).toBe(0);
    expect(out()).toContain(VERSION);
  });

  it("multiple files are all audited", () => {
    const root = tempTree({
      "a.html": '<img src="x.png">',
      "b.html": '<iframe src="y"></iframe>',
    });
    const { io, out } = fakeIo();
    main([`${root}/a.html`, `${root}/b.html`, "--format", "json", "--fail-on", "never"], io);
    const payload = JSON.parse(out()) as { file: string }[];
    expect(payload).toHaveLength(2);
  });

  it("a bad flag exits 1 and prints usage", () => {
    const { io, err } = fakeIo();
    expect(main(["--format", "yaml", "a.html"], io)).toBe(1);
    expect(err()).toMatch(/usage:/);
  });
});
