/** A 1-based line/column position, matching how editors report locations. */
export interface Position {
  readonly line: number;
  readonly column: number;
}

/** Tracks line/column as an offset advances through source text. */
export class PositionTracker {
  private readonly lineStarts: number[];

  constructor(source: string) {
    this.lineStarts = [0];
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === "\n") this.lineStarts.push(i + 1);
    }
  }

  at(offset: number): Position {
    // Binary search for the last line start <= offset.
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if ((this.lineStarts[mid] as number) <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    const lineStart = this.lineStarts[low] as number;
    return { line: low + 1, column: offset - lineStart + 1 };
  }
}
