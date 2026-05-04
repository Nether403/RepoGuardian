const activeWorkspaceStorageKey = "repo-guardian-active-workspace-id";

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export function getLocalApiToken(): string {
  return (
    safeLocalStorageGet("repo-guardian-token") ||
    import.meta.env.VITE_API_SECRET_KEY ||
    ""
  );
}

export function getStoredActiveWorkspaceId(): string | null {
  const value = safeLocalStorageGet(activeWorkspaceStorageKey);
  return value && value.trim().length > 0 ? value : null;
}

export function setStoredActiveWorkspaceId(workspaceId: string | null): void {
  if (workspaceId && workspaceId.trim().length > 0) {
    safeLocalStorageSet(activeWorkspaceStorageKey, workspaceId);
    return;
  }

  safeLocalStorageRemove(activeWorkspaceStorageKey);
}


export function getApiOptions() {
  const token = getLocalApiToken();
  const activeWorkspaceId = getStoredActiveWorkspaceId();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (activeWorkspaceId) {
    headers["x-repo-guardian-workspace-id"] = activeWorkspaceId;
  }

  return {
    credentials: "include" as const,
    headers: Object.keys(headers).length > 0 ? headers : undefined
  };
}
