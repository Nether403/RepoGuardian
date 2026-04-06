import type { EcosystemId, NormalizedDependency } from "@repo-guardian/shared-types";

const exactNodeVersionPattern =
  /^(?:v)?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/u;

const exactPythonVersionPattern = /^\d+(?:\.\d+)*(?:[A-Za-z0-9_.+-]+)?$/u;

export function getProviderEcosystem(ecosystem: EcosystemId): string | null {
  switch (ecosystem) {
    case "node":
      return "npm";
    case "python":
      return "PyPI";
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
    case "node":
      return exactNodeVersionPattern.test(version) ? version.replace(/^v/u, "") : null;
    case "python":
      if (version.startsWith("===") || version.startsWith("==")) {
        const normalized = version.replace(/^===?/u, "");
        return exactPythonVersionPattern.test(normalized) ? normalized : null;
      }

      return exactPythonVersionPattern.test(version) ? version : null;
    default:
      return null;
  }
}

export function isLockfileSource(path: string): boolean {
  return [
    "package-lock.json",
    "pnpm-lock.yaml",
    "poetry.lock"
  ].some((fileName) => path.endsWith(fileName));
}
