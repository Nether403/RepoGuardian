import type { EcosystemId, NormalizedDependency } from "@repo-guardian/shared-types";

const exactNodeVersionPattern =
  /^(?:v)?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/u;

const exactPythonVersionPattern = /^\d+(?:\.\d+)*(?:[A-Za-z0-9_.+-]+)?$/u;
const exactGoVersionPattern =
  /^(?:v)?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/u;
const exactJvmVersionPattern =
  /^(?!\$\{)(?!.*(?:\[|\]|,|\(|\)|\s))[A-Za-z0-9_.+-]+$/u;
const exactRubyVersionPattern = /^(?![<>=~!])(?:v)?[A-Za-z0-9_.+-]+$/u;
const exactRustVersionPattern =
  /^(?:v)?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/u;

export function getProviderEcosystem(ecosystem: EcosystemId): string | null {
  switch (ecosystem) {
    case "go":
      return "Go";
    case "jvm":
      return "Maven";
    case "node":
      return "npm";
    case "python":
      return "PyPI";
    case "ruby":
      return "RubyGems";
    case "rust":
      return "crates.io";
    default:
      return null;
  }
}

export function extractConcreteVersion(
  dependency: Pick<NormalizedDependency, "ecosystem" | "version">
): string | null {
  if (!dependency.version) {
    return null;
  }

  const version = dependency.version.trim();

  if (!version) {
    return null;
  }

  switch (dependency.ecosystem) {
    case "go":
      return exactGoVersionPattern.test(version) ? version : null;
    case "jvm":
      return exactJvmVersionPattern.test(version) ? version : null;
    case "node":
      return exactNodeVersionPattern.test(version) ? version.replace(/^v/u, "") : null;
    case "python":
      if (version.startsWith("===") || version.startsWith("==")) {
        const normalized = version.replace(/^===?/u, "");
        return exactPythonVersionPattern.test(normalized) ? normalized : null;
      }

      return exactPythonVersionPattern.test(version) ? version : null;
    case "ruby":
      return exactRubyVersionPattern.test(version) ? version : null;
    case "rust":
      return exactRustVersionPattern.test(version) ? version : null;
    default:
      return null;
  }
}

export function isLockfileSource(path: string): boolean {
  return [
    "Cargo.lock",
    "Gemfile.lock",
    "Pipfile.lock",
    "go.sum",
    "gradle.lockfile",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock"
  ].some((fileName) => path.endsWith(fileName));
}
