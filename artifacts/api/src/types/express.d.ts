import type {
  AuthenticatedUser,
  SessionWorkspace
} from "@repo-guardian/shared-types";

declare global {
  namespace Express {
    interface Request {
      authContext?: {
        authMode: "api_key" | "session";
        activeWorkspaceId: string;
        membership: SessionWorkspace["membership"];
        user: AuthenticatedUser;
      };
    }
  }
}

export {};
