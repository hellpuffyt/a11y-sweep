/**
 * The command line.
 *
 * Exit codes:
 *
 * 0 — audited, nothing at or above --fail-on
 * 1 — usage or input error
 * 3 — findings at or above --fail-on
 */

import { auditFile } from "./audit.js";
import { discover } from "./discover.js";
import { A11ySweepError } from "./errors.js";
import type { AuditResult, Severity } from "./model.js";
import { SEVERITY_RANK, worstSeverity } from "./model.js";
import { renderJson, renderText } from "./report.js";
import { RULES } from "./rules.js";
import { VERSION } from "./version.js";

export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
}

const USAGE = `usage: a11y-sweep <path...> [options]

Audit static HTML for accessibility defects, with findings that name the
affected user and what happens to them - never just the failing rule.

  path...                one or more .html files or directories

options:
  --format text|json      output format (default: text)
  --fail-on SEVERITY      exit 3 at or above: error|warning|info|never
                          (default: error)
  --rule NAME             restrict to a rule (repeatable)
  --list-rules            print every rule name
  --version               print the version
  --help                  this text
`;

interface Options {
  paths: string[];
  format: "text" | "json";
  failOn: Severity | "never";
  rules: string[] | undefined;
}

export function parseArgs(argv: readonly string[]): Options | "help" | "version" | "list-rules" {
  const options: Options = { paths: [], format: "text", failOn: "error", rules: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    switch (arg) {
      case "--help":
        return "help";
      case "--version":
        return "version";
      case "--list-rules":
        return "list-rules";
      case "--format": {
        const value = argv[++i];
        if (value !== "text" && value !== "json") {
          throw new A11ySweepError(`--format expects text or json, got ${value ?? "nothing"}`);
        }
        options.format = value;
        break;
      }
      case "--fail-on": {
        const value = argv[++i];
        if (value !== "error" && value !== "warning" && value !== "info" && value !== "never") {
          throw new A11ySweepError(
            `--fail-on expects error, warning, info or never, got ${value ?? "nothing"}`,
          );
        }
        options.failOn = value;
        break;
      }
      case "--rule": {
        const value = argv[++i];
        if (value === undefined) throw new A11ySweepError("--rule expects a rule name");
        (options.rules ??= []).push(value);
        break;
      }
      default:
        if (arg.startsWith("-")) throw new A11ySweepError(`unknown option ${arg}`);
        options.paths.push(arg);
    }
  }
  if (options.paths.length === 0) {
    throw new A11ySweepError("expected at least one path");
  }
  return options;
}

export function main(argv: readonly string[], io: Io): number {
  let options: Options | "help" | "version" | "list-rules";
  try {
    options = parseArgs(argv);
  } catch (err) {
    io.stderr(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    io.stderr(USAGE);
    return 1;
  }
  if (options === "help") {
    io.stdout(USAGE);
    return 0;
  }
  if (options === "version") {
    io.stdout(`a11y-sweep ${VERSION}\n`);
    return 0;
  }
  if (options === "list-rules") {
    for (const name of Object.keys(RULES)) io.stdout(`${name}\n`);
    return 0;
  }

  try {
    const files = discover(options.paths);
    if (files.length === 0) {
      throw new A11ySweepError("no .html files found under the given paths");
    }
    const results: AuditResult[] = files.map((file) => auditFile(file, options.rules));
    io.stdout((options.format === "json" ? renderJson(results) : renderText(results)) + "\n");

    if (options.failOn === "never") return 0;
    const threshold = SEVERITY_RANK[options.failOn];
    const tripped = results.some((result) => {
      const worst = worstSeverity(result.findings);
      return worst !== undefined && SEVERITY_RANK[worst] >= threshold;
    });
    return tripped ? 3 : 0;
  } catch (err) {
    if (err instanceof A11ySweepError) {
      io.stderr(`error: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}
