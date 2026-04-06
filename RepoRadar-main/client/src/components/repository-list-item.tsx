import { Star, GitFork, Eye, Calendar, Code, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface RepositoryListItemProps {
  repository: any;
  similarity?: number;
  index: number;
  onAnalyze?: () => void;
}

export default function RepositoryListItem({ 
  repository, 
  similarity, 
  index,
  onAnalyze 
}: RepositoryListItemProps) {
  const repo = repository.repository || repository;
  
  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="bg-card/50 border border-border hover:border-[#FF6B35]/50 transition-all duration-200 p-3 md:p-4">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          {/* Main Content */}
          <div className="flex-1 w-full">
            <div className="flex items-start gap-2 md:gap-3">
              {/* Similarity Score */}
              {similarity !== undefined && (
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF3333] flex items-center justify-center text-white font-bold text-sm md:text-base">
                    {similarity}%
                  </div>
                </div>
              )}
              
              {/* Repository Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-1">
                  <h3 className="text-base md:text-lg font-semibold hover:text-[#FF6B35] transition-colors truncate">
                    <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 touch-target">
                      <span className="truncate">{repo.fullName}</span>
                      <ExternalLink className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                    </a>
                  </h3>
                  {repo.language && (
                    <Badge variant="outline" className="text-xs w-fit">
                      <Code className="w-3 h-3 mr-1" />
                      {repo.language}
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                  {repo.description || 'No description available'}
                </p>
                
                {/* Topics */}
                {repo.topics && repo.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {repo.topics.slice(0, 5).map((topic: string) => (
                      <Badge key={topic} variant="secondary" className="text-xs bg-[#FF6B35]/10 text-[#FF6B35] border-[#FF6B35]/20">
                        {topic}
                      </Badge>
                    ))}
                    {repo.topics.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{repo.topics.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
                
                {/* Stats Row */}
                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500">
                  <span className="flex items-center gap-1 touch-target">
                    <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                    {formatNumber(repo.stars || 0)}
                  </span>
                  <span className="flex items-center gap-1 touch-target">
                    <GitFork className="w-3 h-3 md:w-4 md:h-4" />
                    {formatNumber(repo.forks || 0)}
                  </span>
                  <span className="flex items-center gap-1 touch-target hidden sm:flex">
                    <Eye className="w-3 h-3 md:w-4 md:h-4" />
                    {formatNumber(repo.watchers || 0)}
                  </span>
                  <span className="flex items-center gap-1 touch-target hidden md:flex">
                    <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                    Updated {formatDate(repo.updatedAt)}
                  </span>
                  {repo.size && (
                    <span className="text-xs hidden lg:inline">
                      {(repo.size / 1024).toFixed(1)} MB
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex md:flex-col gap-2 w-full md:w-auto">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 md:flex-none border-[#FF6B35]/30 hover:border-[#FF6B35] hover:bg-[#FF6B35]/10 touch-target"
              onClick={onAnalyze}
              data-testid={`button-analyze-${repo.id}`}
            >
              Analyze
            </Button>
            <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none">
              <Button
                size="sm"
                variant="ghost"
                className="w-full touch-target"
                data-testid={`button-view-${repo.id}`}
              >
                View on GitHub
              </Button>
            </a>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}