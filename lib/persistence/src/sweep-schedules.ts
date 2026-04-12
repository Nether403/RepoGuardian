import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import {
  SweepScheduleSchema,
  type SweepCadence,
  type SweepSchedule,
  type SweepSelectionStrategy
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";
import { PersistenceError } from "./errors.js";

type SweepScheduleRow = QueryResultRow & {
  cadence: SweepCadence;
  created_at: Date | string;
  is_active: boolean;
  label: string;
  last_triggered_at: Date | string | null;
  next_run_at: Date | string;
  schedule_id: string;
  selection_strategy: SweepSelectionStrategy;
  updated_at: Date | string;
};

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseSweepSchedule(row: SweepScheduleRow): SweepSchedule {
  return SweepScheduleSchema.parse({
    cadence: row.cadence,
    createdAt: toIsoString(row.created_at),
    isActive: row.is_active,
    label: row.label,
    lastTriggeredAt: toIsoString(row.last_triggered_at),
    nextRunAt: toIsoString(row.next_run_at),
    scheduleId: row.schedule_id,
    selectionStrategy: row.selection_strategy,
    updatedAt: toIsoString(row.updated_at)
  });
}

function addCadenceWindow(base: Date, cadence: SweepCadence): Date {
  const next = new Date(base);

  switch (cadence) {
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
  }
}

function assertValidScheduleId(scheduleId: string): void {
  if (!/^[a-z0-9._:-]+$/iu.test(scheduleId)) {
    throw new PersistenceError("invalid_plan_id", "Sweep schedule id is invalid.");
  }
}

export class SweepScheduleRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async createSchedule(input: {
    cadence: SweepCadence;
    label: string;
    selectionStrategy: SweepSelectionStrategy;
  }): Promise<SweepSchedule> {
    const now = new Date();
    const result = await this.client.query<SweepScheduleRow>(
      `INSERT INTO sweep_schedules (
        schedule_id,
        label,
        cadence,
        selection_strategy,
        is_active,
        last_triggered_at,
        next_run_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, TRUE, NULL, $5, $6, $6
      )
      RETURNING
        schedule_id,
        label,
        cadence,
        selection_strategy,
        is_active,
        last_triggered_at,
        next_run_at,
        created_at,
        updated_at`,
      [
        `sweep_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        input.label.trim(),
        input.cadence,
        input.selectionStrategy,
        addCadenceWindow(now, input.cadence).toISOString(),
        now.toISOString()
      ]
    );

    return parseSweepSchedule(result.rows[0]!);
  }

  async getSchedule(scheduleId: string): Promise<SweepSchedule> {
    assertValidScheduleId(scheduleId);
    const result = await this.client.query<SweepScheduleRow>(
      `SELECT
        schedule_id,
        label,
        cadence,
        selection_strategy,
        is_active,
        last_triggered_at,
        next_run_at,
        created_at,
        updated_at
      FROM sweep_schedules
      WHERE schedule_id = $1`,
      [scheduleId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Sweep schedule was not found.");
    }

    return parseSweepSchedule(result.rows[0]!);
  }

  async listSchedules(): Promise<SweepSchedule[]> {
    const result = await this.client.query<SweepScheduleRow>(
      `SELECT
        schedule_id,
        label,
        cadence,
        selection_strategy,
        is_active,
        last_triggered_at,
        next_run_at,
        created_at,
        updated_at
      FROM sweep_schedules
      ORDER BY created_at DESC`
    );

    return result.rows.map(parseSweepSchedule);
  }

  async claimDueSchedules(now = new Date()): Promise<SweepSchedule[]> {
    return this.client.transaction(async (session) => {
      const dueSchedules = await session.query<SweepScheduleRow>(
        `SELECT
          schedule_id,
          label,
          cadence,
          selection_strategy,
          is_active,
          last_triggered_at,
          next_run_at,
          created_at,
          updated_at
        FROM sweep_schedules
        WHERE is_active = TRUE AND next_run_at <= $1
        ORDER BY next_run_at ASC
        FOR UPDATE SKIP LOCKED`,
        [now.toISOString()]
      );

      const claimed: SweepSchedule[] = [];

      for (const row of dueSchedules.rows) {
        const nextRunAt = addCadenceWindow(now, row.cadence).toISOString();
        await session.query(
          `UPDATE sweep_schedules
          SET
            last_triggered_at = $2,
            next_run_at = $3,
            updated_at = $2
          WHERE schedule_id = $1`,
          [row.schedule_id, now.toISOString(), nextRunAt]
        );
        claimed.push(
          parseSweepSchedule({
            ...row,
            last_triggered_at: now.toISOString(),
            next_run_at: nextRunAt,
            updated_at: now.toISOString()
          })
        );
      }

      return claimed;
    });
  }

  async markTriggered(scheduleId: string, now = new Date()): Promise<SweepSchedule> {
    assertValidScheduleId(scheduleId);
    const existing = await this.getSchedule(scheduleId);
    const nextRunAt = addCadenceWindow(now, existing.cadence).toISOString();
    const result = await this.client.query<SweepScheduleRow>(
      `UPDATE sweep_schedules
      SET
        last_triggered_at = $2,
        next_run_at = $3,
        updated_at = $2
      WHERE schedule_id = $1
      RETURNING
        schedule_id,
        label,
        cadence,
        selection_strategy,
        is_active,
        last_triggered_at,
        next_run_at,
        created_at,
        updated_at`,
      [scheduleId, now.toISOString(), nextRunAt]
    );

    return parseSweepSchedule(result.rows[0]!);
  }
}
