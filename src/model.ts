import type { Position } from "./position.js";

export type Severity = "error" | "warning" | "info";

export const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, error: 2 };

/**
 * One accessibility defect. `affected` names *who* runs into it and *what
 * happens to them* — never a restatement of the rule ("missing alt
 * attribute" is the rule; "a screen reader announces this image only as
 * 'image', with no description of what it shows" is the consequence).
 */
export interface Finding {
  readonly rule: string;
  readonly severity: Severity;
  readonly tag: string;
  readonly position: Position;
  readonly message: string;
  readonly affected: string;
}

export interface AuditResult {
  readonly file: string;
  readonly findings: Finding[];
}

export function worstSeverity(findings: readonly Finding[]): Severity | undefined {
  if (findings.length === 0) return undefined;
  return findings.reduce<Severity>(
    (worst, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst] ? f.severity : worst),
    "info",
  );
}
