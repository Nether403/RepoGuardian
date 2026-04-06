import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { PageWithBackground } from "@/components/layout/PageWithBackground";
import EnhancedSearch from "@/components/enhanced-search";
import RepositoryCard from "@/components/repository-card";
import { isUnauthorizedError } from "@/lib/authUtils";
import { TrendingRepos } from "@/components/trending-repos";
import { CardSkeleton, LoadingSkeleton } from "@/components/skeleton-loader";
import { ContentTransition } from "@/components/content-transition";

interface RecentAnalysis {
  id: string;
  repositoryId: string;
  repositoryName: string;
  repositoryOwner: string;
  primaryLanguage?: string;
  originality: number;
  completeness: number;
  marketability: number;
  monetization: number;
  usefulness: number;
  overallScore: number;
  createdAt: Date;
  repository: {
    id: string;
    name: string;
    fullName: string;
    owner: string;
    description: string | null;
    language: string | null;
    stars: number | null;
    forks: number | null;
    watchers: number | null;
    size: number | null;
    isPrivate: boolean | null;
    htmlUrl: string;
    cloneUrl: string;
    languages: any;
    topics: string[] | null;
    lastAnalyzed: Date | null;
    analysisCount: number | null;
    lastReanalyzedBy: string | null;
    reanalysisLockedUntil: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };
}

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: recentAnalyses, isLoading: loadingAnalyses } = useQuery<any[]>({
    queryKey: ['/api/analyses/user/recent'],
    enabled: isAuthenticated,
  });

  const { data: trendingRepos, isLoading: loadingTrending } = useQuery<any[]>({
    queryKey: ['/api/repositories/trending'],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <PageWithBackground>
      <Header />
      
      <EnhancedSearch />

        {/* Dashboard Grid */}
        <main id="main-content" className="py-8 md:py-16" role="main" aria-label="Dashboard">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
            {/* Trending Repositories - Left Column */}
            <div className="lg:col-span-1">
              <TrendingRepos />
            </div>
            
            {/* Recent Analyses - Right Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6 md:mb-12">
                <h3 className="text-2xl md:text-3xl font-bold">Recent Analysis</h3>
                <button 
                  className="text-primary hover:text-secondary transition-colors font-medium text-sm md:text-base touch-target focus-ring" 
                  data-testid="button-view-all"
                  aria-label="View all recent analyses"
                >
                  View All
                </button>
              </div>

              <ContentTransition
                isLoading={loadingAnalyses}
                skeleton={
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <LoadingSkeleton variant="card" count={4} />
                  </div>
                }
              >
                {recentAnalyses && recentAnalyses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {(recentAnalyses as RecentAnalysis[]).slice(0, 4).map((analysis) => (
                      <RepositoryCard
                        key={analysis.id}
                        repository={analysis.repository}
                        analysis={{
                          overallScore: analysis.overallScore,
                          originality: analysis.originality,
                          completeness: analysis.completeness,
                          marketability: analysis.marketability,
                        }}
                      />
                    ))}
                  </div>
                  ) : (
                  <div className="text-center py-8 md:py-12">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-chart-line text-white text-xl md:text-2xl"></i>
                    </div>
                    <h4 className="text-lg md:text-xl font-semibold mb-2">No Recent Analysis</h4>
                    <p className="text-sm md:text-base text-gray-400 mb-4">Start analyzing repositories to see them here</p>
                  </div>
                )}
              </ContentTransition>
            </div>
          </div>
        </div>
      </main>
    </PageWithBackground>
  );
}
