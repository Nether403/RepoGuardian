export const DEFAULT_WORKSPACE_ID = "workspace_local_default";
export const DEFAULT_USER_ID = "usr_local_default";
export const DEFAULT_MEMBERSHIP_ID = "membership_local_default";

export function resolveWorkspaceId(workspaceId?: string | null): string {
  return workspaceId?.trim() ? workspaceId.trim() : DEFAULT_WORKSPACE_ID;
}
