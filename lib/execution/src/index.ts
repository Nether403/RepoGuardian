export {
  createExecutionPlanResult,
  executeApprovedActions,
  type ExecutionLifecycleCallbacks,
  type ExecutionPlanInput,
  type ExecutionServiceDependencies
} from "./service.js";
export {
  buildDiffPreview,
  buildDiffPreviewError,
  buildUnifiedDiff,
  type BuildDiffPreviewInput
} from "./diff.js";
export {
  evaluateAnalysisPolicy,
  evaluateExecutionPlanPolicy,
  evaluateExecutionWritePolicy,
  evaluateSweepSchedulePolicy,
  type EvaluateAnalysisPolicyInput,
  type EvaluateExecutionPlanPolicyInput,
  type EvaluateExecutionWritePolicyInput,
  type EvaluateSweepSchedulePolicyInput,
  type ExecutionWritePolicyDecision
} from "./policy.js";
export { explainPRWriteBackEligibility } from "./patch-synthesis.js";
