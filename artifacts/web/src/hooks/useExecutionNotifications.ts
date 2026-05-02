import { useEffect, useRef, useState } from "react";
import {
  buildNotificationStreamUrl,
  type ExecutionPlanNotification,
  type ExecutionPlanNotificationType
} from "../lib/notifications-client";

const NOTIFICATION_TYPES: ReadonlyArray<ExecutionPlanNotificationType> = [
  "plan.created",
  "plan.claimed",
  "plan.completed",
  "plan.failed"
];
const MAX_BUFFER = 20;
const BACKOFF_FLOOR_MS = 1_500;
const BACKOFF_CEILING_MS = 30_000;

export type UseExecutionNotificationsOptions = {
  enabled?: boolean;
  workspaceId: string | null;
  eventSourceFactory?: (url: string) => EventSourceLike;
};

export type EventSourceLike = {
  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void;
  close(): void;
};

export type UseExecutionNotificationsResult = {
  connectionState: "idle" | "connecting" | "open" | "closed" | "error";
  notifications: ExecutionPlanNotification[];
  clear(): void;
  dismiss(planId: string, status: ExecutionPlanNotificationType): void;
};

function defaultEventSourceFactory(url: string): EventSourceLike {
  // In environments without a native EventSource (jsdom-based tests, SSR), we
  // return an inert stub so consumers don't crash. Real browser builds will
  // always have window.EventSource available.
  if (typeof EventSource === "undefined") {
    return {
      addEventListener() {},
      removeEventListener() {},
      close() {}
    };
  }
  return new EventSource(url, { withCredentials: true });
}

export function useExecutionNotifications(
  options: UseExecutionNotificationsOptions
): UseExecutionNotificationsResult {
  const { enabled = true, workspaceId } = options;
  const factoryRef = useRef(options.eventSourceFactory ?? defaultEventSourceFactory);
  const [notifications, setNotifications] = useState<ExecutionPlanNotification[]>([]);
  const [connectionState, setConnectionState] =
    useState<UseExecutionNotificationsResult["connectionState"]>("idle");

  // Clear the buffered notifications whenever the workspace changes or the
  // hook is disabled, so stale events from a previous workspace cannot remain
  // visible after the user signs out or switches contexts.
  useEffect(() => {
    setNotifications([]);
  }, [enabled, workspaceId]);

  useEffect(() => {
    if (!enabled || !workspaceId) {
      setConnectionState("idle");
      return;
    }

    let closed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let activeSource: EventSourceLike | null = null;

    const handleNotification = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as ExecutionPlanNotification;
        if (payload.workspaceId !== workspaceId) {
          return;
        }
        setNotifications((current) => {
          const next = [payload, ...current];
          return next.slice(0, MAX_BUFFER);
        });
      } catch {
        // Ignore malformed events.
      }
    };

    const handleReady = () => {
      attempt = 0;
      setConnectionState("open");
    };

    const handleError = () => {
      if (closed) {
        return;
      }
      setConnectionState("error");
      activeSource?.close();
      activeSource = null;
      const delay = Math.min(
        BACKOFF_CEILING_MS,
        BACKOFF_FLOOR_MS * 2 ** Math.min(attempt, 5)
      );
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (closed) {
        return;
      }
      setConnectionState("connecting");
      const url = buildNotificationStreamUrl(workspaceId);
      const source = factoryRef.current(url);
      activeSource = source;
      source.addEventListener("ready", handleReady);
      for (const type of NOTIFICATION_TYPES) {
        source.addEventListener(type, handleNotification);
      }
      source.addEventListener("error", handleError as (event: MessageEvent) => void);
    };

    connect();

    return () => {
      closed = true;
      setConnectionState("closed");
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      activeSource?.close();
      activeSource = null;
    };
  }, [enabled, workspaceId]);

  return {
    clear() {
      setNotifications([]);
    },
    connectionState,
    dismiss(planId, status) {
      setNotifications((current) =>
        current.filter(
          (entry) => !(entry.planId === planId && entry.status === status)
        )
      );
    },
    notifications
  };
}
