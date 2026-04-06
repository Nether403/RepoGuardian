import { SearchHero } from "@/components/SearchHero";

export function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <SearchHero />
      
      {/* Footer / Trust indicators could go here */}
      <div className="mt-auto py-8 text-center text-sm text-muted-foreground">
        Powered by public GitHub APIs. Evaluates repos, code presence, and activity history.
      </div>
    </main>
  );
}
