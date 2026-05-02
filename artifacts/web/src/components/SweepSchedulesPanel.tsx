import { useState, type FormEvent } from "react";
import type { SweepSchedule } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui";

type SweepSchedulesPanelProps = {
  errorMessage: string | null;
  isCreating: boolean;
  isLoading: boolean;
  pendingScheduleId: string | null;
  schedules: SweepSchedule[];
  onCreateSchedule: (input: { label: string }) => void;
  onRefresh: () => void;
  onTriggerSchedule: (scheduleId: string) => void;
};

export function SweepSchedulesPanel({
  errorMessage,
  isCreating,
  isLoading,
  pendingScheduleId,
  schedules,
  onCreateSchedule,
  onRefresh,
  onTriggerSchedule
}: SweepSchedulesPanelProps) {
  const [label, setLabel] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateSchedule({ label });
    setLabel("");
  }

  return (
    <Panel
      className="panel-half"
      eyebrow="Scheduling"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={`${schedules.length} sweep schedule${schedules.length === 1 ? "" : "s"}`}
            tone={schedules.length > 0 ? "active" : "muted"}
          />
        </div>
      }
      title="Sweep schedules"
    >
      <div className="fleet-panel-shell">
        <form className="fleet-form fleet-form-compact" onSubmit={handleSubmit}>
          <label>
            <span>Schedule label</span>
            <input
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Weekly dependency review"
              value={label}
            />
          </label>
          <div className="fleet-form-actions">
            <Button
              disabled={isCreating}
              icon={isCreating ? undefined : "refresh"}
              loading={isCreating}
              type="submit"
              variant="primary"
            >
              {isCreating ? "Creating..." : "Create weekly sweep"}
            </Button>
            <Button
              disabled={isLoading}
              icon={isLoading ? undefined : "refresh"}
              loading={isLoading}
              onClick={onRefresh}
            >
              {isLoading ? "Refreshing..." : "Refresh schedules"}
            </Button>
          </div>
        </form>
        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {schedules.length > 0 ? (
          <div className="fleet-card-list">
            {schedules.map((schedule) => (
              <article className="fleet-entity-card" key={schedule.scheduleId}>
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">{schedule.cadence}</p>
                    <h3>{schedule.label}</h3>
                  </div>
                  <StatusBadge
                    label={schedule.isActive ? "Active" : "Inactive"}
                    tone={schedule.isActive ? "active" : "muted"}
                  />
                </div>
                <p className="trace-copy">
                  Next run {formatTimestamp(schedule.nextRunAt)}.
                </p>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    last triggered{" "}
                    {schedule.lastTriggeredAt
                      ? formatTimestamp(schedule.lastTriggeredAt)
                      : "never"}
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    strategy {schedule.selectionStrategy.replace(/_/gu, " ")}
                  </span>
                </div>
                <Button
                  disabled={pendingScheduleId === schedule.scheduleId}
                  icon={
                    pendingScheduleId === schedule.scheduleId ? undefined : "play"
                  }
                  loading={pendingScheduleId === schedule.scheduleId}
                  onClick={() => onTriggerSchedule(schedule.scheduleId)}
                >
                  {pendingScheduleId === schedule.scheduleId
                    ? "Triggering..."
                    : "Trigger now"}
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            No sweep schedules created yet.
          </p>
        )}
      </div>
    </Panel>
  );
}
