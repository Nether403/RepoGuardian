import { GithubRepo } from "@workspace/api-client-react";

export type TechCategory = "Frontend" | "Backend" | "Mobile" | "ML/AI" | "DevOps" | "Database" | "Systems";

export interface TechItem {
  name: string;
  category: TechCategory;
  count: number;
}

const TOPIC_MAP: Record<string, { display: string; category: TechCategory }> = {
  // Frontend
  react: { display: "React", category: "Frontend" },
  "react.js": { display: "React", category: "Frontend" },
  reactjs: { display: "React", category: "Frontend" },
  vue: { display: "Vue", category: "Frontend" },
  "vue.js": { display: "Vue", category: "Frontend" },
  angular: { display: "Angular", category: "Frontend" },
  svelte: { display: "Svelte", category: "Frontend" },
  nextjs: { display: "Next.js", category: "Frontend" },
  "next.js": { display: "Next.js", category: "Frontend" },
  gatsby: { display: "Gatsby", category: "Frontend" },
  nuxt: { display: "Nuxt", category: "Frontend" },
  remix: { display: "Remix", category: "Frontend" },
  tailwindcss: { display: "Tailwind CSS", category: "Frontend" },
  tailwind: { display: "Tailwind CSS", category: "Frontend" },
  // Backend
  nodejs: { display: "Node.js", category: "Backend" },
  "node.js": { display: "Node.js", category: "Backend" },
  express: { display: "Express", category: "Backend" },
  expressjs: { display: "Express", category: "Backend" },
  fastapi: { display: "FastAPI", category: "Backend" },
  django: { display: "Django", category: "Backend" },
  flask: { display: "Flask", category: "Backend" },
  rails: { display: "Rails", category: "Backend" },
  "ruby-on-rails": { display: "Rails", category: "Backend" },
  spring: { display: "Spring", category: "Backend" },
  nestjs: { display: "NestJS", category: "Backend" },
  laravel: { display: "Laravel", category: "Backend" },
  gin: { display: "Gin", category: "Backend" },
  fiber: { display: "Fiber", category: "Backend" },
  deno: { display: "Deno", category: "Backend" },
  bun: { display: "Bun", category: "Backend" },
  graphql: { display: "GraphQL", category: "Backend" },
  grpc: { display: "gRPC", category: "Backend" },
  // Mobile
  "react-native": { display: "React Native", category: "Mobile" },
  flutter: { display: "Flutter", category: "Mobile" },
  ios: { display: "iOS", category: "Mobile" },
  android: { display: "Android", category: "Mobile" },
  swiftui: { display: "SwiftUI", category: "Mobile" },
  "jetpack-compose": { display: "Compose", category: "Mobile" },
  // ML/AI
  "machine-learning": { display: "Machine Learning", category: "ML/AI" },
  "deep-learning": { display: "Deep Learning", category: "ML/AI" },
  tensorflow: { display: "TensorFlow", category: "ML/AI" },
  pytorch: { display: "PyTorch", category: "ML/AI" },
  "scikit-learn": { display: "scikit-learn", category: "ML/AI" },
  jupyter: { display: "Jupyter", category: "ML/AI" },
  llm: { display: "LLM", category: "ML/AI" },
  nlp: { display: "NLP", category: "ML/AI" },
  "computer-vision": { display: "Computer Vision", category: "ML/AI" },
  ai: { display: "AI", category: "ML/AI" },
  // DevOps
  docker: { display: "Docker", category: "DevOps" },
  kubernetes: { display: "Kubernetes", category: "DevOps" },
  k8s: { display: "Kubernetes", category: "DevOps" },
  terraform: { display: "Terraform", category: "DevOps" },
  ansible: { display: "Ansible", category: "DevOps" },
  "github-actions": { display: "GitHub Actions", category: "DevOps" },
  "ci-cd": { display: "CI/CD", category: "DevOps" },
  helm: { display: "Helm", category: "DevOps" },
  aws: { display: "AWS", category: "DevOps" },
  azure: { display: "Azure", category: "DevOps" },
  gcp: { display: "GCP", category: "DevOps" },
  serverless: { display: "Serverless", category: "DevOps" },
  // Database
  postgresql: { display: "PostgreSQL", category: "Database" },
  postgres: { display: "PostgreSQL", category: "Database" },
  mongodb: { display: "MongoDB", category: "Database" },
  mysql: { display: "MySQL", category: "Database" },
  sqlite: { display: "SQLite", category: "Database" },
  redis: { display: "Redis", category: "Database" },
  elasticsearch: { display: "Elasticsearch", category: "Database" },
  prisma: { display: "Prisma", category: "Database" },
  supabase: { display: "Supabase", category: "Database" },
  // Systems
  webassembly: { display: "WebAssembly", category: "Systems" },
  wasm: { display: "WebAssembly", category: "Systems" },
  embedded: { display: "Embedded", category: "Systems" },
  "operating-system": { display: "OS Dev", category: "Systems" },
};

const LANG_TO_TECH: Record<string, { display: string; category: TechCategory }> = {
  TypeScript: { display: "TypeScript", category: "Frontend" },
  JavaScript: { display: "JavaScript", category: "Frontend" },
  Python: { display: "Python", category: "Backend" },
  Go: { display: "Go", category: "Backend" },
  Rust: { display: "Rust", category: "Systems" },
  Swift: { display: "Swift", category: "Mobile" },
  Kotlin: { display: "Kotlin", category: "Mobile" },
  Java: { display: "Java", category: "Backend" },
  Ruby: { display: "Ruby", category: "Backend" },
  PHP: { display: "PHP", category: "Backend" },
  "C#": { display: "C#", category: "Backend" },
  "C++": { display: "C++", category: "Systems" },
  C: { display: "C", category: "Systems" },
  Scala: { display: "Scala", category: "Backend" },
  Elixir: { display: "Elixir", category: "Backend" },
  Haskell: { display: "Haskell", category: "Backend" },
  Dart: { display: "Dart", category: "Mobile" },
  Shell: { display: "Shell", category: "DevOps" },
};

const CATEGORY_COLORS: Record<TechCategory, string> = {
  Frontend: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Backend: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Mobile: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "ML/AI": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  DevOps: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Database: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  Systems: "text-red-400 bg-red-500/10 border-red-500/20",
};

export function getTechStack(repos: GithubRepo[]): TechItem[] {
  const counts: Record<string, TechItem> = {};

  const bump = (key: string, name: string, category: TechCategory) => {
    if (!counts[key]) counts[key] = { name, category, count: 0 };
    counts[key].count++;
  };

  repos.forEach((repo) => {
    // From topics
    (repo.topics || []).forEach((topic) => {
      const mapped = TOPIC_MAP[topic.toLowerCase()];
      if (mapped) bump(mapped.display, mapped.display, mapped.category);
    });

    // From language (only owned repos)
    if (repo.language && !repo.fork) {
      const langMapped = LANG_TO_TECH[repo.language];
      if (langMapped) bump(langMapped.display, langMapped.display, langMapped.category);
    }
  });

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);
}

export { CATEGORY_COLORS };
