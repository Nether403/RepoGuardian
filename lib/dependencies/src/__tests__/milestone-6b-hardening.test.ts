import { describe, expect, it } from "vitest";
import type {
  DetectedLockfile,
  DetectedManifest,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import { parseGemfile } from "../gemfile.js";
import { parseGemfileLock } from "../gemfile-lock.js";
import { parseGradleBuildFile } from "../gradle-build.js";
import { parsePomXml } from "../pom-xml.js";

function createManifest(
  kind: DetectedManifest["kind"],
  path: string
): DetectedManifest {
  switch (kind) {
    case "Gemfile":
      return { ecosystem: "ruby", kind, path };
    case "build.gradle":
    case "build.gradle.kts":
    case "pom.xml":
      return { ecosystem: "jvm", kind, path };
    default:
      throw new Error(`Unsupported manifest kind: ${kind}`);
  }
}

function createLockfile(
  kind: DetectedLockfile["kind"],
  path: string
): DetectedLockfile {
  switch (kind) {
    case "Gemfile.lock":
      return { ecosystem: "ruby", kind, path };
    case "gradle.lockfile":
      return { ecosystem: "jvm", kind, path };
    default:
      throw new Error(`Unsupported lockfile kind: ${kind}`);
  }
}

function createDirectDependencyDetailsByName(
  dependencies: NormalizedDependency[]
): Map<string, NormalizedDependency[]> {
  const byName = new Map<string, NormalizedDependency[]>();

  for (const dependency of dependencies) {
    if (!dependency.isDirect) {
      continue;
    }

    const matchingDependencies = byName.get(dependency.name) ?? [];
    matchingDependencies.push(dependency);
    byName.set(dependency.name, matchingDependencies);
  }

  return byName;
}

describe("milestone 6B: Gradle DSL hardening", () => {
  it("parses string notation dependencies with trailing closure blocks", () => {
    const result = parseGradleBuildFile(
      createManifest("build.gradle", "build.gradle"),
      [
        "dependencies {",
        '  implementation("org.springframework:spring-core:6.1.15") {',
        '    exclude group: "commons-logging"',
        "  }",
        '  testImplementation("org.junit.jupiter:junit-jupiter:5.11.3") {',
        '    because "required for testing"',
        "  }",
        "}"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "org.springframework:spring-core",
          parseConfidence: "medium",
          version: "6.1.15"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "org.junit.jupiter:junit-jupiter",
          parseConfidence: "medium",
          version: "5.11.3"
        })
      ])
    );
    expect(result.warningDetails).toHaveLength(0);
  });

  it("parses named-argument declarations with trailing closure blocks", () => {
    const result = parseGradleBuildFile(
      createManifest("build.gradle.kts", "build.gradle.kts"),
      [
        "dependencies {",
        "  implementation(",
        '    group = "com.google.guava",',
        '    name = "guava",',
        '    version = "33.4.0-jre"',
        "  ) {",
        '    exclude(group = "com.google.code.findbugs")',
        "  }",
        "}"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "com.google.guava:guava",
          parseConfidence: "medium",
          version: "33.4.0-jre"
        })
      ])
    );
    expect(result.warningDetails).toHaveLength(0);
  });

  it("still correctly warns on project and version-catalog references", () => {
    const result = parseGradleBuildFile(
      createManifest("build.gradle", "build.gradle"),
      [
        "dependencies {",
        '  implementation project(":core")',
        "  implementation libs.spring.core",
        "}"
      ].join("\n")
    );

    expect(result.dependencies).toHaveLength(0);
    expect(result.warningDetails).toHaveLength(2);
    expect(result.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "FILE_PARSE_FAILED",
          message: expect.stringContaining('project(":core")')
        }),
        expect.objectContaining({
          code: "FILE_PARSE_FAILED",
          message: expect.stringContaining("libs.")
        })
      ])
    );
  });

  it("handles platform() wrapper with closure", () => {
    const result = parseGradleBuildFile(
      createManifest("build.gradle.kts", "build.gradle.kts"),
      [
        "dependencies {",
        '  implementation(platform("org.springframework.boot:spring-boot-dependencies:3.3.5")) {',
        '    because("BOM alignment")',
        "  }",
        "}"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "org.springframework.boot:spring-boot-dependencies",
          version: "3.3.5"
        })
      ])
    );
  });

  it("parses Kotlin DSL string notation without parentheses and with closure", () => {
    const result = parseGradleBuildFile(
      createManifest("build.gradle.kts", "build.gradle.kts"),
      [
        "dependencies {",
        '  implementation("io.ktor:ktor-server-core:2.3.12") {',
        "    isTransitive = false",
        "  }",
        '  runtimeOnly "org.postgresql:postgresql:42.7.4"',
        "}"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "io.ktor:ktor-server-core",
          version: "2.3.12"
        }),
        expect.objectContaining({
          name: "org.postgresql:postgresql",
          version: "42.7.4"
        })
      ])
    );
  });
});

