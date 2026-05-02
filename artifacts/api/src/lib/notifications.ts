import { EventEmitter } from "node:events";

export type ExecutionPlanNotificationType =
  | "plan.created"
  | "plan.claimed"
  | "plan.completed"
  | "plan.failed";

export type ExecutionPlanNotificationInput = {
  createdAt: string;
  executionId: string | null;
  planId: string;
  reason: string | null;
  repositoryFullName: string;
  status: ExecutionPlanNotificationType;
  workspaceId: string;
};

export type ExecutionPlanNotification = ExecutionPlanNotificationInput & {
  id: number;
};

const PER_WORKSPACE_LISTENER_LIMIT = 64;
const PER_WORKSPACE_BUFFER_LIMIT = 200;
const BUFFER_MAX_AGE_MS = 60 * 60 * 1000;

class ExecutionNotificationBus {
  private readonly emitter = new EventEmitter();
  private readonly buffers = new Map<string, ExecutionPlanNotification[]>();
  private nextId = 1;

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(input: ExecutionPlanNotificationInput): ExecutionPlanNotification {
    const notification: ExecutionPlanNotification = {
      ...input,
      id: this.nextId++
    };

    const cutoff = Date.now() - BUFFER_MAX_AGE_MS;
    const existing = this.buffers.get(input.workspaceId) ?? [];
    const next = existing.filter((entry) => {
      const entryTimeMs = Date.parse(entry.createdAt);
      return Number.isFinite(entryTimeMs) ? entryTimeMs >= cutoff : true;
    });
    next.push(notification);
    if (next.length > PER_WORKSPACE_BUFFER_LIMIT) {
      next.splice(0, next.length - PER_WORKSPACE_BUFFER_LIMIT);
    }
    this.buffers.set(input.workspaceId, next);

    this.emitter.emit(this.eventName(input.workspaceId), notification);

    return notification;
  }

  /**
   * Returns notifications buffered for the given workspace whose monotonic id
   * is strictly greater than `sinceId`. Used by the SSE handler to replay
   * events the client missed while disconnected.
   */
  replay(workspaceId: string, sinceId: number): ExecutionPlanNotification[] {
    const buffer = this.buffers.get(workspaceId);
    if (!buffer || buffer.length === 0) {
      return [];
    }

    if (!Number.isFinite(sinceId) || sinceId < 0) {
      return [...buffer];
    }

    return buffer.filter((entry) => entry.id > sinceId);
  }

  subscribe(
    workspaceId: string,
    listener: (notification: ExecutionPlanNotification) => void
  ): () => void {
    if (!workspaceId) {
      throw new Error("Workspace id is required to subscribe to execution notifications.");
    }

    const event = this.eventName(workspaceId);
    if (this.emitter.listenerCount(event) >= PER_WORKSPACE_LISTENER_LIMIT) {
      throw new Error(
        `Execution notification subscriber limit reached for workspace ${workspaceId}.`
      );
    }

    this.emitter.on(event, listener);

    return () => {
      this.emitter.off(event, listener);
    };
  }

  listenerCount(workspaceId: string): number {
    return this.emitter.listenerCount(this.eventName(workspaceId));
  }

  bufferSize(workspaceId: string): number {
    return this.buffers.get(workspaceId)?.length ?? 0;
  }

  private eventName(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }
}

let sharedBus: ExecutionNotificationBus | null = null;

export function getExecutionNotificationBus(): ExecutionNotificationBus {
  sharedBus ??= new ExecutionNotificationBus();
  return sharedBus;
}

export function createExecutionNotificationBus(): ExecutionNotificationBus {
  return new ExecutionNotificationBus();
}

export type { ExecutionNotificationBus };
