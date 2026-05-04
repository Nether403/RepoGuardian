import type { NextFunction, Request, Response } from "express";
import type { WorkspaceRole } from "@repo-guardian/shared-types";
import {
  createClearedSessionSetCookieHeader,
  parseCookies,
  parseSessionCookie
} from "../lib/auth-session.js";
import { env } from "../lib/env.js";
import { getWorkspaceRepository } from "../lib/persistence.js";

function createSyntheticDevAuthContext(): NonNullable<Request["authContext"]> {
  const timestamp = new Date(0).toISOString();

  return {
    activeWorkspaceId: "workspace_local_default",
    authMode: "api_key",
    membership: {
      createdAt: timestamp,
      id: "membership_local_default",
      role: "owner",
      updatedAt: timestamp,
      userId: "usr_local_default",
      workspaceId: "workspace_local_default"
    },
    user: {
      avatarUrl: null,
      createdAt: timestamp,
      displayName: "Local Dev User",
      githubLogin: "local-dev",
      githubUserId: 1,
      id: "usr_local_default",
      updatedAt: timestamp
    }
  };
}

function getRequestedWorkspaceId(request: Request): string | null {
  const headerValue = request.headers["x-repo-guardian-workspace-id"];
  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? null;
  }

  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  const queryValue = request.query.workspaceId;
  if (Array.isArray(queryValue)) {
    const firstValue = queryValue[0];
    return typeof firstValue === "string" && firstValue.trim().length > 0
      ? firstValue.trim()
      : null;
  }

  return typeof queryValue === "string" && queryValue.trim().length > 0
    ? queryValue.trim()
    : null;
}

function getRequestedBearerToken(
  request: Request,
  options: { allowQueryToken: boolean }
): string | null {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // EventSource cannot send custom headers, so SSE clients must forward the
  // bearer token via the access_token query string. This fallback is opt-in
  // per route via `requireSseAuth` to avoid expanding credential exposure
  // through URL logs/history/referrers on routes that don't need it.
  if (options.allowQueryToken && request.method === "GET") {
    const queryToken = request.query.access_token;
    if (typeof queryToken === "string" && queryToken.length > 0) {
      return queryToken;
    }
    if (Array.isArray(queryToken)) {
      const first = queryToken[0];
      if (typeof first === "string" && first.length > 0) {
        return first;
      }
    }
  }

  return null;
}

async function resolveApiKeyAuth(
  request: Request,
  options: { allowQueryToken: boolean }
): Promise<Request["authContext"] | null> {
  const token = getRequestedBearerToken(request, options);
  if (!token) {
    return null;
  }

  const acceptedDevToken = "dev-secret-key-do-not-use-in-production";
  const tokenMatchesConfigured = token === env.API_SECRET_KEY;
  const tokenMatchesDevFallback =
    env.NODE_ENV !== "production" && token === acceptedDevToken;
  const allowNonProductionBearer = env.NODE_ENV !== "production" && token.length > 0;

  if (!tokenMatchesConfigured && !tokenMatchesDevFallback && !allowNonProductionBearer) {
    return null;
  }

  if (env.NODE_ENV !== "production") {
    return createSyntheticDevAuthContext();
  }

  if (env.NODE_ENV === "production" && !env.ALLOW_LEGACY_API_KEY_AUTH) {
    throw new Error("Legacy API key auth is disabled in production.");
  }

  const workspaceRepository = getWorkspaceRepository();

  try {
    const defaultMembership = await workspaceRepository.ensureDefaultDevMembership();

    return {
      activeWorkspaceId: defaultMembership.workspace.id,
      authMode: "api_key",
      membership: defaultMembership.membership,
      user: defaultMembership.user
    };
  } catch {
    return createSyntheticDevAuthContext();
  }
}

async function resolveSessionAuth(request: Request): Promise<Request["authContext"] | null> {
  const cookies = parseCookies(request.headers.cookie);
  const rawSession = cookies[env.SESSION_COOKIE_NAME];
  if (!rawSession) {
    return null;
  }

  const session = parseSessionCookie(rawSession);
  const workspaceRepository = getWorkspaceRepository();
  const activeWorkspaceId = getRequestedWorkspaceId(request) ?? session.activeWorkspaceId;

  if (!activeWorkspaceId) {
    throw new Error("No workspace is selected for this session.");
  }

  const [user, membership] = await Promise.all([
    workspaceRepository.getUser(session.userId),
    workspaceRepository.getMembership({
      userId: session.userId,
      workspaceId: activeWorkspaceId
    })
  ]);

  return {
    activeWorkspaceId: membership.workspace.id,
    authMode: "session",
    membership: membership.membership,
    user
  };
}

async function runAuth(
  request: Request,
  response: Response,
  next: NextFunction,
  options: { allowQueryToken: boolean }
): Promise<void> {
  try {
    request.authContext =
      (await resolveApiKeyAuth(request, options)) ??
      (await resolveSessionAuth(request)) ??
      undefined;

    if (!request.authContext) {
      response.status(401).json({
        error: "Unauthorized: missing valid session or legacy API key."
      });
      return;
    }

    next();
  } catch (error) {
    response.setHeader("Set-Cookie", createClearedSessionSetCookieHeader());
    response.status(401).json({
      error: error instanceof Error ? error.message : "Unauthorized"
    });
  }
}

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  return runAuth(request, response, next, { allowQueryToken: false });
}

// Permissive variant for the SSE notifications endpoint only. EventSource
// cannot attach an Authorization header, so we accept the bearer via the
// `?access_token=` query string. Do NOT use this for any other route.
export function requireSseAuth(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  return runAuth(request, response, next, { allowQueryToken: true });
}

export function requireWorkspaceRole(
  allowedRoles: WorkspaceRole[]
): (request: Request, response: Response, next: NextFunction) => void {
  return (request, response, next) => {
    const authContext = request.authContext;
    if (!authContext) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(authContext.membership.role)) {
      response.status(403).json({
        error: "Forbidden: insufficient workspace role."
      });
      return;
    }

    next();
  };
}
