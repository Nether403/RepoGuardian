ALTER TABLE policy_decision_events
  DROP CONSTRAINT IF EXISTS policy_decision_events_action_type_check;

ALTER TABLE policy_decision_events
  ADD CONSTRAINT policy_decision_events_action_type_check
  CHECK (action_type IN (
    'analyze_repository',
    'schedule_sweep',
    'generate_pr_candidates',
    'execute_batch',
    'execute_write'
  ));
