import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Sparkles, 
  Star, 
  GitFork, 
  AlertCircle,
  TrendingUp,
  ExternalLink,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { UpgradePrompt } from "@/components/upgrade-prompt";

interface Recommendation {
  repository: {
    id: string;
    name: string;
    fullName: string;
    description?: string;
    stars?: number;
    forks?: number;
    language?: string;
    owner: string;
  };
  matchScore: number;
  reasoning: string;
  basedOn: {
    languages: string[];
    topics: string[];
    similarTo: string[];
  };
}

interface RecommendationsTabProps {
  className?: string;
}

export function RecommendationsTab({ className }: RecommendationsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Fetch recommendations
  const { 
    data: recommendations, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery<{ recommendations: Recommendation[] }>({
    queryKey: ["/api/recommendations"],
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: false,
  });

  // Dismiss recommendation mutation
  const dismissMutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      // For now, we'll handle dismissal client-side
      // In a full implementation, this would call an API endpoint
      setDismissedIds(prev => new Set(prev).add(repositoryId));
    },
    onSuccess: () => {
      toast({
        title: "Recommendation dismissed",
        description: "This repository has been removed from your recommendations.",
      });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state - check if it's a 403 (tier restriction)
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : "";
    const is403Error = errorMessage.includes("403") || errorMessage.includes("FEATURE_NOT_AVAILABLE");
    
    if (is403Error) {
      return <UpgradePrompt feature="recommendations" />;
    }
    
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load recommendations</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage || "An error occurred while loading your recommendations."}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Filter out dismissed recommendations
  const visibleRecommendations = recommendations?.recommendations?.filter(
    rec => !dismissedIds.has(rec.repository.id)
  ) || [];

  // Empty state - insufficient activity or all dismissed
  if (!recommendations?.recommendations || recommendations.recommendations.length === 0 || visibleRecommendations.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-12 text-center">
          <div className="mb-6">
            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No recommendations yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We need more data to generate personalized recommendations. 
              Analyze more repositories and set your preferences to get started.
            </p>
          </div>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/">
              <Button>
                Discover Repositories
              </Button>
            </Link>
            <Link href="/profile?tab=preferences">
              <Button variant="outline">
                Set Preferences
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">
          {visibleRecommendations.length} Personalized {visibleRecommendations.length === 1 ? "Recommendation" : "Recommendations"}
        </h3>
      </div>

      {/* Recommendations list */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {visibleRecommendations.map((rec, index) => (
            <motion.div
              key={rec.repository.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.05 }}
              layout
            >
              <Card className="group hover:border-primary/50 transition-all duration-200 overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Repository icon */}
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <i className="fab fa-github text-white text-xl"></i>
                    </div>

                    {/* Repository details */}
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base sm:text-lg truncate group-hover:text-primary transition-colors">
                              {rec.repository.name}
                            </h4>
                            <Badge 
                              variant="secondary" 
                              className="flex items-center gap-1 bg-primary/10 text-primary w-fit text-xs sm:text-sm"
                            >
                              <TrendingUp className="h-3 w-3" />
                              {rec.matchScore}% match
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {rec.repository.fullName}
                          </p>
                        </div>
                        
                        {/* Dismiss button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dismissMutation.mutate(rec.repository.id);
                          }}
                          disabled={dismissMutation.isPending}
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-w-[44px] min-h-[44px]"
                          aria-label="Dismiss recommendation"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Description */}
                      {rec.repository.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3">
                          {rec.repository.description}
                        </p>
                      )}

                      {/* Reasoning */}
                      <div className="mb-3 p-2 sm:p-3 bg-primary/5 rounded-md border border-primary/10">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Why recommended: </span>
                          {rec.reasoning}
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span>{rec.repository.stars?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0">
                          <GitFork className="h-4 w-4 text-blue-400" />
                          <span>{rec.repository.forks?.toLocaleString() || 0}</span>
                        </div>
                        {rec.repository.language && (
                          <Badge variant="secondary" className="text-xs">
                            {rec.repository.language}
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link href={`/repository/${rec.repository.id}`}>
                          <Button size="sm" className="gap-2 min-h-[44px] w-full sm:w-auto">
                            <ExternalLink className="h-4 w-4" />
                            Analyze
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
