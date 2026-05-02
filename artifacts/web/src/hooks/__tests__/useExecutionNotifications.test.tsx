import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useExecutionNotifications,
  type EventSourceLike
} from "../useExecutionNotifications";
import type {
  ExecutionPlanNotification,
  ExecutionPlanNotificationType
} from "../../lib/notifications-client";

type Listener = (event: MessageEvent) => void;

class FakeEventSource implements EventSourceLike {
  public readonly url: string;
  public readonly listeners = new Map<string, Set<Listener>>();
  public closed = false;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: Listener): void {
    let bucket = this.listeners.get(type);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(type, bucket);
    }
    bucket.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  dispatch(type: string, data: unknown): void {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  totalListenerCount(): number {
    let total = 0;
    this.listeners.forEach((bucket) => {
      total += bucket.size;
    });
    return total;
  }
}

let notificationIdCounter = 0;

function makeNotification(
  workspaceId: string,
  planId: string,
  status: ExecutionPlanNotificationType = "plan.created",
  id?: number
): ExecutionPlanNotification {
  notificationIdCounter += 1;
  return {
    createdAt: new Date().toISOString(),
    executionId: null,
    id: id ?? notificationIdCounter,
    planId,
    reason: null,
    repositoryFullName: "octo/repo",
    status,
    workspaceId
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useExecutionNotifications", () => {
  it("subscribes when enabled and a workspace is set, and tears down on unmount", () => {
    const sources: FakeEventSource[] = [];
    const factory = vi.fn((url: string) => {
      const source = new FakeEventSource(url);
      sources.push(source);
      return source;
    });

    const { unmount } = renderHook(() =>
      useExecutionNotifications({
        enabled: true,
        workspaceId: "workspace_a",
        eventSourceFactory: factory
      })
    );

    expect(factory).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.closed).toBe(false);
    expect(sources[0]?.url).toContain("workspaceId=workspace_a");

    unmount();

    expect(sources[0]?.closed).toBe(true);
  });

  it("does not subscribe when disabled and goes idle when disabled mid-life", () => {
    const factory = vi.fn(
      (url: string) => new FakeEventSource(url)
    ) as unknown as (url: string) => EventSourceLike;

    const { rerender, result } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useExecutionNotifications({
          enabled,
          workspaceId: "workspace_a",
          eventSourceFactory: factory
        }),
      { initialProps: { enabled: false } }
    );

    expect(factory).not.toHaveBeenCalled();
    expect(result.current.connectionState).toBe("idle");

    rerender({ enabled: true });
    expect(factory).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    expect(result.current.connectionState).toBe("idle");
  });

  it("closes the previous source and clears the buffer when workspaceId changes", () => {
    const sources: FakeEventSource[] = [];
    const factory = vi.fn((url: string) => {
      const source = new FakeEventSource(url);
      sources.push(source);
      return source;
    });

    const { rerender, result } = renderHook(
      ({ workspaceId }: { workspaceId: string }) =>
        useExecutionNotifications({
          enabled: true,
          workspaceId,
          eventSourceFactory: factory
        }),
      { initialProps: { workspaceId: "workspace_a" } }
    );

    expect(sources).toHaveLength(1);

    act(() => {
      sources[0]?.dispatch("plan.created", makeNotification("workspace_a", "plan_a1"));
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.planId).toBe("plan_a1");

    rerender({ workspaceId: "workspace_b" });

    // Old source must be torn down and a new one opened.
    expect(sources[0]?.closed).toBe(true);
    expect(sources).toHaveLength(2);
    expect(sources[1]?.closed).toBe(false);
    expect(sources[1]?.url).toContain("workspaceId=workspace_b");

    // Buffer must be cleared so workspace_a events do not leak across.
    expect(result.current.notifications).toHaveLength(0);

    act(() => {
      sources[1]?.dispatch("plan.created", makeNotification("workspace_b", "plan_b1"));
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.planId).toBe("plan_b1");
  });

  it("ignores events whose workspaceId does not match the active workspace", () => {
    const sources: FakeEventSource[] = [];
    const factory = (url: string) => {
      const source = new FakeEventSource(url);
      sources.push(source);
      return source;
    };

    const { result } = renderHook(() =>
      useExecutionNotifications({
        enabled: true,
        workspaceId: "workspace_a",
        eventSourceFactory: factory
      })
    );

    act(() => {
      sources[0]?.dispatch(
        "plan.created",
        makeNotification("workspace_other", "plan_leaked")
      );
      sources[0]?.dispatch(
        "plan.completed",
        makeNotification("workspace_a", "plan_kept", "plan.completed")
      );
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.planId).toBe("plan_kept");
    expect(result.current.notifications[0]?.status).toBe("plan.completed");
  });

  it("dismiss removes a single notification and clear empties the buffer", () => {
    const sources: FakeEventSource[] = [];
    const factory = (url: string) => {
      const source = new FakeEventSource(url);
      sources.push(source);
      return source;
    };

    const { result } = renderHook(() =>
      useExecutionNotifications({
        enabled: true,
        workspaceId: "workspace_a",
        eventSourceFactory: factory
      })
    );

    act(() => {
      sources[0]?.dispatch(
        "plan.created",
        makeNotification("workspace_a", "plan_1", "plan.created")
      );
      sources[0]?.dispatch(
        "plan.failed",
        makeNotification("workspace_a", "plan_2", "plan.failed")
      );
    });
    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.dismiss("plan_1", "plan.created");
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.planId).toBe("plan_2");

    act(() => {
      result.current.clear();
    });
    expect(result.current.notifications).toHaveLength(0);
  });

  it("requests a replay using the highest seen id after a backoff reconnect", () => {
    const sources: FakeEventSource[] = [];
    const factory = (url: string) => {
      const source = new FakeEventSource(url);
      sources.push(source);
      return source;
    };

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useExecutionNotifications({
          enabled: true,
          workspaceId: "workspace_a",
          eventSourceFactory: factory
        })
      );

      expect(sources).toHaveLength(1);
      // First connect uses no cursor.
      expect(sources[0]?.url).not.toContain("lastEventId=");

      act(() => {
        sources[0]?.dispatch(
          "plan.created",
          makeNotification("workspace_a", "plan_a1", "plan.created", 7)
        );
      });
      expect(result.current.notifications).toHaveLength(1);

      // Trigger an error to force the hook to close the source and schedule a
      // reconnect via setTimeout.
      act(() => {
        sources[0]?.dispatch("error", { message: "network blip" });
      });
      act(() => {
        vi.advanceTimersByTime(35_000);
      });

      expect(sources.length).toBeGreaterThanOrEqual(2);
      const reconnected = sources[sources.length - 1]!;
      expect(reconnected.url).toContain("lastEventId=7");

      // A replayed event with the same id must NOT appear twice in the buffer.
      act(() => {
        reconnected.dispatch(
          "plan.created",
          makeNotification("workspace_a", "plan_a1", "plan.created", 7)
        );
        reconnected.dispatch(
          "plan.completed",
          makeNotification("workspace_a", "plan_a2", "plan.completed", 8)
        );
      });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications.map((n) => n.id).sort()).toEqual([
        7, 8
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not leak listeners across reconnect cycles when the EventSource errors", () => {
    const sources: FakeEventSource[] = [];
    const factory = (url: string) => {
      const source = new FakeEventSource(url);
      sources.push(source);
      return source;
    };

    vi.useFakeTimers();
    try {
      const { unmount } = renderHook(() =>
        useExecutionNotifications({
          enabled: true,
          workspaceId: "workspace_a",
          eventSourceFactory: factory
        })
      );

      expect(sources).toHaveLength(1);
      const initialListenerCount = sources[0]!.totalListenerCount();
      expect(initialListenerCount).toBeGreaterThan(0);

      // Trigger an error to force the hook to close the source and schedule a
      // reconnect via setTimeout. After the timer fires a fresh source should
      // exist with the same number of listeners — the closed one should not
      // accumulate any extras.
      act(() => {
        sources[0]?.dispatch("error", { message: "network blip" });
      });
      expect(sources[0]?.closed).toBe(true);

      act(() => {
        vi.advanceTimersByTime(35_000);
      });

      expect(sources.length).toBeGreaterThanOrEqual(2);
      const reconnected = sources[sources.length - 1]!;
      expect(reconnected.closed).toBe(false);
      expect(reconnected.totalListenerCount()).toBe(initialListenerCount);

      unmount();
      expect(reconnected.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
