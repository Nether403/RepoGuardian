import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { PageWithBackground } from "@/components/layout/PageWithBackground";
import AnalysisResults from "@/components/analysis-results";
import { Comments } from "@/components/comments";
import { Ratings } from "@/components/ratings";
import { CollectionsManager } from "@/components/collections-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, GitFork, Eye, Github, Bookmark, Scale, Search, ExternalLink, AlertTriangle, Brain, MessageSquare, RefreshCw } from "lucide-react";

function ReanalyzeButton({ repositoryId }: { repositoryId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/repositories/${repositoryId}/reanalyze`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to reanalyze repository');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reanalysis Complete",
        description: "Repository has been reanalyzed with fresh data.",
      });
      // Invalidate and refetch repository data
      queryClient.invalidateQueries({ queryKey: ['/api/repositories', repositoryId] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Reanalysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      onClick={() => reanalyzeMutation.mutate()}
      disabled={reanalyzeMutation.isPending}
      variant="outline"
      className="border-2 border-border hover:border-primary transition-colors"
      data-testid="button-reanalyze"
    >
      <RefreshCw 
        className={`text-gray-400 mr-2 ${reanalyzeMutation.isPending ? 'animate-spin' : ''}`} 
        size={16} 
      />
      {reanalyzeMutation.isPending ? 'Reanalyzing...' : 'Reanalyze'}
    </Button>
  );
}

export default function RepositoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/repositories', id],
    enabled: !!id,
  });

  const saveRepositoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/saved-repositories', {
        repositoryId: id,
      });
    },
    onSuccess: () => {
      toast({
        title: "Repository Saved",
        description: "Repository has been added to your saved list.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/repositories', id] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to save repository. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unsaveRepositoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/saved-repositories/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Repository Unsaved",
        description: "Repository has been removed from your saved list.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/repositories', id] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to unsave repository. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark">
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-96 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-32 bg-gray-700 rounded"></div>
                <div className="h-24 bg-gray-700 rounded"></div>
              </div>
              <div className="space-y-4">
                <div className="h-32 bg-gray-700 rounded"></div>
                <div className="h-24 bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-dark">
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-secondary to-accent flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-4">Repository Not Found</h1>
          <p className="text-gray-400 mb-6">
            The repository you're looking for could not be found or may have been removed.
          </p>
          <Button
            onClick={() => window.history.back()}
            className="bg-primary hover:bg-secondary"
            data-testid="button-go-back"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { repository, analysis, similar, isSaved } = data;

  return (
    <PageWithBackground>
      <Header />
      
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Repository Header */}
        <Card className="bg-card border border-border mb-8">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <Github className="text-white" size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold gradient-text" data-testid="text-repository-name">
                    {repository.fullName}
                  </h1>
                  <p className="text-gray-400 mt-1" data-testid="text-repository-description">
                    {repository.description || 'No description available'}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-sm">
                    <div className="flex items-center space-x-1.5" title="Stars">
                      <Star className="text-yellow-500" size={16} fill="currentColor" />
                      <span className="text-gray-300" data-testid="text-stars">{repository.stars?.toLocaleString()}</span>
                      <span className="text-gray-500 text-xs">stars</span>
                    </div>
                    <div className="flex items-center space-x-1.5" title="Forks">
                      <GitFork className="text-gray-400" size={16} />
                      <span className="text-gray-300" data-testid="text-forks">{repository.forks?.toLocaleString()}</span>
                      <span className="text-gray-500 text-xs">forks</span>
                    </div>
                    <div className="flex items-center space-x-1.5" title="Watchers">
                      <Eye className="text-gray-400" size={16} />
                      <span className="text-gray-300" data-testid="text-watchers">{repository.watchers?.toLocaleString()}</span>
                      <span className="text-gray-500 text-xs">watchers</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => isSaved ? unsaveRepositoryMutation.mutate() : saveRepositoryMutation.mutate()}
                  disabled={saveRepositoryMutation.isPending || unsaveRepositoryMutation.isPending}
                  variant="outline"
                  className={`border-2 ${isSaved ? 'border-primary bg-primary/10 text-primary' : 'border-border'} hover:border-primary transition-colors`}
                  data-testid="button-save-repository"
                  data-tour="track-button"
                >
                  <Bookmark className={`${isSaved ? 'text-primary' : 'text-gray-400'} mr-2`} size={16} fill={isSaved ? 'currentColor' : 'none'} />
                  {isSaved ? 'Saved' : 'Save'}
                </Button>
                <ReanalyzeButton repositoryId={id} />
                {user && (
                  <CollectionsManager 
                    repositoryId={id} 
                    userId={user.id}
                    showCreateButton={false}
                  />
                )}
                <Button
                  onClick={() => window.location.href = `/compare?repo=${id}`}
                  variant="outline"
                  className="border-2 border-border hover:border-primary transition-colors"
                  data-testid="button-compare"
                >
                  <Scale className="text-gray-400 mr-2" size={16} />
                  Compare
                </Button>
                <Button
                  onClick={() => window.location.href = `/discover?repoId=${id}&repoUrl=${encodeURIComponent(repository.htmlUrl)}`}
                  variant="outline"
                  className="border-2 border-border hover:border-primary transition-colors"
                  data-testid="button-find-similar"
                >
                  <Search className="text-gray-400 mr-2" size={16} />
                  Find Similar
                </Button>
                <Button
                  onClick={() => window.open(repository.htmlUrl, '_blank')}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
                  data-testid="button-view-github"
                >
                  <ExternalLink className="mr-2" size={16} />
                  View on GitHub
                </Button>
              </div>
            </div>

            {/* Technology Stack */}
            {repository.languages && Object.keys(repository.languages).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Technology Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const total = Object.values(repository.languages).reduce((sum: number, val) => sum + (val as number), 0);
                    return Object.entries(repository.languages)
                      .sort(([,a], [,b]) => (b as number) - (a as number))
                      .slice(0, 8)
                      .map(([language, bytes]) => (
                        <Badge
                          key={language}
                          variant="secondary"
                          className="bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          data-testid={`badge-language-${language}`}
                        >
                          {language} ({(((bytes as number) / total) * 100).toFixed(1)}%)
                        </Badge>
                      ));
                  })()}
                </div>
              </div>
            )}

            {/* Topics */}
            {repository.topics && repository.topics.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {repository.topics.slice(0, 10).map((topic: string) => (
                    <Badge
                      key={topic}
                      variant="outline"
                      className="border-gray-500 text-gray-400"
                      data-testid={`badge-topic-${topic}`}
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis ? (
          <AnalysisResults 
            analysis={analysis} 
            repository={{
              name: repository.name,
              full_name: repository.fullName,
              description: repository.description,
              language: repository.language,
              stargazers_count: repository.stargazersCount,
              forks_count: repository.forksCount,
            }}
          />
        ) : (
          <Card className="bg-card border border-border mb-8">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                <Brain className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">No Analysis Available</h3>
              <p className="text-gray-400 mb-6">
                This repository hasn't been analyzed yet. Start an analysis to get insights.
              </p>
              <Button
                onClick={() => {
                  // Trigger analysis
                  window.location.href = `/?analyze=${encodeURIComponent(repository.htmlUrl)}`;
                }}
                className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
                data-testid="button-analyze"
              >
                <Brain className="mr-2" size={16} />
                Analyze Repository
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Social Features - Comments and Ratings */}
        <Card className="bg-card border border-border mb-8">
          <CardContent className="p-6">
            <Tabs defaultValue="comments" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-dark/50">
                <TabsTrigger value="comments" className="data-[state=active]:bg-primary/20">
                  <MessageSquare className="mr-2" size={16} />
                  Comments
                </TabsTrigger>
                <TabsTrigger value="ratings" className="data-[state=active]:bg-primary/20">
                  <Star className="mr-2" size={16} />
                  Ratings
                </TabsTrigger>
              </TabsList>
              <TabsContent value="comments" className="mt-6">
                <Comments repositoryId={id!} />
              </TabsContent>
              <TabsContent value="ratings" className="mt-6">
                <Ratings repositoryId={id!} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Similar Repositories */}
        {similar && similar.length > 0 && (
          <Card className="bg-card border border-border">
            <CardContent className="p-8">
              <h3 className="text-2xl font-semibold mb-6">Similar Repositories</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {similar.map((item: any) => {
                  const similarRepo = item.similarRepository;
                  return (
                    <div
                      key={similarRepo.id}
                      className="bg-dark rounded-lg p-4 border border-border hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/repository/${similarRepo.id}`}
                      data-testid={`card-similar-${similarRepo.id}`}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center">
                          <Github className="text-white" size={16} />
                        </div>
                        <div>
                          <h4 className="font-medium" data-testid={`text-similar-name-${similarRepo.id}`}>
                            {similarRepo.name}
                          </h4>
                          <p className="text-sm text-gray-400">
                            Similarity: {Math.round(item.similarity * 100)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {similarRepo.description || 'No description available'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWithBackground>
  );
}
