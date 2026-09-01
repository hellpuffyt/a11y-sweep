import * as fs from "node:fs";

import { A11ySweepError } from "./errors.js";
import { parse } from "./html.js";
import type { AuditResult } from "./model.js";
import { runRules } from "./rules.js";

export function auditFile(file: string, only?: readonly string[]): AuditResult {
  let source: string;
  try {
    source = fs.readFileSync(file, "utf-8");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new A11ySweepError(`cannot read ${file}: ${detail}`);
  }
  return auditSource(file, source, only);
}

export function auditSource(
  file: string,
  source: string,
  only?: readonly string[],
): AuditResult {
  const doc = parse(source);
  return { file, findings: runRules(doc, only) };
}
