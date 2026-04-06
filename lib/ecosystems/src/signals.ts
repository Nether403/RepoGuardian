import type {
  DetectedLockfile,
  DetectedManifest,
  DetectedSignal,
  EcosystemId,
  LockfileKind,
  ManifestKind,
  PackageManagerId
} from "@repo-guardian/shared-types";

type ManifestRule = {
  ecosystem: EcosystemId;
  kind: ManifestKind;
  packageManager?: PackageManagerId;
};

type LockfileRule = {
  ecosystem: EcosystemId;
  kind: LockfileKind;
  packageManager: PackageManagerId;
};

type SignalRule = {
  category: DetectedSignal["category"];
  kind: DetectedSignal["kind"];
  matches: (path: string) => boolean;
};

export const manifestRulesByBasename: Record<ManifestKind, ManifestRule> = {
  "package.json": {
    ecosystem: "node",
    kind: "package.json"
  },
  "requirements.txt": {
    ecosystem: "python",
    kind: "requirements.txt",
    packageManager: "pip"
  },
  "pyproject.toml": {
    ecosystem: "python",
    kind: "pyproject.toml"
  },
  Pipfile: {
    ecosystem: "python",
    kind: "Pipfile",
    packageManager: "pipenv"
  },
  "go.mod": {
    ecosystem: "go",
    kind: "go.mod",
    packageManager: "go-mod"
  },
  "Cargo.toml": {
    ecosystem: "rust",
    kind: "Cargo.toml",
    packageManager: "cargo"
  },
  "pom.xml": {
    ecosystem: "jvm",
    kind: "pom.xml",
    packageManager: "maven"
  },
  "build.gradle": {
    ecosystem: "jvm",
    kind: "build.gradle",
    packageManager: "gradle"
  },
  "build.gradle.kts": {
    ecosystem: "jvm",
    kind: "build.gradle.kts",
    packageManager: "gradle"
  },
  Gemfile: {
    ecosystem: "ruby",
    kind: "Gemfile",
    packageManager: "bundler"
  }
};

export const lockfileRulesByBasename: Record<LockfileKind, LockfileRule> = {
  "package-lock.json": {
    ecosystem: "node",
    kind: "package-lock.json",
    packageManager: "npm"
  },
  "pnpm-lock.yaml": {
    ecosystem: "node",
    kind: "pnpm-lock.yaml",
    packageManager: "pnpm"
  },
  "yarn.lock": {
    ecosystem: "node",
    kind: "yarn.lock",
    packageManager: "yarn"
  },
  "poetry.lock": {
    ecosystem: "python",
    kind: "poetry.lock",
    packageManager: "poetry"
  },
  "Pipfile.lock": {
    ecosystem: "python",
    kind: "Pipfile.lock",
    packageManager: "pipenv"
  },
  "go.sum": {
    ecosystem: "go",
    kind: "go.sum",
    packageManager: "go-mod"
  },
  "Cargo.lock": {
    ecosystem: "rust",
    kind: "Cargo.lock",
    packageManager: "cargo"
  },
  "gradle.lockfile": {
    ecosystem: "jvm",
    kind: "gradle.lockfile",
    packageManager: "gradle"
  },
  "Gemfile.lock": {
    ecosystem: "ruby",
    kind: "Gemfile.lock",
    packageManager: "bundler"
  }
};

export const signalRules: SignalRule[] = [
  {
    category: "infra",
    kind: "Dockerfile",
    matches: (path) => basename(path) === "Dockerfile"
  },
  {
    category: "infra",
    kind: "docker-compose.yml",
    matches: (path) => basename(path) === "docker-compose.yml"
  },
  {
    category: "workflow",
    kind: "github-workflow",
    matches: (path) =>
      path.startsWith(".github/workflows/") &&
      path.split("/").filter(Boolean).length >= 3
  }
];

export const manifestLockfilePairs: Record<
  ManifestKind,
  { ecosystem: EcosystemId; lockfiles: LockfileKind[] } | undefined
> = {
  "package.json": {
    ecosystem: "node",
    lockfiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]
  },
  "requirements.txt": undefined,
  "pyproject.toml": undefined,
  Pipfile: {
    ecosystem: "python",
    lockfiles: ["Pipfile.lock"]
  },
  "go.mod": {
    ecosystem: "go",
    lockfiles: ["go.sum"]
  },
  "Cargo.toml": {
    ecosystem: "rust",
    lockfiles: ["Cargo.lock"]
  },
  "pom.xml": undefined,
  "build.gradle": undefined,
  "build.gradle.kts": undefined,
  Gemfile: {
    ecosystem: "ruby",
    lockfiles: ["Gemfile.lock"]
  }
};

export const ecosystemDisplayNames: Record<EcosystemId, string> = {
  go: "Go",
  jvm: "Java/JVM",
  node: "Node.js",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust"
};

export const packageManagerDisplayNames: Record<PackageManagerId, string> = {
  bundler: "Bundler",
  cargo: "Cargo",
  gradle: "Gradle",
  maven: "Maven",
  npm: "npm",
  pip: "pip",
  pipenv: "Pipenv",
  pnpm: "pnpm",
  poetry: "Poetry",
  yarn: "Yarn",
  "go-mod": "Go modules"
};

function hasOwnKey<ObjectKey extends string>(
  record: Record<ObjectKey, unknown>,
  key: string
): key is ObjectKey {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function basename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

export function dirname(path: string): string {
  const segments = path.split("/");
  segments.pop();
  return segments.join("/");
}

export function createDetectedManifest(path: string): DetectedManifest | null {
  const fileBasename = basename(path);

  if (!hasOwnKey(manifestRulesByBasename, fileBasename)) {
    return null;
  }

  const rule = manifestRulesByBasename[fileBasename];

  if (!rule) {
    return null;
  }

  return {
    ecosystem: rule.ecosystem,
    kind: rule.kind,
    path
  };
}

export function createDetectedLockfile(path: string): DetectedLockfile | null {
  const fileBasename = basename(path);

  if (!hasOwnKey(lockfileRulesByBasename, fileBasename)) {
    return null;
  }

  const rule = lockfileRulesByBasename[fileBasename];

  if (!rule) {
    return null;
  }

  return {
    ecosystem: rule.ecosystem,
    kind: rule.kind,
    path
  };
}

export function createDetectedSignal(path: string): DetectedSignal | null {
  const rule = signalRules.find((candidate) => candidate.matches(path));

  if (!rule) {
    return null;
  }

  return {
    category: rule.category,
    kind: rule.kind,
    path
  };
}

export function getPackageManagerForManifest(
  manifest: DetectedManifest
): PackageManagerId | null {
  return manifestRulesByBasename[manifest.kind].packageManager ?? null;
}

export function getPackageManagerForLockfile(
  lockfile: DetectedLockfile
): PackageManagerId {
  return lockfileRulesByBasename[lockfile.kind].packageManager;
}
