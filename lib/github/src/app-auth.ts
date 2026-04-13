import crypto from "node:crypto";

type InstallationTokenCacheEntry = {
  expiresAtMs: number;
  token: string;
};

const installationTokenCache = new Map<string, InstallationTokenCacheEntry>();

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

export function createGitHubAppJwt(input: {
  appId: string;
  privateKey: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: input.appId
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(input.privateKey);
  return `${header}.${payload}.${base64UrlEncode(signature)}`;
}

async function fetchGitHubJson<T>(
  url: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`GitHub request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function exchangeGitHubOAuthCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<{ accessToken: string }> {
  const payload = await fetchGitHubJson<{
    access_token?: string;
  }>("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code
    })
  });

  if (!payload.access_token) {
    throw new Error("GitHub OAuth exchange did not return an access token.");
  }

  return { accessToken: payload.access_token };
}

export async function fetchGitHubViewer(input: {
  accessToken: string;
}): Promise<{
  avatarUrl: string | null;
  id: number;
  login: string;
  name: string | null;
}> {
  const payload = await fetchGitHubJson<{
    avatar_url?: string | null;
    id: number;
    login: string;
    name?: string | null;
  }>("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.accessToken}`,
      "User-Agent": "RepoGuardian"
    }
  });

  return {
    avatarUrl: payload.avatar_url ?? null,
    id: payload.id,
    login: payload.login,
    name: payload.name ?? null
  };
}

export async function mintGitHubInstallationToken(input: {
  appId: string;
  installationId: number;
  privateKey: string;
}): Promise<{ expiresAt: string; token: string }> {
  const cacheKey = `${input.appId}:${input.installationId}`;
  const cached = installationTokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now() + 30_000) {
    return {
      expiresAt: new Date(cached.expiresAtMs).toISOString(),
      token: cached.token
    };
  }

  const jwt = createGitHubAppJwt({
    appId: input.appId,
    privateKey: input.privateKey
  });
  const payload = await fetchGitHubJson<{
    expires_at: string;
    token: string;
  }>(`https://api.github.com/app/installations/${input.installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "User-Agent": "RepoGuardian"
    }
  });

  installationTokenCache.set(cacheKey, {
    expiresAtMs: new Date(payload.expires_at).getTime(),
    token: payload.token
  });

  return {
    expiresAt: payload.expires_at,
    token: payload.token
  };
}

export async function listRepositoriesForInstallation(input: {
  accessToken: string;
}): Promise<
  Array<{
    canonicalUrl: string;
    defaultBranch: string | null;
    fullName: string;
    githubRepositoryId: number;
    isArchived: boolean;
    isPrivate: boolean;
    isSelected: boolean;
    owner: string;
    repo: string;
    repositoryNodeId: string | null;
  }>
> {
  const payload = await fetchGitHubJson<{
    repositories?: Array<{
      archived?: boolean;
      default_branch?: string | null;
      full_name: string;
      html_url: string;
      id: number;
      name: string;
      node_id?: string | null;
      owner?: { login?: string };
      private?: boolean;
    }>;
  }>("https://api.github.com/installation/repositories", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.accessToken}`,
      "User-Agent": "RepoGuardian"
    }
  });

  return (payload.repositories ?? []).map((repository) => ({
    canonicalUrl: repository.html_url,
    defaultBranch: repository.default_branch ?? null,
    fullName: repository.full_name,
    githubRepositoryId: repository.id,
    isArchived: repository.archived ?? false,
    isPrivate: repository.private ?? false,
    isSelected: true,
    owner: repository.owner?.login ?? repository.full_name.split("/")[0] ?? "",
    repo: repository.name,
    repositoryNodeId: repository.node_id ?? null
  }));
}
