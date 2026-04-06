import { getTechStack, CATEGORY_COLORS, TechCategory } from "@/lib/techstack";
import { GithubRepo } from "@workspace/api-client-react";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  repos: GithubRepo[];
}

const CATEGORY_ORDER: TechCategory[] = ["Frontend", "Backend", "Mobile", "ML/AI", "DevOps", "Database", "Systems"];

export function TechStack({ repos }: Props) {
  const stack = getTechStack(repos);
  if (stack.length === 0) return null;

  const grouped = CATEGORY_ORDER.reduce<Record<TechCategory, typeof stack>>((acc, cat) => {
    const items = stack.filter((t) => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<TechCategory, typeof stack>);

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/5">
      <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <Cpu className="w-4 h-4 text-primary" />
        Tech Stack
        <span className="text-xs text-muted-foreground font-normal ml-1">inferred from repos & topics</span>
      </h3>

      <div className="space-y-3">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">{category}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.map((tech, idx) => (
                <span
                  key={`${tech.name}-${idx}`}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                    CATEGORY_COLORS[tech.category as TechCategory],
                  )}
                >
                  {tech.name}
                  {tech.count > 1 && (
                    <span className="opacity-60 text-[10px]">×{tech.count}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
