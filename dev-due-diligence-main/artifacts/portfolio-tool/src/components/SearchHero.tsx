import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Search, Github, ArrowRight, AlertCircle, GitCompare } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function extractUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes("github.com")) {
      const url = new URL(
        trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
      );
      if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
        return null;
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return null;
      return parts[0];
    }
  } catch {
    // not a URL — fall through to username check
  }

  return trimmed;
}

export function SearchHero() {
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const username = extractUsername(input);

    if (!username) {
      setError("Please enter a valid GitHub username or profile URL.");
      return;
    }

    if (!GITHUB_USERNAME_RE.test(username)) {
      setError(
        "That doesn't look like a valid GitHub username. Usernames can only contain letters, numbers, and hyphens.",
      );
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setLocation(`/report/${username}`);
    }, 300);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] w-full px-4 text-center overflow-hidden">
      
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 opacity-40">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 max-w-3xl w-full space-y-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 border border-white/5 text-sm font-medium text-muted-foreground mb-4">
          <Github className="w-4 h-4 text-primary" />
          Technical Due Diligence Engine
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold text-foreground leading-[1.1]">
          Analyze any developer <br/>
          <span className="text-gradient">in seconds.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Paste a GitHub profile to instantly uncover code quality, contribution trends, and technical signals. Built for technical recruiters and VCs.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 max-w-xl mx-auto relative group">
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-focus-within:bg-primary/30 transition-all duration-500 opacity-50" />
          <div className={`relative flex items-center glass-panel rounded-2xl p-2 pl-4 transition-colors ${error ? "border-red-500/50" : "focus-within:border-primary/50"}`}>
            <Search className="w-6 h-6 text-muted-foreground" />
            <Input
              type="text"
              placeholder="username or github.com/username"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError(null);
              }}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-lg h-14 placeholder:text-muted-foreground/70"
            />
            <Button 
              type="submit" 
              size="lg" 
              className="rounded-xl ml-2 font-bold min-w-[140px]"
              disabled={!input.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Analyze <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </Button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mt-3 text-sm text-red-400 text-left px-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </form>

        <div className="flex items-center justify-center gap-6 mt-4">
          <p className="text-xs text-muted-foreground/50">
            Powered by public GitHub APIs. Evaluates repos, code presence, and activity history.
          </p>
          <Link href="/compare" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-primary transition-colors">
            <GitCompare className="w-3.5 h-3.5" />
            Compare profiles
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
