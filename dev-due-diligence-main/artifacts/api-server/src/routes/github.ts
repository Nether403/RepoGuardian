import { Router, type IRouter } from "express";

const router: IRouter = Router();

const GITHUB_API = "https://api.github.com";

const githubHeaders: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "portfolio-due-diligence-tool",
};

if (process.env.GITHUB_TOKEN) {
  githubHeaders["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
}

async function checkReadme(owner: string, repo: string): Promise<boolean> {
  try {
    const r = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
      headers: { ...githubHeaders, Accept: "application/vnd.github.object+json" },
    });
    return r.status === 200;
  } catch {
    return false;
  }
}

async function withConcurrency<T, U>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

function handleGithubStatus(
  status: number,
  req: { log: { error: (data: unknown, msg: string) => void } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): boolean {
  if (status === 404) {
    res.status(404).json({ error: "GitHub user not found" });
    return true;
  }
  if (status === 403 || status === 429) {
    req.log.error({ status }, "GitHub API rate limit exceeded");
    res.status(429).json({ error: "GitHub API rate limit exceeded. Add a GITHUB_TOKEN environment variable to increase limits." });
    return true;
  }
  if (!String(status).startsWith("2")) {
    req.log.error({ status }, "GitHub API error");
    res.status(502).json({ error: `GitHub API error (${status})` });
    return true;
  }
  return false;
}

router.get("/github/profile/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await fetch(`${GITHUB_API}/users/${username}`, {
      headers: githubHeaders,
    });
    if (handleGithubStatus(response.status, req, res)) return;
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub profile");
    res.status(502).json({ error: "Failed to reach GitHub API" });
  }
});

router.get("/github/repos/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await fetch(
      `${GITHUB_API}/users/${username}/repos?per_page=100&sort=pushed&direction=desc`,
      { headers: githubHeaders },
    );
    if (handleGithubStatus(response.status, req, res)) return;
    const repos = (await response.json()) as Record<string, unknown>[];

    const checkLimit = 20;
    const toCheck = repos.slice(0, checkLimit);
    const hasReadmeFlags = await withConcurrency(toCheck, 5, (repo) =>
      checkReadme(
        username,
        typeof repo.name === "string" ? repo.name : String(repo.name),
      ),
    );

    const enriched = repos.map((repo, i) => ({
      ...repo,
      has_readme: i < checkLimit ? hasReadmeFlags[i] : null,
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub repos");
    res.status(502).json({ error: "Failed to reach GitHub API" });
  }
});

router.get("/github/events/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        fetch(`${GITHUB_API}/users/${username}/events/public?per_page=100&page=${page}`, {
          headers: githubHeaders,
        })
      ),
    );
    if (handleGithubStatus(pages[0].status, req, res)) return;
    const results = await Promise.all(
      pages.filter((r) => r.ok).map((r) => r.json()),
    );
    const events = (results as unknown[][]).flat();
    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub events");
    res.status(502).json({ error: "Failed to reach GitHub API" });
  }
});

router.get("/github/orgs/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const response = await fetch(`${GITHUB_API}/users/${username}/orgs?per_page=30`, {
      headers: githubHeaders,
    });
    if (handleGithubStatus(response.status, req, res)) return;
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub orgs");
    res.status(502).json({ error: "Failed to reach GitHub API" });
  }
});

export default router;