describe("milestone 6B: Maven property/version resolution hardening", () => {
  it("resolves nested property references", () => {
    const result = parsePomXml(
      createManifest("pom.xml", "pom.xml"),
      [
        "<project>",
        "  <properties>",
        "    <spring.major>6</spring.major>",
        "    <spring.minor>1.15</spring.minor>",
        "    <spring.version>${spring.major}.${spring.minor}</spring.version>",
        "  </properties>",
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

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "org.springframework:spring-core",
          parseConfidence: "medium",
          version: "6.1.15"
        })
      ])
    );
    expect(result.warningDetails).toHaveLength(0);
  });

  it("resolves dependencyManagement-managed versions for versionless dependencies", () => {
    const result = parsePomXml(
      createManifest("pom.xml", "pom.xml"),
      [
        "<project>",
        "  <dependencyManagement>",
        "    <dependencies>",
        "      <dependency>",
        "        <groupId>org.springframework</groupId>",
        "        <artifactId>spring-core</artifactId>",
        "        <version>6.1.15</version>",
        "      </dependency>",
        "      <dependency>",
        "        <groupId>org.springframework.boot</groupId>",
        "        <artifactId>spring-boot-dependencies</artifactId>",
        "        <version>3.3.5</version>",
        "        <type>pom</type>",
        "        <scope>import</scope>",
        "      </dependency>",
        "    </dependencies>",
        "  </dependencyManagement>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>org.springframework</groupId>",
        "      <artifactId>spring-core</artifactId>",
        "    </dependency>",
        "    <dependency>",
        "      <groupId>com.example</groupId>",
        "      <artifactId>unknown-lib</artifactId>",
        "    </dependency>",
        "  </dependencies>",
        "</project>"
      ].join("\n")
    );

    const springCore = result.dependencies.find(
      (dependency) => dependency.name === "org.springframework:spring-core"
    );

    expect(springCore).toEqual(
      expect.objectContaining({
        parseConfidence: "low",
        version: "6.1.15"
      })
    );

    const unknownLib = result.dependencies.find(
      (dependency) => dependency.name === "com.example:unknown-lib"
    );

    expect(unknownLib).toEqual(
      expect.objectContaining({
        parseConfidence: "low",
        version: null
      })
    );

    expect(result.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "FILE_PARSE_FAILED",
          message: expect.stringContaining("no explicit version and no locally resolvable managed version")
        })
      ])
    );
  });

  it("uses dependencyManagement versions resolved through properties", () => {
    const result = parsePomXml(
      createManifest("pom.xml", "pom.xml"),
      [
        "<project>",
        "  <properties>",
        "    <jackson.version>2.17.3</jackson.version>",
        "  </properties>",
        "  <dependencyManagement>",
        "    <dependencies>",
        "      <dependency>",
        "        <groupId>com.fasterxml.jackson.core</groupId>",
        "        <artifactId>jackson-databind</artifactId>",
        "        <version>${jackson.version}</version>",
        "      </dependency>",
        "    </dependencies>",
        "  </dependencyManagement>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>com.fasterxml.jackson.core</groupId>",
        "      <artifactId>jackson-databind</artifactId>",
        "    </dependency>",
        "  </dependencies>",
        "</project>"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "com.fasterxml.jackson.core:jackson-databind",
          version: "2.17.3"
        })
      ])
    );
  });

  it("warns when properties cannot be resolved and leaves placeholder in version", () => {
    const result = parsePomXml(
      createManifest("pom.xml", "pom.xml"),
      [
        "<project>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>org.example</groupId>",
        "      <artifactId>lib</artifactId>",
        "      <version>${external.version}</version>",
        "    </dependency>",
        "  </dependencies>",
        "</project>"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "org.example:lib",
          parseConfidence: "low",
          version: "${external.version}"
        })
      ])
    );

    expect(result.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "FILE_PARSE_FAILED",
          message: expect.stringContaining("external.version")
        })
      ])
    );
  });

  it("handles project.version and parent.version placeholders", () => {
    const result = parsePomXml(
      createManifest("pom.xml", "pom.xml"),
      [
        "<project>",
        "  <parent>",
        "    <groupId>com.example</groupId>",
        "    <artifactId>parent</artifactId>",
        "    <version>2.0.0</version>",
        "  </parent>",
        "  <version>3.0.0</version>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>com.example</groupId>",
        "      <artifactId>core</artifactId>",
        "      <version>${project.version}</version>",
        "    </dependency>",
        "    <dependency>",
        "      <groupId>com.example</groupId>",
        "      <artifactId>shared</artifactId>",
        "      <version>${project.parent.version}</version>",
        "    </dependency>",
        "  </dependencies>",
        "</project>"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "com.example:core",
          parseConfidence: "medium",
          version: "3.0.0"
        }),
        expect.objectContaining({
          name: "com.example:shared",
          parseConfidence: "medium",
          version: "2.0.0"
        })
      ])
    );
  });
});

