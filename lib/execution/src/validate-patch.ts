import type {
  DiffPreview,
  ExecutionActionPlan,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan
} from "@repo-guardian/shared-types";
import { synthesizePRCandidatePatch } from "./patch-synthesis.js";

export type ApprovedPatchValidationResult =
  | { kind: "match" }
  | { kind: "drift"; driftPaths: string[]; message: string }
  | { kind: "synthesis_error"; message: string }
  | { kind: "missing_preview"; message: string };

type ReadClient = {
  fetchRepositoryFileText(request: {
    owner: string;
    path: string;
    ref: string;
    repo: string;
  }): Promise<string>;
};

const PREPARE_PATCH_PREFIX = "execution:prepare_patch:";

export type ValidateApprovedPatchInput = {
  action: ExecutionActionPlan;
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ReadClient;
};

function getApprovedFileMap(
  preview: DiffPreview
): Map<string, { after: string; afterTruncated: boolean; unifiedDiff: string }> {
  const map = new Map<
    string,
    { after: string; afterTruncated: boolean; unifiedDiff: string }
  >();

  for (const file of preview.files) {
    map.set(file.path, {
      after: file.after,
      afterTruncated: file.afterTruncated,
      unifiedDiff: file.unifiedDiff
    });
  }

  return map;
}

