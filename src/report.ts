import type { AuditResult, Finding } from "./model.js";

const MARK: Record<Finding["severity"], string> = {
  error: "ERROR  ",
  warning: "warning",
  info: "info   ",
};

export function renderText(results: readonly AuditResult[]): string {
  const lines: string[] = [];
  for (const result of results) {
    lines.push(result.file);
    if (result.findings.length === 0) {
      lines.push("  no findings");
    } else {
      for (const finding of result.findings) {
        lines.push(
          `  ${MARK[finding.severity]} [${finding.rule}] ` +
            `${finding.position.line}:${finding.position.column} <${finding.tag}> ` +
            finding.message,
        );
        lines.push(`            ${finding.affected}`);
      }
    }
    lines.push("");
  }
  lines.pop();
  return lines.join("\n");
}

export function renderJson(results: readonly AuditResult[]): string {
  return JSON.stringify(
    results.map((result) => ({
      file: result.file,
      findings: result.findings.map((f) => ({
        rule: f.rule,
        severity: f.severity,
        tag: f.tag,
        line: f.position.line,
        column: f.position.column,
        message: f.message,
        affected: f.affected,
      })),
    })),
    null,
    2,
  );
}
