import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Repository, RepositoryAnalysis } from "@shared/schema";
import { TrackRepositoryButton } from "@/components/track-repository-button";
import { BookmarkButton } from "@/components/bookmark-button";
import { TagSelector } from "@/components/tag-selector";
import { getScoreHealthIndicator, getMetricHealthIndicator } from "@/utils/health-indicators";

interface RepositoryCardProps {
  repository: Repository;
  analysis?: Pick<RepositoryAnalysis, 'overallScore' | 'originality' | 'completeness' | 'marketability'>;
  showAnalysis?: boolean;
}

export default function RepositoryCard({ repository, analysis, showAnalysis = true }: RepositoryCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-400";
    if (score >= 6) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 8) return "from-green-400 to-blue-500";
    if (score >= 6) return "from-yellow-400 to-orange-500";
    return "from-red-400 to-pink-500";
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link href={`/repository/${repository.id}`}>
      <Card className="bg-card border border-border hover:border-primary/30 transition-all duration-300 group cursor-pointer h-full card-hover card-lift fade-in">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <i className="fab fa-github text-white"></i>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-lg truncate">{repository.name}</h4>
                <p className="text-sm text-gray-400 truncate">{repository.fullName}</p>
              </div>
            </div>
            {showAnalysis && analysis && (
              <div className="flex items-center space-x-1">
                <span className="text-xl">{getScoreHealthIndicator(analysis.overallScore * 10).emoji}</span>
                <div className={`text-2xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                  {analysis.overallScore.toFixed(1)}
                </div>
              </div>
            )}
          </div>
          
          <p className="text-gray-300 text-sm mb-4 line-clamp-2">
            {repository.description || 'No description available'}
          </p>

          {showAnalysis && analysis && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Originality</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getScoreGradient(analysis.originality)}`}
                      style={{ width: `${(analysis.originality / 10) * 100}%` }}
                    ></div>
                  </div>
                  <span className={`font-semibold ${getScoreColor(analysis.originality)}`}>
                    {analysis.originality.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Completeness</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getScoreGradient(analysis.completeness)}`}
                      style={{ width: `${(analysis.completeness / 10) * 100}%` }}
                    ></div>
                  </div>
                  <span className={`font-semibold ${getScoreColor(analysis.completeness)}`}>
                    {analysis.completeness.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Marketability</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getScoreGradient(analysis.marketability)}`}
                      style={{ width: `${(analysis.marketability / 10) * 100}%` }}
                    ></div>
                  </div>
                  <span className={`font-semibold ${getScoreColor(analysis.marketability)}`}>
                    {analysis.marketability.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <div className="flex items-center space-x-1">
                <i className="fas fa-star text-yellow-500"></i>
                <span>{repository.stars?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <i className="fas fa-code-branch text-blue-400"></i>
                <span>{repository.forks?.toLocaleString() || 0}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {repository.language && (
                <Badge variant="secondary" className="text-xs">
                  {repository.language}
                </Badge>
              )}
              <div onClick={handleTrackClick} className="flex items-center space-x-1">
                <BookmarkButton 
                  repositoryId={repository.id}
                  size="sm"
                />
                <TagSelector 
                  repositoryId={repository.id}
                  size="sm"
                />
                <TrackRepositoryButton 
                  repositoryId={repository.id} 
                  repositoryName={repository.fullName}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}