export async function validateApprovedPatch(
  input: ValidateApprovedPatchInput
): Promise<ApprovedPatchValidationResult> {
  const preview = input.action.diffPreview;

  if (!preview) {
    return {
      kind: "missing_preview",
      message:
        "Approved diff preview is missing for this action; regenerate the plan before executing."
    };
  }

  if (preview.synthesisError) {
    return {
      kind: "synthesis_error",
      message: `Approved diff preview already records a synthesis error: ${preview.synthesisError}`
    };
  }

  // Truncated previews cannot be byte-compared safely — any divergence past the
  // truncation boundary would be silently accepted as a match. Force the
  // operator to regenerate the plan instead of attempting partial validation.
  const truncatedPaths = preview.files
    .filter((file) => file.afterTruncated || file.beforeTruncated)
    .map((file) => file.path);
  if (preview.truncated || truncatedPaths.length > 0) {
    const detail =
      truncatedPaths.length > 0 ? ` (${truncatedPaths.join(", ")})` : "";
    return {
      kind: "missing_preview",
      message: `Approved diff preview was truncated${detail} and cannot be safely re-validated; regenerate the plan before executing.`
    };
  }

  let synthesized: Awaited<ReturnType<typeof synthesizePRCandidatePatch>>;

  try {
    synthesized = await synthesizePRCandidatePatch({
      analysis: input.analysis,
      candidate: input.candidate,
      patchPlan: input.patchPlan,
      readClient: input.readClient
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      kind: "synthesis_error",
      message: message.length > 0 ? message : "Patch synthesis failed."
    };
  }

  const approved = getApprovedFileMap(preview);
  const driftPaths: string[] = [];

  if (synthesized.fileChanges.length !== approved.size) {
    const synthesizedPaths = new Set(
      synthesized.fileChanges.map((change) => change.path)
    );
    for (const change of synthesized.fileChanges) {
      if (!approved.has(change.path)) {
        driftPaths.push(change.path);
      }
    }
    for (const path of approved.keys()) {
      if (!synthesizedPaths.has(path)) {
        driftPaths.push(path);
      }
    }
  }

  for (const change of synthesized.fileChanges) {
    const previewFile = approved.get(change.path);
    if (!previewFile) {
      if (!driftPaths.includes(change.path)) {
        driftPaths.push(change.path);
      }
      continue;
    }

    // Truncated previews are filtered out above as missing_preview; here we
    // can do a strict byte-for-byte comparison.
    if (change.content !== previewFile.after) {
      if (!driftPaths.includes(change.path)) {
        driftPaths.push(change.path);
      }
    }
  }

  if (driftPaths.length > 0) {
    driftPaths.sort((left, right) => left.localeCompare(right));
    return {
      kind: "drift",
      driftPaths,
      message: `Repo Guardian detected drift in ${driftPaths.length} file${
        driftPaths.length === 1 ? "" : "s"
      } since the approved diff preview was generated. Regenerate the plan and re-approve before executing.`
    };
  }

  return { kind: "match" };
}

export function getPreparePatchCandidateId(action: ExecutionActionPlan): string | null {
  if (action.actionType !== "prepare_patch") {
    return null;
  }

  if (!action.id.startsWith(PREPARE_PATCH_PREFIX)) {
    return null;
  }

  return action.id.slice(PREPARE_PATCH_PREFIX.length);
}

export type ValidateApprovedPlanInput = {
  actions: ExecutionActionPlan[];
  analysis: ExecutionPlanningContext;
  readClient: ReadClient;
  selectedPRCandidateIds: string[];
};

export type ApprovedPlanValidationResult =
  | { kind: "match" }
  | {
      kind: "drift";
      details: Array<{
        candidateId: string;
        driftPaths: string[];
      }>;
      message: string;
    }
  | {
      kind: "synthesis_error";
      details: Array<{
        candidateId: string;
        message: string;
      }>;
      message: string;
    }
  | {
      kind: "missing_preview";
      details: Array<{ candidateId: string; message: string }>;
      message: string;
    };

export async function validateApprovedPlan(
  input: ValidateApprovedPlanInput
): Promise<ApprovedPlanValidationResult> {
  const candidateMap = new Map(
    input.analysis.prCandidates.map((candidate) => [candidate.id, candidate])
  );
  const patchPlanMap = new Map(
    input.analysis.prPatchPlans.map((plan) => [plan.prCandidateId, plan])
  );
  const selected = new Set(input.selectedPRCandidateIds);
  const driftDetails: Array<{ candidateId: string; driftPaths: string[] }> = [];
  const synthesisErrors: Array<{ candidateId: string; message: string }> = [];
  const missingPreview: Array<{ candidateId: string; message: string }> = [];

  for (const action of input.actions) {
    const candidateId = getPreparePatchCandidateId(action);
    if (!candidateId || !selected.has(candidateId)) {
      continue;
    }

    if (action.eligibility !== "eligible") {
      continue;
    }

    const candidate = candidateMap.get(candidateId);
    const patchPlan = patchPlanMap.get(candidateId);

    if (!candidate || !patchPlan) {
      continue;
    }

    const result = await validateApprovedPatch({
      action,
      analysis: input.analysis,
      candidate,
      patchPlan,
      readClient: input.readClient
    });

    if (result.kind === "drift") {
      driftDetails.push({
        candidateId,
        driftPaths: result.driftPaths
      });
    } else if (result.kind === "synthesis_error") {
      synthesisErrors.push({
        candidateId,
        message: result.message
      });
    } else if (result.kind === "missing_preview") {
      missingPreview.push({
        candidateId,
        message: result.message
      });
    }
  }

  if (synthesisErrors.length > 0) {
    return {
      kind: "synthesis_error",
      details: synthesisErrors,
      message: `Patch synthesis failed during pre-execution validation for ${synthesisErrors.length} candidate${
        synthesisErrors.length === 1 ? "" : "s"
      }.`
    };
  }

  if (missingPreview.length > 0) {
    return {
      kind: "missing_preview",
      details: missingPreview,
      message: `Approved diff preview is missing for ${missingPreview.length} candidate${
        missingPreview.length === 1 ? "" : "s"
      }; regenerate the plan before executing.`
    };
  }

  if (driftDetails.length > 0) {
    const totalPaths = driftDetails.reduce(
      (count, detail) => count + detail.driftPaths.length,
      0
    );
    return {
      kind: "drift",
      details: driftDetails,
      message: `Repo Guardian detected drift in ${totalPaths} file${
        totalPaths === 1 ? "" : "s"
      } across ${driftDetails.length} candidate${
        driftDetails.length === 1 ? "" : "s"
      } since the plan was approved. Regenerate the plan and re-approve before executing.`
    };
  }

  return { kind: "match" };
}
