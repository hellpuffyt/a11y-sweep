/** Public API: parse HTML, run the rules, render a report. */

export { auditFile, auditSource } from "./audit.js";
export { discover } from "./discover.js";
export { A11ySweepError } from "./errors.js";
export type { Document, ElementNode, Node, TextNode } from "./html.js";
export { findFirst, parse, textContent, walk } from "./html.js";
export type { AuditResult, Finding, Severity } from "./model.js";
export { SEVERITY_RANK, worstSeverity } from "./model.js";
export type { Position } from "./position.js";
export { renderJson, renderText } from "./report.js";
export { RULES, runRules } from "./rules.js";
export { VERSION } from "./version.js";
