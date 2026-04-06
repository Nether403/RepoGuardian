import { Flag } from "@/lib/scoring";
import { CheckCircle2, XCircle } from "lucide-react";

export function Flags({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-2xl">
        Not enough data to surface clear signals.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {flags.map((flag, idx) => (
        <div 
          key={idx} 
          className={`flex gap-4 p-5 rounded-2xl border transition-colors ${
            flag.type === 'success' 
              ? 'bg-success/5 border-success/20 hover:border-success/40 hover:bg-success/10' 
              : 'bg-destructive/5 border-destructive/20 hover:border-destructive/40 hover:bg-destructive/10'
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {flag.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-success" />
            ) : (
              <XCircle className="w-6 h-6 text-destructive" />
            )}
          </div>
          <div>
            <h4 className={`font-bold text-lg mb-1 ${flag.type === 'success' ? 'text-success' : 'text-destructive'}`}>
              {flag.label}
            </h4>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {flag.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
