import { describe, expect, it } from "vitest";
import type { DetectedLockfile, DetectedManifest } from "@repo-guardian/shared-types";
import { parseCargoLock } from "../cargo-lock.js";
import { parseCargoToml } from "../cargo-toml.js";
import { parseGoMod } from "../go-mod.js";
import { parseGoSum } from "../go-sum.js";

function createManifest(
  kind: Extract<DetectedManifest["kind"], "Cargo.toml" | "go.mod">,
  path: string
): DetectedManifest {
  return {
    ecosystem: kind === "go.mod" ? "go" : "rust",
    kind,
    path
  };
}

function createLockfile(
  kind: Extract<DetectedLockfile["kind"], "Cargo.lock" | "go.sum">,
  path: string
): DetectedLockfile {
  return {
    ecosystem: kind === "go.sum" ? "go" : "rust",
    kind,
    path
  };
}

describe("Go and Rust parser expansion", () => {
  it("parses go.mod and go.sum entries", () => {
    const goModResult = parseGoMod(
      createManifest("go.mod", "go.mod"),
      ["module example.com/repo-guardian", "", "require (", "\tgithub.com/gin-gonic/gin v1.10.0", "\tgolang.org/x/net v0.28.0 // indirect", ")"].join("\n")
    );
    const goSumResult = parseGoSum(
      createLockfile("go.sum", "go.sum"),
      ["github.com/gin-gonic/gin v1.10.0 h1:abc", "golang.org/x/net v0.28.0 h1:def", "golang.org/x/net v0.28.0/go.mod h1:ghi"].join("\n"),
      {
        directDependencyNames: new Set(["github.com/gin-gonic/gin"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(goModResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "github.com/gin-gonic/gin",
          version: "v1.10.0"
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "golang.org/x/net",
          version: "v0.28.0"
        })
      ])
    );
    expect(goSumResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "github.com/gin-gonic/gin",
          version: "v1.10.0"
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "golang.org/x/net",
          version: "v0.28.0"
        })
      ])
    );
    expect(
      goSumResult.dependencies.filter((dependency) => dependency.name === "golang.org/x/net")
    ).toHaveLength(1);
  });

  it("warns on malformed go.sum entries", () => {
    const result = parseGoSum(
      createLockfile("go.sum", "go.sum"),
      "github.com/gin-gonic/gin",
      {
        directDependencyNames: new Set(),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.dependencies).toEqual([]);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "FILE_PARSE_FAILED",
        message: "Skipped malformed go.sum entry on line 1 in go.sum."
      })
    ]);
  });

  it("parses Cargo.toml and Cargo.lock entries", () => {
    const cargoTomlResult = parseCargoToml(
      createManifest("Cargo.toml", "Cargo.toml"),
      ["[dependencies]", 'serde = "1.0.215"', 'tokio = { version = "1.41.1", optional = true }', "", "[dev-dependencies]", 'insta = "1.41.1"'].join("\n")
    );
    const cargoLockResult = parseCargoLock(
      createLockfile("Cargo.lock", "Cargo.lock"),
      ["[[package]]", 'name = "serde"', 'version = "1.0.215"', "", "[[package]]", 'name = "itoa"', 'version = "1.0.11"'].join("\n"),
      {
        directDependencyNames: new Set(["serde"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(cargoTomlResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "serde"
        }),
        expect.objectContaining({
          dependencyType: "optional",
          name: "tokio"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "insta"
        })
      ])
    );
    expect(cargoLockResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "serde",
          version: "1.0.215"
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "itoa",
          version: "1.0.11"
        })
      ])
    );
  });

  it("keeps declaration-only Cargo dependencies as warnings instead of fabricating versions", () => {
    const result = parseCargoToml(
      createManifest("Cargo.toml", "Cargo.toml"),
      ["[dependencies]", 'local-crate = { path = "../local-crate" }'].join("\n")
    );

    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: "local-crate",
        parseConfidence: "low",
        version: null
      })
    ]);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "FILE_PARSE_FAILED",
        message:
          'Skipped declaration-only Cargo dependency "local-crate" in Cargo.toml; no version was available for advisory lookup.'
      })
    ]);
  });
});
