import crypto from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import {
  ListGitHubInstallationsResponseSchema,
  SyncGitHubInstallationResponseSchema
} from "@repo-guardian/shared-types";
import {
  registerGitHubAppInstallation,
  syncInstallationRepositories
} from "../lib/github-installations.js";
import { env } from "../lib/env.js";
import { getGitHubInstallationRepository } from "../lib/persistence.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";

function getSingleParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const installationRouter: ExpressRouter = Router();

installationRouter.post("/github/webhooks", async (request, response, next) => {
  try {
    if (env.GITHUB_APP_WEBHOOK_SECRET) {
      const signature = request.headers["x-hub-signature-256"];
      const rawBody = JSON.stringify(request.body ?? {});
      const digest = `sha256=${crypto
        .createHmac("sha256", env.GITHUB_APP_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex")}`;
      if (typeof signature !== "string" || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        response.status(401).json({ error: "Invalid webhook signature." });
        return;
      }
    }

    const event = request.headers["x-github-event"];
    if (event !== "installation" && event !== "installation_repositories") {
      response.status(202).json({ received: true });
      return;
    }

    const installation = request.body?.installation;
    const account = installation?.account;
    const senderWorkspaceId =
      typeof request.body?.workspaceId === "string" ? request.body.workspaceId : request.body?.workspace_id;
    if (!installation?.id || !account?.id || !account?.login || !senderWorkspaceId) {
      response.status(400).json({ error: "Webhook payload is missing installation context." });
      return;
    }

    const store = getGitHubInstallationRepository();
    const saved = await store.upsertInstallation({
      githubInstallationId: Number(installation.id),
      permissions:
        installation.permissions && typeof installation.permissions === "object"
          ? installation.permissions
          : {},
      repositorySelection: installation.repository_selection === "all" ? "all" : "selected",
      status:
        request.body?.action === "deleted"
          ? "deleted"
          : request.body?.action === "suspend"
            ? "suspended"
            : "active",
      suspendedAt: request.body?.action === "suspend" ? new Date().toISOString() : null,
      targetId: Number(account.id),
      targetLogin: String(account.login),
      targetType: account.type === "Organization" ? "Organization" : "User",
      workspaceId: String(senderWorkspaceId)
    });

    if (event === "installation_repositories" || request.body?.repositories) {
      await syncInstallationRepositories({
        installationId: saved.id,
        workspaceId: saved.workspaceId
      });
    }

    response.status(202).json({ received: true });
  } catch (error) {
    next(error);
  }
});

installationRouter.use(requireAuth);

installationRouter.get(
  "/github/installations/setup",
  requireWorkspaceRole(["owner", "maintainer"]),
  async (request, response, next) => {
    try {
      const installationId = Number(request.query.installation_id);
      if (!Number.isSafeInteger(installationId) || installationId <= 0) {
        response.status(400).json({ error: "GitHub installation_id is required." });
        return;
      }

      await registerGitHubAppInstallation({
        githubInstallationId: installationId,
        workspaceId: request.authContext!.activeWorkspaceId
      });

      response.redirect(302, `/?githubInstallation=${installationId}`);
    } catch (error) {
      next(error);
    }
  }
);

installationRouter.get(
  "/workspaces/:workspaceId/installations",
  requireWorkspaceRole(["owner", "maintainer", "reviewer", "viewer"]),
  async (request, response, next) => {
    try {
      const workspaceId = getSingleParam(request.params.workspaceId);
      if (workspaceId !== request.authContext!.activeWorkspaceId) {
        response.status(403).json({ error: "Forbidden: workspace mismatch." });
        return;
      }

      const store = getGitHubInstallationRepository();
      response.json(
        ListGitHubInstallationsResponseSchema.parse({
          installations: await store.listInstallationsByWorkspace(workspaceId),
          repositories: await store.listRepositoriesByWorkspace(workspaceId)
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

installationRouter.post(
  "/workspaces/:workspaceId/installations/:installationId/sync",
  requireWorkspaceRole(["owner", "maintainer"]),
  async (request, response, next) => {
    try {
      const workspaceId = getSingleParam(request.params.workspaceId);
      const installationId = getSingleParam(request.params.installationId);
      if (workspaceId !== request.authContext!.activeWorkspaceId) {
        response.status(403).json({ error: "Forbidden: workspace mismatch." });
        return;
      }

      const store = getGitHubInstallationRepository();
      const installation = await store.getInstallationById({
        installationId,
        workspaceId
      });
      const repositories = await syncInstallationRepositories({
        installationId,
        workspaceId
      });

      response.json(
        SyncGitHubInstallationResponseSchema.parse({
          installation,
          repositories
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

export default installationRouter;
