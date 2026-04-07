import type {
  DetectedEcosystem,
  DetectedSignal,
  PRPatchPlan
} from "@repo-guardian/shared-types";

export const ecosystemLabels: Record<DetectedEcosystem["ecosystem"], string> = {
  go: "Go",
  jvm: "Java / JVM",
  node: "Node.js",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust"
};

export const packageManagerLabels: Record<string, string> = {
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

export const signalLabels: Record<DetectedSignal["kind"], string> = {
  "docker-compose.yml": "Docker Compose",
  Dockerfile: "Dockerfile",
  "github-workflow": "GitHub workflow"
};

export const prCandidateTypeLabels: Record<PRPatchPlan["candidateType"], string> = {
  "dangerous-execution": "Dangerous execution",
  "dependency-review": "Dependency review",
  "dependency-upgrade": "Dependency upgrade",
  "general-hardening": "General hardening",
  "secret-remediation": "Secret remediation",
  "shell-execution": "Shell execution",
  "workflow-hardening": "Workflow hardening"
};
