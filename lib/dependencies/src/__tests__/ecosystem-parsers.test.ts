import { describe, expect, it } from "vitest";
import type { DetectedLockfile, DetectedManifest } from "@repo-guardian/shared-types";
import { parseCargoLock } from "../cargo-lock.js";
import { parseCargoToml } from "../cargo-toml.js";
import { parseGemfile } from "../gemfile.js";
import { parseGemfileLock } from "../gemfile-lock.js";
import { parseGoMod } from "../go-mod.js";
import { parseGoSum } from "../go-sum.js";
import { parseGradleBuildFile } from "../gradle-build.js";
import { parseGradleLockfile } from "../gradle-lockfile.js";
import { parsePipfile } from "../pipfile.js";
import { parsePipfileLock } from "../pipfile-lock.js";
import { parsePomXml } from "../pom-xml.js";
import { parseYarnLock } from "../yarn-lock.js";

function createManifest(
  kind: DetectedManifest["kind"],
  path: string
): DetectedManifest {
  switch (kind) {
    case "Cargo.toml":
      return { ecosystem: "rust", kind, path };
    case "Gemfile":
      return { ecosystem: "ruby", kind, path };
    case "Pipfile":
      return { ecosystem: "python", kind, path };
    case "build.gradle":
    case "build.gradle.kts":
    case "pom.xml":
      return { ecosystem: "jvm", kind, path };
    case "go.mod":
      return { ecosystem: "go", kind, path };
    default:
      throw new Error(`Unsupported manifest kind in ecosystem test: ${kind}`);
  }
}

function createLockfile(
  kind: DetectedLockfile["kind"],
  path: string
): DetectedLockfile {
  switch (kind) {
    case "Cargo.lock":
      return { ecosystem: "rust", kind, path };
    case "Gemfile.lock":
      return { ecosystem: "ruby", kind, path };
    case "Pipfile.lock":
      return { ecosystem: "python", kind, path };
    case "go.sum":
      return { ecosystem: "go", kind, path };
    case "gradle.lockfile":
      return { ecosystem: "jvm", kind, path };
    case "yarn.lock":
      return { ecosystem: "node", kind, path };
    default:
      throw new Error(`Unsupported lockfile kind in ecosystem test: ${kind}`);
  }
}

