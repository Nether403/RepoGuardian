import {
  GitHubReadClient,
  GitHubWriteClient,
  fetchGitHubAppInstallation,
  listRepositoriesForInstallation,
  mintGitHubInstallationToken
} from "@repo-guardian/github";
import {
  getGitHubInstallationRepository,
  getWorkspaceRepository
} from "./persistence.js";
import { env } from "./env.js";

function canUseInstallationAuth(): boolean {
  return Boolean(env.DATABASE_URL && env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY);
}

function createFallbackReadClient(): GitHubReadClient {
  return new GitHubReadClient({ token: env.GITHUB_TOKEN });
}

function createFallbackWriteClient(): GitHubWriteClient {
  return new GitHubWriteClient({ token: env.GITHUB_TOKEN });
}

function requireGitHubAppConfiguration(): {
  appId: string;
  privateKey: string;
} {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are not configured.");
  }

  return {
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY
  };
}

export async function mintInstallationAccessToken(installationId: string): Promise<string> {
  const store = getGitHubInstallationRepository();
  const installation = await store.getInstallationById({ installationId });
  const config = requireGitHubAppConfiguration();
  const token = await mintGitHubInstallationToken({
    appId: config.appId,
    installationId: installation.githubInstallationId,
    privateKey: config.privateKey
  });
  return token.token;
}

export async function createInstallationReadClient(input: {
  repositoryFullName: string;
  workspaceId: string;
}): Promise<GitHubReadClient> {
  if (!canUseInstallationAuth()) {
    return createFallbackReadClient();
  }

  const store = getGitHubInstallationRepository();

  try {
    const repository = await store.findRepositoryByFullName(input);
    const token = await mintInstallationAccessToken(repository.githubInstallationId);
    return new GitHubReadClient({ token });
  } catch (error) {
    if (env.NODE_ENV !== "production") {
      return createFallbackReadClient();
    }

    throw error;
  }
}

export async function createInstallationWriteClient(input: {
  repositoryFullName: string;
  workspaceId: string;
}): Promise<GitHubWriteClient> {
  if (!canUseInstallationAuth()) {
    return createFallbackWriteClient();
  }

  const store = getGitHubInstallationRepository();

  try {
    const repository = await store.findRepositoryByFullName(input);
    const token = await mintInstallationAccessToken(repository.githubInstallationId);
    return new GitHubWriteClient({ token });
  } catch (error) {
    if (env.NODE_ENV !== "production") {
      return createFallbackWriteClient();
    }

    throw error;
  }
}

export async function syncInstallationRepositories(input: {
  installationId: string;
  workspaceId: string;
}) {
  const store = getGitHubInstallationRepository();
  await getWorkspaceRepository().getWorkspace(input.workspaceId);
  const token = await mintInstallationAccessToken(input.installationId);
  const repositories = await listRepositoriesForInstallation({ accessToken: token });
  return store.replaceInstallationRepositories({
    installationId: input.installationId,
    repositories,
    workspaceId: input.workspaceId
  });
}

export async function registerGitHubAppInstallation(input: {
  githubInstallationId: number;
  workspaceId: string;
}) {
  const config = requireGitHubAppConfiguration();
  const store = getGitHubInstallationRepository();
  await getWorkspaceRepository().getWorkspace(input.workspaceId);

  const installationDetails = await fetchGitHubAppInstallation({
    appId: config.appId,
    installationId: input.githubInstallationId,
    privateKey: config.privateKey
  });

  const installation = await store.upsertInstallation({
    githubInstallationId: input.githubInstallationId,
    permissions: installationDetails.permissions,
    repositorySelection: installationDetails.repositorySelection,
    status: installationDetails.suspendedAt ? "suspended" : "active",
    suspendedAt: installationDetails.suspendedAt,
    targetId: installationDetails.accountId,
    targetLogin: installationDetails.accountLogin,
    targetType: installationDetails.accountType,
    workspaceId: input.workspaceId
  });

  const repositories = await syncInstallationRepositories({
    installationId: installation.id,
    workspaceId: input.workspaceId
  });

  return {
    installation,
    repositories
  };
}
