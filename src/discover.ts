import * as fs from "node:fs";
import * as path from "node:path";

import { A11ySweepError } from "./errors.js";

/** Expand files and directories into a sorted list of .html file paths. */
export function discover(paths: readonly string[]): string[] {
  const found = new Set<string>();
  for (const raw of paths) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(raw);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new A11ySweepError(`cannot read ${raw}: ${detail}`);
    }
    if (stat.isDirectory()) {
      for (const file of walkDirectory(raw)) found.add(file);
    } else if (raw.toLowerCase().endsWith(".html") || raw.toLowerCase().endsWith(".htm")) {
      found.add(path.resolve(raw));
    } else {
      throw new A11ySweepError(`${raw}: not an .html file or a directory`);
    }
  }
  return [...found].sort();
}

function* walkDirectory(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDirectory(full);
    } else if (entry.name.toLowerCase().endsWith(".html") || entry.name.toLowerCase().endsWith(".htm")) {
      yield path.resolve(full);
    }
  }
}
