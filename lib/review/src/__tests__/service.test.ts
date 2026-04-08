import { describe, expect, it } from "vitest";
import { createCodeReviewResult } from "../service.js";

describe("createCodeReviewResult", () => {
  it("produces structured findings with line spans for representative deterministic rules", () => {
    const result = createCodeReviewResult({
      reviewedFiles: [
        {
          content: 'const token = "ghp_1234567890abcdefghijklmno";\nconst output = eval(userInput);',
          path: "src/server.ts",
          priority: 180,
          selectionReason: "api-entrypoint",
          sourceType: "code"
        },
        {
          content: ["name: ci", "on: pull_request_target", "jobs:", "  test:", "    runs-on: ubuntu-latest"].join("\n"),
          path: ".github/workflows/ci.yml",
          priority: 300,
          selectionReason: "workflow",
          sourceType: "workflow"
        }
      ],
      selection: {
        candidateCount: 2,
        isCapped: false,
        targets: [
          {
            path: "src/server.ts",
            priority: 180,
            selectionReason: "api-entrypoint",
            sourceType: "code"
          },
          {
            path: ".github/workflows/ci.yml",
            priority: 300,
            selectionReason: "workflow",
            sourceType: "workflow"
          }
        ],
        totalFileCount: 10
      }
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "hardcoded-secret",
          lineSpans: [{ endLine: 1, path: "src/server.ts", startLine: 1 }],
          sourceType: "code"
        }),
        expect.objectContaining({
          category: "dangerous-dynamic-execution",
          lineSpans: [{ endLine: 2, path: "src/server.ts", startLine: 2 }]
        }),
        expect.objectContaining({
          category: "workflow-trigger-risk",
          sourceType: "workflow"
        }),
        expect.objectContaining({
          category: "workflow-hardening",
          lineSpans: []
        })
      ])
    );
    expect(result.coverage).toMatchObject({
      candidateFileCount: 2,
      reviewedFileCount: 2,
      selectedFileCount: 2,
      skippedFileCount: 0,
      isPartial: true
    });
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "REVIEW_SCOPE_LIMITED"
      })
    ]);
  });

  it("emits skipped-file warnings when selected review files cannot be reviewed", () => {
    const result = createCodeReviewResult({
      reviewedFiles: [],
      selection: {
        candidateCount: 1,
        isCapped: false,
        targets: [
          {
            path: "src/server.ts",
            priority: 180,
            selectionReason: "api-entrypoint",
            sourceType: "code"
          }
        ],
        totalFileCount: 5
      },
      skippedFiles: [
        {
          path: "src/server.ts",
          priority: 180,
          selectionReason: "api-entrypoint",
          sourceType: "code",
          reason: "Skipped src/server.ts during review: file content exceeded the review size limit."
        }
      ]
    });

    expect(result.findings).toEqual([]);
    expect(result.coverage.skippedPaths).toEqual(["src/server.ts"]);
    expect(result.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REVIEW_FILE_SKIPPED",
          paths: ["src/server.ts"]
        })
      ])
    );
  });

  it("flags explicit contents: write permissions inside workflow permission blocks", () => {
    const result = createCodeReviewResult({
      reviewedFiles: [
        {
          content: [
            "name: ci",
            "on:",
            "  push:",
            "permissions:",
            "  contents: write",
            "jobs:",
            "  test:",
            "    runs-on: ubuntu-latest"
          ].join("\n"),
          path: ".github/workflows/ci.yml",
          priority: 300,
          selectionReason: "workflow",
          sourceType: "workflow"
        }
      ],
      selection: {
        candidateCount: 1,
        isCapped: false,
        targets: [
          {
            path: ".github/workflows/ci.yml",
            priority: 300,
            selectionReason: "workflow",
            sourceType: "workflow"
          }
        ],
        totalFileCount: 3
      }
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "workflow-permissions",
          lineSpans: [{ endLine: 5, path: ".github/workflows/ci.yml", startLine: 5 }],
          sourceType: "workflow",
          title: "Broad GitHub Actions permissions detected"
        })
      ])
    );
    expect(result.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "workflow-hardening"
        })
      ])
    );
  });

  it("flags inline permissions maps that grant contents: write", () => {
    const result = createCodeReviewResult({
      reviewedFiles: [
        {
          content: [
            "name: ci",
            "on:",
            "  push:",
            "permissions: { contents: write }",
            "jobs:",
            "  test:",
            "    runs-on: ubuntu-latest"
          ].join("\n"),
          path: ".github/workflows/ci.yml",
          priority: 300,
          selectionReason: "workflow",
          sourceType: "workflow"
        }
      ],
      selection: {
        candidateCount: 1,
        isCapped: false,
        targets: [
          {
            path: ".github/workflows/ci.yml",
            priority: 300,
            selectionReason: "workflow",
            sourceType: "workflow"
          }
        ],
        totalFileCount: 3
      }
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "workflow-permissions",
          lineSpans: [{ endLine: 4, path: ".github/workflows/ci.yml", startLine: 4 }],
          sourceType: "workflow",
          title: "Broad GitHub Actions permissions detected"
        })
      ])
    );
  });
});
