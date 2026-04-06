import type {
  DetectedLockfile,
  DetectedManifest,
  DetectedSignal,
  RepositoryTreeEntry
} from "@repo-guardian/shared-types";
import {
  createDetectedLockfile,
  createDetectedManifest,
  createDetectedSignal
} from "./signals.js";

export type RawDetectionFiles = {
  lockfiles: DetectedLockfile[];
  manifests: DetectedManifest[];
  signals: DetectedSignal[];
};

export function detectFiles(entries: RepositoryTreeEntry[]): RawDetectionFiles {
  const manifests: DetectedManifest[] = [];
  const lockfiles: DetectedLockfile[] = [];
  const signals: DetectedSignal[] = [];

  for (const entry of entries) {
    if (entry.kind !== "file") {
      continue;
    }

    const manifest = createDetectedManifest(entry.path);
    if (manifest) {
      manifests.push(manifest);
    }

    const lockfile = createDetectedLockfile(entry.path);
    if (lockfile) {
      lockfiles.push(lockfile);
    }

    const signal = createDetectedSignal(entry.path);
    if (signal) {
      signals.push(signal);
    }
  }

  return {
    lockfiles,
    manifests,
    signals
  };
}
