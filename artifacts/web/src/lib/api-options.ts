const activeWorkspaceStorageKey = "repo-guardian-active-workspace-id";

export function getLocalApiToken(): string {
  return (
    window.localStorage.getItem("repo-guardian-token") ||
    import.meta.env.VITE_API_SECRET_KEY ||
    ""
  );
}

export function getStoredActiveWorkspaceId(): string | null {
  const value = window.localStorage.getItem(activeWorkspaceStorageKey);
  return value && value.trim().length > 0 ? value : null;
}

export function setStoredActiveWorkspaceId(workspaceId: string | null): void {
  if (workspaceId && workspaceId.trim().length > 0) {
    window.localStorage.setItem(activeWorkspaceStorageKey, workspaceId);
    return;
  }

  window.localStorage.removeItem(activeWorkspaceStorageKey);
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
