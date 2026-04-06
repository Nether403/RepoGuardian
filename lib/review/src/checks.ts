import type {
  CodeReviewFinding,
  FindingConfidence,
  FindingEvidence,
  FindingLineSpan,
  FindingSeverity
} from "@repo-guardian/shared-types";
import type { ReviewTarget } from "./select-files.js";

export type ReviewFile = ReviewTarget & {
  content: string;
};

function createLineSpan(path: string, line: number): FindingLineSpan {
  return {
    endLine: line,
    path,
    startLine: line
  };
}

function sanitizeEvidence(line: string): string {
  return line
    .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/gu, "[REDACTED_TOKEN]")
    .replace(/AKIA[0-9A-Z]{16}/gu, "[REDACTED_AWS_KEY]")
    .replace(/(['"])([^'"]{8,})\1/gu, (_match, quote) => `${quote}[REDACTED]${quote}`)
    .trim();
}

function createFinding(input: {
  category: string;
  confidence: FindingConfidence;
  evidence: FindingEvidence[];
  lineSpans: FindingLineSpan[];
  path: string;
  recommendedAction: string;
  severity: FindingSeverity;
  sourceType: CodeReviewFinding["sourceType"];
  summary: string;
  title: string;
}): CodeReviewFinding {
  const lineKey =
    input.lineSpans.length > 0
      ? input.lineSpans.map((span) => `${span.startLine}-${span.endLine}`).join(",")
      : "file";

  return {
    candidateIssue: false,
    candidatePr: false,
    category: input.category,
    confidence: input.confidence,
    evidence: input.evidence,
    id: `review:${input.category}:${input.path}:${lineKey}`,
    lineSpans: input.lineSpans,
    paths: [input.path],
    recommendedAction: input.recommendedAction,
    severity: input.severity,
    sourceType: input.sourceType,
    summary: input.summary,
    title: input.title
  };
}

function usesJavaScriptReviewRules(path: string): boolean {
  return /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/u.test(path);
}

function usesPythonReviewRules(path: string): boolean {
  return path.endsWith(".py");
}

function isLikelyPlaceholder(line: string): boolean {
  const lowered = line.toLowerCase();
  return (
    lowered.includes("example") ||
    lowered.includes("dummy") ||
    lowered.includes("changeme") ||
    lowered.includes("placeholder") ||
    lowered.includes("test") ||
    lowered.includes("process.env") ||
    lowered.includes("import.meta.env") ||
    lowered.includes("os.environ") ||
    lowered.includes("system.getenv") ||
    lowered.includes("${{ secrets.") ||
    lowered.includes("${ secrets.") ||
    lowered.includes("secrets.")
  );
}

function findHardcodedSecrets(file: ReviewFile): CodeReviewFinding[] {
  const findings: CodeReviewFinding[] = [];
  const lines = file.content.split(/\r?\n/u);
  const specificSecretPattern = /\b(gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/gu;
  const genericSecretPattern =
    /\b(api[_-]?key|client[_-]?secret|secret|token|password|passwd|private[_-]?key)\b[^:=\n]{0,40}[:=]\s*(['"]?)[A-Za-z0-9_./+=-]{8,}\2/iu;

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();

    if (!line || isLikelyPlaceholder(line)) {
      continue;
    }

    const hasSpecificSecret = specificSecretPattern.test(line);
    specificSecretPattern.lastIndex = 0;
    const hasGenericSecret = genericSecretPattern.test(line);

    if (!hasSpecificSecret && !hasGenericSecret) {
      continue;
    }

    findings.push(
      createFinding({
        category: "hardcoded-secret",
        confidence: hasSpecificSecret ? "high" : "medium",
        evidence: [
          {
            label: "Matched line",
            value: sanitizeEvidence(line)
          }
        ],
        lineSpans: [createLineSpan(file.path, index + 1)],
        path: file.path,
        recommendedAction:
          "Move the secret-like value into a secret manager or environment variable and rotate it if it is real.",
        severity: hasSpecificSecret ? "high" : "medium",
        sourceType: file.sourceType,
        summary:
          "A secret-like literal was found directly in repository content instead of a secret reference.",
        title: "Possible hardcoded secret detected"
      })
    );
  }

  return findings;
}

function findDangerousDynamicExecution(file: ReviewFile): CodeReviewFinding[] {
  if (!usesJavaScriptReviewRules(file.path)) {
    return [];
  }

  const findings: CodeReviewFinding[] = [];
  const lines = file.content.split(/\r?\n/u);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();

    if (/\beval\s*\(/u.test(line)) {
      findings.push(
        createFinding({
          category: "dangerous-dynamic-execution",
          confidence: "high",
          evidence: [
            {
              label: "Matched line",
              value: line
            }
          ],
          lineSpans: [createLineSpan(file.path, index + 1)],
          path: file.path,
          recommendedAction:
            "Remove dynamic evaluation or replace it with a safer explicit parser or dispatch mechanism.",
          severity: "high",
          sourceType: "code",
          summary: "Dynamic evaluation can execute untrusted input and is difficult to audit safely.",
          title: "Dynamic eval usage detected"
        })
      );
    }

    if (/new\s+Function\s*\(/u.test(line)) {
      findings.push(
        createFinding({
          category: "dangerous-dynamic-execution",
          confidence: "high",
          evidence: [
            {
              label: "Matched line",
              value: line
            }
          ],
          lineSpans: [createLineSpan(file.path, index + 1)],
          path: file.path,
          recommendedAction:
            "Avoid constructing executable code from strings; use explicit functions or validated templates instead.",
          severity: "high",
          sourceType: "code",
          summary: "String-built functions create dynamic execution paths that are hard to validate safely.",
          title: "String-built Function constructor detected"
        })
      );
    }
  }

  return findings;
}

function findUnsafeShellExecution(file: ReviewFile): CodeReviewFinding[] {
  const findings: CodeReviewFinding[] = [];
  const lines = file.content.split(/\r?\n/u);

  if (usesJavaScriptReviewRules(file.path)) {
    for (const [index, rawLine] of lines.entries()) {
      const line = rawLine.trim();
      const context = lines.slice(index, index + 3).join(" ");

      if (/\bexec(Sync)?\s*\(/u.test(line)) {
        findings.push(
          createFinding({
            category: "unsafe-shell-execution",
            confidence: "high",
            evidence: [{ label: "Matched line", value: line }],
            lineSpans: [createLineSpan(file.path, index + 1)],
            path: file.path,
            recommendedAction:
              "Avoid raw shell execution for untrusted input; prefer explicit argument arrays and strict input validation.",
            severity: "high",
            sourceType: "code",
            summary: "Raw shell execution increases command injection risk when any part of the command is influenced by input.",
            title: "Shell execution helper detected"
          })
        );
      }

      if (/\bspawn(Sync)?\s*\(/u.test(line) && /shell\s*:\s*true/u.test(context)) {
        findings.push(
          createFinding({
            category: "unsafe-shell-execution",
            confidence: "high",
            evidence: [{ label: "Matched context", value: context.trim() }],
            lineSpans: [createLineSpan(file.path, index + 1)],
            path: file.path,
            recommendedAction:
              "Prefer spawning a command without a shell and pass arguments explicitly to reduce injection risk.",
            severity: "high",
            sourceType: "code",
            summary: "Shell-enabled process spawning can expand untrusted input through a shell interpreter.",
            title: "Shell-enabled process spawn detected"
          })
        );
      }
    }
  }

  if (usesPythonReviewRules(file.path)) {
    for (const [index, rawLine] of lines.entries()) {
      const line = rawLine.trim();
      const context = lines.slice(index, index + 3).join(" ");

      if (
        /subprocess\.(run|Popen|call|check_call|check_output)\s*\(/u.test(line) &&
        /shell\s*=\s*True/u.test(context)
      ) {
        findings.push(
          createFinding({
            category: "unsafe-shell-execution",
            confidence: "high",
            evidence: [{ label: "Matched context", value: context.trim() }],
            lineSpans: [createLineSpan(file.path, index + 1)],
            path: file.path,
            recommendedAction:
              "Remove shell=True where possible and pass command arguments as a validated list instead.",
            severity: "high",
            sourceType: "code",
            summary: "Python subprocess calls with shell=True can expose command injection risk.",
            title: "subprocess shell=True detected"
          })
        );
      }
    }
  }

  return findings;
}

function findWorkflowFindings(file: ReviewFile): CodeReviewFinding[] {
  if (file.sourceType !== "workflow") {
    return [];
  }

  const findings: CodeReviewFinding[] = [];
  const lines = file.content.split(/\r?\n/u);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();

    if (/^permissions\s*:\s*write-all\b/ui.test(line)) {
      findings.push(
        createFinding({
          category: "workflow-permissions",
          confidence: "high",
          evidence: [{ label: "Matched line", value: line }],
          lineSpans: [createLineSpan(file.path, index + 1)],
          path: file.path,
          recommendedAction:
            "Replace write-all with the smallest explicit permission set required by the workflow jobs.",
          severity: "high",
          sourceType: "workflow",
          summary: "Broad write-all workflow permissions increase the blast radius of a compromised workflow token.",
          title: "Broad GitHub Actions permissions detected"
        })
      );
    }

    if (/\bpull_request_target\b/ui.test(line)) {
      findings.push(
        createFinding({
          category: "workflow-trigger-risk",
          confidence: "high",
          evidence: [{ label: "Matched line", value: line }],
          lineSpans: [createLineSpan(file.path, index + 1)],
          path: file.path,
          recommendedAction:
            "Review whether pull_request_target is necessary and gate privileged steps carefully for untrusted contributions.",
          severity: "high",
          sourceType: "workflow",
          summary: "pull_request_target runs with repository context and can be risky when combined with untrusted pull requests.",
          title: "Risky workflow trigger detected"
        })
      );
    }
  }

  if (!/^\s*permissions\s*:/mu.test(file.content)) {
    findings.push(
      createFinding({
        category: "workflow-hardening",
        confidence: "medium",
        evidence: [
          {
            label: "Workflow file",
            value: file.path
          }
        ],
        lineSpans: [],
        path: file.path,
        recommendedAction:
          "Declare explicit top-level or job-level permissions so the workflow token uses the minimum access needed.",
        severity: "low",
        sourceType: "workflow",
        summary: "The workflow does not declare explicit permissions, which makes hardening harder to verify quickly.",
        title: "Workflow does not declare explicit permissions"
      })
    );
  }

  return findings;
}

export function runDeterministicReviewChecks(file: ReviewFile): CodeReviewFinding[] {
  const findings = [
    ...findHardcodedSecrets(file),
    ...findDangerousDynamicExecution(file),
    ...findUnsafeShellExecution(file),
    ...findWorkflowFindings(file)
  ];

  return [...new Map(findings.map((finding) => [finding.id, finding])).values()];
}