describe("milestone 6B: Bundler group & nesting hardening", () => {
  it("preserves group context through nested source blocks", () => {
    const result = parseGemfile(
      createManifest("Gemfile", "Gemfile"),
      [
        "group :development do",
        '  source "https://rubygems.org" do',
        '    gem "rubocop", "~> 1.72"',
        "  end",
        '  gem "debug"',
        "end",
        'gem "rails", "~> 7.1.5"'
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "development",
          name: "rubocop",
          version: "~> 1.72"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "debug",
          version: null
        }),
        expect.objectContaining({
          dependencyType: "production",
          name: "rails",
          version: "~> 7.1.5"
        })
      ])
    );
  });

  it("preserves group context through nested platforms blocks", () => {
    const result = parseGemfile(
      createManifest("Gemfile", "Gemfile"),
      [
        "group :test do",
        "  platforms :ruby do",
        '    gem "simplecov", "~> 0.22"',
        "  end",
        '  gem "rspec", "~> 3.13"',
        "end"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "development",
          name: "simplecov",
          version: "~> 0.22"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "rspec",
          version: "~> 3.13"
        })
      ])
    );
  });

  it("handles multiple version constraints", () => {
    const result = parseGemfile(
      createManifest("Gemfile", "Gemfile"),
      [
        'gem "nokogiri", ">= 1.16", "< 2.0"',
        'gem "rack", ">= 2.2.4", "< 3.0", "!= 2.2.5"',
        'gem "simple", "~> 1.0"'
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "nokogiri",
          parseConfidence: "medium",
          version: ">= 1.16, < 2.0"
        }),
        expect.objectContaining({
          name: "rack",
          parseConfidence: "medium",
          version: ">= 2.2.4, < 3.0, != 2.2.5"
        }),
        expect.objectContaining({
          name: "simple",
          parseConfidence: "medium",
          version: "~> 1.0"
        })
      ])
    );
  });

  it("flows dependency type from Gemfile groups through Gemfile.lock", () => {
    const gemfileResult = parseGemfile(
      createManifest("Gemfile", "Gemfile"),
      [
        'gem "rails", "~> 7.1.5"',
        "group :development, :test do",
        '  gem "rspec", "~> 3.13"',
        "end"
      ].join("\n")
    );

    const lockResult = parseGemfileLock(
      createLockfile("Gemfile.lock", "Gemfile.lock"),
      [
        "GEM",
        "  remote: https://rubygems.org/",
        "  specs:",
        "    activesupport (7.1.5)",
        "    rails (7.1.5)",
        "    rspec (3.13.0)",
        "",
        "DEPENDENCIES",
        "  rails (~> 7.1.5)",
        "  rspec (~> 3.13)"
      ].join("\n"),
      {
        directDependencyDetailsByName: createDirectDependencyDetailsByName(
          gemfileResult.dependencies
        ),
        directDependencyNames: new Set(),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(lockResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "rails",
          version: "7.1.5"
        }),
        expect.objectContaining({
          dependencyType: "development",
          isDirect: true,
          name: "rspec",
          version: "3.13.0"
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

  it("handles deeply nested blocks without losing group context", () => {
    const result = parseGemfile(
      createManifest("Gemfile", "Gemfile"),
      [
        "group :development do",
        '  git "https://github.com/example/custom-gem.git" do',
        '    gem "custom-gem", "~> 1.0"',
        "  end",
        '  path "../local-lib" do',
        '    gem "local-lib"',
        "  end",
        "end"
      ].join("\n")
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "development",
          name: "custom-gem",
          version: "~> 1.0"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "local-lib",
          version: null
        })
      ])
    );
  });
});

