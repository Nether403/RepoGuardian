export {
  createExecutionPlanResult,
  executeApprovedActions,
  type ExecutionLifecycleCallbacks,
  type ExecutionPlanInput,
  type ExecutionServiceDependencies
} from "./service.js";
export {
  evaluateExecutionWritePolicy,
  type EvaluateExecutionWritePolicyInput,
  type ExecutionWritePolicyDecision
} from "./policy.js";
export { explainPRWriteBackEligibility } from "./patch-synthesis.js";