describe("extended ecosystem parsers", () => {
  it("parses yarn.lock entries with direct and transitive packages", () => {
    const result = parseYarnLock(
      createLockfile("yarn.lock", "yarn.lock"),
      [
        '"react@^19.0.0":',
        '  version "19.0.0"',
        "",
        '"scheduler@^0.25.0":',
        '  version "0.25.0"'
      ].join("\n"),
      {
        directDependencyNames: new Set(["react"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.packageManager).toBe("yarn");
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "react",
          version: "19.0.0",
          workspacePath: "."
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "scheduler",
          version: "0.25.0",
          workspacePath: null
        })
      ])
    );
  });

  it("parses Pipfile and Pipfile.lock dependencies", () => {
    const pipfileResult = parsePipfile(
      createManifest("Pipfile", "Pipfile"),
      [
        "[packages]",
        'requests = "==2.32.3"',
        "",
        "[dev-packages]",
        'pytest = "==8.3.3"'
      ].join("\n")
    );
    const lockResult = parsePipfileLock(
      createLockfile("Pipfile.lock", "Pipfile.lock"),
      JSON.stringify({
        default: {
          requests: {
            version: "==2.32.3"
          },
          urllib3: {
            version: "==2.2.3"
          }
        },
        develop: {
          pytest: {
            version: "==8.3.3"
          }
        }
      }),
      {
        directDependencyNames: new Set(["requests", "pytest"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(pipfileResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "requests",
          version: "==2.32.3"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "pytest",
          version: "==8.3.3"
        })
      ])
    );
    expect(lockResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "requests",
          version: "==2.32.3"
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "urllib3",
          version: "==2.2.3"
        }),
        expect.objectContaining({
          dependencyType: "development",
          isDirect: true,
          name: "pytest",
          version: "==8.3.3"
        })
      ])
    );
  });

  it("parses go.mod and go.sum entries", () => {
    const goModResult = parseGoMod(
      createManifest("go.mod", "go.mod"),
      [
        "module example.com/repo-guardian",
        "",
        "require (",
        "\tgithub.com/gin-gonic/gin v1.10.0",
        "\tgolang.org/x/net v0.28.0 // indirect",
        ")"
      ].join("\n")
    );
    const goSumResult = parseGoSum(
      createLockfile("go.sum", "go.sum"),
      [
        "github.com/gin-gonic/gin v1.10.0 h1:abc",
        "golang.org/x/net v0.28.0 h1:def",
        "golang.org/x/net v0.28.0/go.mod h1:ghi"
      ].join("\n"),
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
    expect(goSumResult.dependencies.filter((dependency) => dependency.name === "golang.org/x/net")).toHaveLength(1);
  });

  it("parses Cargo.toml and Cargo.lock entries", () => {
    const cargoTomlResult = parseCargoToml(
      createManifest("Cargo.toml", "Cargo.toml"),
      [
        "[dependencies]",
        'serde = "1.0.215"',
        'tokio = { version = "1.41.1", optional = true }',
        "",
        "[dev-dependencies]",
        'insta = "1.41.1"'
      ].join("\n")
    );
    const cargoLockResult = parseCargoLock(
      createLockfile("Cargo.lock", "Cargo.lock"),
      [
        "[[package]]",
        'name = "serde"',
        'version = "1.0.215"',
        "",
        "[[package]]",
        'name = "itoa"',
        'version = "1.0.11"'
      ].join("\n"),
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

  it("parses pom.xml, Gradle build files, and gradle.lockfile entries", () => {
    const pomResult = parsePomXml(
      createManifest("pom.xml", "pom.xml"),
      [
        "<project>",
        "  <properties>",
        "    <spring.version>6.1.15</spring.version>",
        "  </properties>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>org.springframework</groupId>",
        "      <artifactId>spring-core</artifactId>",
        "      <version>${spring.version}</version>",
        "    </dependency>",
        "    <dependency>",
        "      <groupId>org.junit.jupiter</groupId>",
        "      <artifactId>junit-jupiter</artifactId>",
        "      <version>5.11.3</version>",
        "      <scope>test</scope>",
        "    </dependency>",
        "  </dependencies>",
        "</project>"
      ].join("\n")
    );
    const gradleBuildResult = parseGradleBuildFile(
      createManifest("build.gradle", "build.gradle"),
      [
        "dependencies {",
        '  implementation "org.springframework:spring-context:6.1.15"',
        '  testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")',
        "}"
      ].join("\n")
    );
    const gradleLockResult = parseGradleLockfile(
      createLockfile("gradle.lockfile", "gradle.lockfile"),
      [
        "# This is a Gradle generated file.",
        "org.springframework:spring-context:6.1.15=compileClasspath",
        "org.junit.jupiter:junit-jupiter:5.11.3=testCompileClasspath"
      ].join("\n"),
      {
        directDependencyNames: new Set(["org.springframework:spring-context", "org.junit.jupiter:junit-jupiter"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(pomResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "org.springframework:spring-core",
          version: "6.1.15"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "org.junit.jupiter:junit-jupiter",
          version: "5.11.3"
        })
      ])
    );
    expect(gradleBuildResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "org.springframework:spring-context",
          version: "6.1.15"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "org.junit.jupiter:junit-jupiter",
          version: "5.11.3"
        })
      ])
    );
    expect(gradleLockResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "org.springframework:spring-context",
          version: "6.1.15"
        }),
        expect.objectContaining({
          dependencyType: "development",
          isDirect: true,
          name: "org.junit.jupiter:junit-jupiter",
          version: "5.11.3"
        })
      ])
    );
  });

  it("parses Gemfile and Gemfile.lock entries", () => {
    const gemfileResult = parseGemfile(
      createManifest("Gemfile", "Gemfile"),
      [
        'gem "rails", "~> 7.1.5"',
        "group :development, :test do",
        '  gem "rspec", "~> 3.13"',
        "end"
      ].join("\n")
    );
    const gemfileLockResult = parseGemfileLock(
      createLockfile("Gemfile.lock", "Gemfile.lock"),
      [
        "GEM",
        "  remote: https://rubygems.org/",
        "  specs:",
        "    rails (7.1.5)",
        "    activesupport (7.1.5)",
        "",
        "DEPENDENCIES",
        "  rails (~> 7.1.5)"
      ].join("\n"),
      {
        directDependencyNames: new Set(),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(gemfileResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "rails",
          version: "~> 7.1.5"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "rspec",
          version: "~> 3.13"
        })
      ])
    );
    expect(gemfileLockResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "rails",
          version: "7.1.5"
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "activesupport",
          version: "7.1.5"
        })
      ])
    );
  });
});
