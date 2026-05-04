import { describe, expect, it } from "vitest";
import { scoreReachability } from "../reachability.js";

describe("scoreReachability", () => {
  it("produces an unknown band when no reviewed files are available", () => {
    const result = scoreReachability({
      finding: {
        confidence: "medium",
        isDirect: false,
        packageName: "left-pad"
      }
    });

    expect(result.band).toBe("unknown");
    expect(result.score).toBeLessThan(40);
    expect(result.referencedPaths).toEqual([]);
    expect(result.signals.map((signal) => signal.kind)).toContain(
      "no-reviewed-files"
    );
  });

  it("upgrades the score when reviewed files import the package", () => {
    const result = scoreReachability({
      fileContentsByPath: {
        "src/app.ts": "import express from 'express';\n",
        "src/util.ts": "const value = 1;\n"
      },
      finding: {
        confidence: "high",
        isDirect: true,
        packageName: "express"
      }
    });

    expect(result.band).toBe("likely");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.referencedPaths).toEqual(["src/app.ts"]);
    expect(result.signals.map((signal) => signal.kind)).toContain(
      "import-reference"
    );
  });

  it("downgrades a transitive dependency with no references", () => {
    const result = scoreReachability({
      fileContentsByPath: {
        "src/app.ts": "console.log('hello');\n"
      },
      finding: {
        confidence: "medium",
        isDirect: false,
        packageName: "obscure-helper"
      }
    });

    expect(result.band).toBe("unlikely");
    expect(result.score).toBeLessThan(40);
    expect(result.signals.map((signal) => signal.kind)).toContain(
      "no-references-found"
    );
  });

  it("matches python-style imports", () => {
    const result = scoreReachability({
      fileContentsByPath: {
        "app/main.py": "from requests import get\n"
      },
      finding: {
        confidence: "medium",
        isDirect: true,
        packageName: "requests"
      }
    });

    expect(result.referencedPaths).toEqual(["app/main.py"]);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });
});
