import crypto from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import {
  AuthSessionSchema,
  CreateWorkspaceRequestSchema,
  CreateWorkspaceResponseSchema,
  ListWorkspacesResponseSchema
} from "@repo-guardian/shared-types";
import { exchangeGitHubOAuthCode, fetchGitHubViewer } from "@repo-guardian/github";
import {
  createClearedSessionSetCookieHeader,
  createSessionSetCookieHeader
} from "../lib/auth-session.js";
import { env } from "../lib/env.js";
import { getWorkspaceRepository } from "../lib/persistence.js";
import { requireAuth } from "../middleware/auth.js";

function createOauthState(): string {
  return crypto.randomBytes(12).toString("hex");
}

const authRouter: ExpressRouter = Router();

authRouter.get("/auth/session", requireAuth, async (request, response) => {
  const authContext = request.authContext!;
  const workspaceRepository = getWorkspaceRepository();
  const workspaces = await workspaceRepository.listWorkspacesForUser(authContext.user.id);
  response.json(
    AuthSessionSchema.parse({
      authenticated: true,
      authMode: authContext.authMode,
      user: authContext.user,
      activeWorkspaceId: authContext.activeWorkspaceId,
      workspaces
    })
  );
});

authRouter.get("/auth/github/start", (_request, response) => {
  if (!env.GITHUB_OAUTH_CLIENT_ID) {
    response.status(500).json({ error: "GitHub OAuth is not configured." });
    return;
  }

  const state = createOauthState();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  response.redirect(url.toString());
});

authRouter.get("/auth/github/callback", async (request, response) => {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  if (!code) {
    response.status(400).json({ error: "Missing GitHub OAuth code." });
    return;
  }

  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    response.status(500).json({ error: "GitHub OAuth is not configured." });
    return;
  }

  const workspaceRepository = getWorkspaceRepository();
  const { accessToken } = await exchangeGitHubOAuthCode({
    clientId: env.GITHUB_OAUTH_CLIENT_ID,
    clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
    code
  });
  const viewer = await fetchGitHubViewer({ accessToken });
  const user = await workspaceRepository.upsertGitHubUser({
    avatarUrl: viewer.avatarUrl,
    displayName: viewer.name,
    githubLogin: viewer.login,
    githubUserId: viewer.id
  });
  let workspaces = await workspaceRepository.listWorkspacesForUser(user.id);

  if (workspaces.length === 0) {
    await workspaceRepository.createWorkspace({
      name: `${viewer.login}'s Workspace`,
      ownerUserId: user.id
    });
    workspaces = await workspaceRepository.listWorkspacesForUser(user.id);
  }

  const activeWorkspaceId = workspaces[0]?.workspace.id ?? null;
  response.setHeader(
    "Set-Cookie",
    createSessionSetCookieHeader({
      activeWorkspaceId,
      authMode: "session",
      userId: user.id
    })
  );
  response.redirect("/");
});

authRouter.post("/auth/logout", (_request, response) => {
  response.setHeader("Set-Cookie", createClearedSessionSetCookieHeader());
  response.status(204).send();
});

authRouter.get("/workspaces", requireAuth, async (request, response) => {
  const workspaceRepository = getWorkspaceRepository();
  const workspaces = await workspaceRepository.listWorkspacesForUser(request.authContext!.user.id);
  response.json(
    ListWorkspacesResponseSchema.parse({
      activeWorkspaceId: request.authContext!.activeWorkspaceId,
      workspaces
    })
  );
});

authRouter.post("/workspaces", requireAuth, async (request, response) => {
  const parsed = CreateWorkspaceRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }

  const created = await getWorkspaceRepository().createWorkspace({
    name: parsed.data.name,
    ownerUserId: request.authContext!.user.id
  });
  response.status(201).json(CreateWorkspaceResponseSchema.parse(created));
});

export default authRouter;
