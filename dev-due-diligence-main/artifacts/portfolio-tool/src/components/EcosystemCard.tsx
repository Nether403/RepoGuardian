import { useGetGithubOrgs } from "@workspace/api-client-react";
import { GithubRepo } from "@workspace/api-client-react";
import { Building2 } from "lucide-react";

interface Props {
  username: string;
  repos: GithubRepo[];
}

const NOTABLE_ORGS = new Set([
  "google", "microsoft", "facebook", "meta", "apple", "amazon", "netflix",
  "twitter", "x", "airbnb", "uber", "lyft", "stripe", "shopify", "vercel",
  "hashicorp", "mozilla", "apache", "linux", "torvalds", "cncf", "openai",
  "anthropic", "huggingface", "pytorch", "tensorflow", "rust-lang", "golang",
  "nodejs", "denoland", "vitejs", "nuxt", "sveltejs", "redwoodjs",
]);

function getEcosystemSignals(repos: GithubRepo[]): string[] {
  const signals: string[] = [];
  const topics = repos.flatMap((r) => r.topics || []).map((t) => t.toLowerCase());
  const topicSet = new Set(topics);
  const langSet = new Set(repos.map((r) => r.language).filter(Boolean));

  const totalStars = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((a, r) => a + (r.forks_count || 0), 0);

  if (totalStars > 1000) signals.push("Widely-starred open source projects");
  if (totalForks > 500) signals.push("Heavily forked — community adoption");

  if (topicSet.has("npm") || (langSet.has("TypeScript") || langSet.has("JavaScript")) && repos.some((r) => r.topics?.includes("library"))) {
    signals.push("npm ecosystem contributor");
  }
  if (topicSet.has("machine-learning") || topicSet.has("deep-learning") || topicSet.has("pytorch") || topicSet.has("tensorflow")) {
    signals.push("ML/AI ecosystem contributor");
  }
  if (topicSet.has("docker") || topicSet.has("kubernetes") || topicSet.has("terraform")) {
    signals.push("Cloud-native practitioner");
  }
  if (topicSet.has("security") || topicSet.has("cryptography") || topicSet.has("penetration-testing")) {
    signals.push("Security-focused developer");
  }
  if (langSet.has("Rust") || langSet.has("C") || langSet.has("C++")) {
    signals.push("Systems-level engineering");
  }
  if (topicSet.has("webassembly") || topicSet.has("wasm")) {
    signals.push("WebAssembly contributor");
  }

  return signals.slice(0, 4);
}

export function EcosystemCard({ username, repos }: Props) {
  const { data: orgs, isLoading } = useGetGithubOrgs(username);
  const signals = getEcosystemSignals(repos);

  const hasContent = (orgs && orgs.length > 0) || signals.length > 0;
  if (!isLoading && !hasContent) return null;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary" />
        Organization & Ecosystem
      </h3>

      {/* Orgs */}
      {isLoading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-9 h-9 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : orgs && orgs.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Member of</p>
          <div className="flex flex-wrap gap-2">
            {orgs.slice(0, 10).map((org) => {
              const isNotable = NOTABLE_ORGS.has(org.login.toLowerCase());
              return (
                <a
                  key={org.login}
                  href={`https://github.com/${org.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={org.login}
                  className="group relative"
                >
                  <div className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${isNotable ? "border-primary/50 shadow-lg shadow-primary/10" : "border-white/10 hover:border-white/30"}`}>
                    <img src={org.avatar_url} alt={org.login} className="w-full h-full object-cover" />
                  </div>
                  {isNotable && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border border-background" />
                  )}
                </a>
              );
            })}
            {orgs.length > 10 && (
              <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-muted-foreground">
                +{orgs.length - 10}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Ecosystem signals */}
      {signals.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Ecosystem signals</p>
          <div className="space-y-1.5">
            {signals.map((s) => (
              <div key={s} className="flex items-center gap-2 text-sm text-foreground/70">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