describe("milestone 6B: mixed-ecosystem regression", () => {
  it("combines hardened Gradle, Maven, and Bundler parsing in a single validation", () => {
    const gradleResult = parseGradleBuildFile(
      createManifest("build.gradle.kts", "services/api/build.gradle.kts"),
      [
        "dependencies {",
        '  implementation("org.springframework:spring-core:6.1.15") {',
        '    exclude(group = "commons-logging")',
        "  }",
        "  implementation(",
        '    group = "com.google.guava",',
        '    name = "guava",',
        '    version = "33.4.0-jre"',
        "  )",
        '  testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")',
        '  implementation project(":shared")',
        "}"
      ].join("\n")
    );

    expect(gradleResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "org.springframework:spring-core",
          version: "6.1.15"
        }),
        expect.objectContaining({
          name: "com.google.guava:guava",
          version: "33.4.0-jre"
        }),
        expect.objectContaining({
          name: "org.junit.jupiter:junit-jupiter",
          version: "5.11.3"
        })
      ])
    );
    expect(gradleResult.dependencies).toHaveLength(3);
    expect(gradleResult.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('project(":shared")')
        })
      ])
    );

    const pomResult = parsePomXml(
      createManifest("pom.xml", "services/legacy/pom.xml"),
      [
        "<project>",
        "  <properties>",
        "    <jackson.version>2.17.3</jackson.version>",
        "  </properties>",
        "  <dependencyManagement>",
        "    <dependencies>",
        "      <dependency>",
        "        <groupId>com.fasterxml.jackson.core</groupId>",
        "        <artifactId>jackson-databind</artifactId>",
        "        <version>${jackson.version}</version>",
        "      </dependency>",
        "    </dependencies>",
        "  </dependencyManagement>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>com.fasterxml.jackson.core</groupId>",
        "      <artifactId>jackson-databind</artifactId>",
        "    </dependency>",
        "    <dependency>",
        "      <groupId>org.example</groupId>",
        "      <artifactId>missing</artifactId>",
        "    </dependency>",
        "  </dependencies>",
        "</project>"
      ].join("\n")
    );

    expect(pomResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "com.fasterxml.jackson.core:jackson-databind",
          version: "2.17.3"
        }),
        expect.objectContaining({
          name: "org.example:missing",
          version: null
        })
      ])
    );

    const gemfileResult = parseGemfile(
      createManifest("Gemfile", "services/web/Gemfile"),
      [
        'gem "rails", ">= 7.0", "< 8.0"',
        "group :development do",
        '  source "https://enterprise.rubygems.org" do',
        '    gem "internal-gem", "~> 2.0"',
        "  end",
        "end"
      ].join("\n")
    );

    expect(gemfileResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "rails",
          version: ">= 7.0, < 8.0"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "internal-gem",
          version: "~> 2.0"
        })
      ])
    );
  });
});
