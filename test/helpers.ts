import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Write a tree of files into a fresh temp dir; returns its root. */
export function tempTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "a11y-sweep-"));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  }
  return root;
}

/** Capture-everything Io for CLI tests. */
export function fakeIo(): {
  io: { stdout(t: string): void; stderr(t: string): void };
  out: () => string;
  err: () => string;
} {
  let out = "";
  let err = "";
  return {
    io: {
      stdout: (t) => {
        out += t;
      },
      stderr: (t) => {
        err += t;
      },
    },
    out: () => out,
    err: () => err,
  };
}
