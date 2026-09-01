import { describe, expect, it } from "vitest";

import { PositionTracker } from "../src/position.js";

describe("PositionTracker", () => {
  it("reports line 1 column 1 at offset 0", () => {
    const tracker = new PositionTracker("hello\nworld");
    expect(tracker.at(0)).toEqual({ line: 1, column: 1 });
  });

  it("advances the column within the first line", () => {
    const tracker = new PositionTracker("hello\nworld");
    expect(tracker.at(3)).toEqual({ line: 1, column: 4 });
  });

  it("moves to line 2 right after a newline", () => {
    const tracker = new PositionTracker("hello\nworld");
    expect(tracker.at(6)).toEqual({ line: 2, column: 1 });
  });

  it("handles multiple newlines", () => {
    const tracker = new PositionTracker("a\nb\nc\nd");
    expect(tracker.at(6)).toEqual({ line: 4, column: 1 });
  });

  it("handles an empty string without throwing", () => {
    const tracker = new PositionTracker("");
    expect(tracker.at(0)).toEqual({ line: 1, column: 1 });
  });

  it("handles consecutive newlines (blank lines)", () => {
    const tracker = new PositionTracker("a\n\n\nb");
    expect(tracker.at(4)).toEqual({ line: 4, column: 1 });
  });
});
