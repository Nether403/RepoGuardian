import { describe, expect, it } from "vitest";
import type { DetectedLockfile, DetectedManifest } from "@repo-guardian/shared-types";
import { parseGemfile } from "../gemfile.js";
import { parseGemfileLock } from "../gemfile-lock.js";
import { parseGradleBuildFile } from "../gradle-build.js";
import { parseGradleLockfile } from "../gradle-lockfile.js";
import { parsePomXml } from "../pom-xml.js";

function createManifest(
  kind: Extract<DetectedManifest["kind"], "Gemfile" | "build.gradle" | "pom.xml">,
  path: string
): DetectedManifest {
  return {
    ecosystem: kind === "Gemfile" ? "ruby" : "jvm",
    kind,
    path
  };
}

function createLockfile(
  kind: Extract<DetectedLockfile["kind"], "Gemfile.lock" | "gradle.lockfile">,
  path: string
): DetectedLockfile {
  return {
    ecosystem: kind === "Gemfile.lock" ? "ruby" : "jvm",
    kind,
    path
  };
}

describe("JVM and Ruby parser expansion", () => {
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
        directDependencyNames: new Set([
          "org.springframework:spring-context",
          "org.junit.jupiter:junit-jupiter"
        ]),
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

  it("preserves unresolved Maven properties as declaration strings", () => {
    const result = parsePomXml(
      createManifest("pom.xml", "pom.xml"),
      [
        "<project>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>org.springframework</groupId>",
        "      <artifactId>spring-core</artifactId>",
        "      <version>${spring.version}</version>",
        "    </dependency>",
        "  </dependencies>",
        "</project>"
      ].join("\n")
    );

    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: "org.springframework:spring-core",
        parseConfidence: "low",
        version: "${spring.version}"
      })
    ]);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "FILE_PARSE_FAILED",
        source: "pom.xml",
        severity: "warning",
      })
    ]);
  });

  it("skips unsupported Gradle dependency declarations without package records", () => {
    const result = parseGradleBuildFile(
      createManifest("build.gradle", "build.gradle"),
      ['dependencies {', '  implementation libs.spring.boot', "}"].join("\n")
    );

    expect(result.dependencies).toEqual([]);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "FILE_PARSE_FAILED",
        source: "build.gradle",
        severity: "warning",
      })
    ]);
  });

  it("parses Gemfile and Gemfile.lock entries including declaration-only Bundler sources", () => {
    const gemfileResult = parseGemfile(
      createManifest("Gemfile", "Gemfile"),
      [
        'gem "rails", "~> 7.1.5"',
        'gem "internal-gem", git: "https://example.com/internal-gem.git"',
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
          dependencyType: "production",
          name: "internal-gem",
          parseConfidence: "low",
          version: null
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "rspec",
          version: "~> 3.13"
        })
      ])
    );
    expect(gemfileResult.warningDetails).toEqual([]);
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
