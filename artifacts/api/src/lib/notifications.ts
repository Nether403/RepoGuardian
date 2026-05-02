import { EventEmitter } from "node:events";

export type ExecutionPlanNotificationType =
  | "plan.created"
  | "plan.claimed"
  | "plan.completed"
  | "plan.failed";

export type ExecutionPlanNotification = {
  createdAt: string;
  executionId: string | null;
  planId: string;
  reason: string | null;
  repositoryFullName: string;
  status: ExecutionPlanNotificationType;
  workspaceId: string;
};

const PER_WORKSPACE_LISTENER_LIMIT = 64;

class ExecutionNotificationBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(notification: ExecutionPlanNotification): void {
    this.emitter.emit(this.eventName(notification.workspaceId), notification);
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
