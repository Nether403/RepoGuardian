import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TrackRepositoryButtonProps {
  repositoryId: string;
  repositoryName: string;
  className?: string;
}

export function TrackRepositoryButton({
  repositoryId,
  repositoryName,
  className = "",
}: TrackRepositoryButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Check if repository is tracked
  const { data: trackedRepos = [] } = useQuery<any[]>({
    queryKey: ["/api/user/tracked-repositories"],
    enabled: isAuthenticated,
  });

  const isTracked = trackedRepos.some((t: any) => t.repositoryId === repositoryId);
  const currentTracking = trackedRepos.find((t: any) => t.repositoryId === repositoryId);

  // Track repository mutation
  const trackMutation = useMutation({
    mutationFn: async (trackingType: string) => {
      await apiRequest("POST", `/api/repositories/${repositoryId}/track`, {
        trackingType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/tracked-repositories"] });
      toast({
        title: "Repository tracked",
        description: `You will receive notifications for ${repositoryName}`,
      });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to track repository",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Untrack repository mutation
  const untrackMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/repositories/${repositoryId}/track`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/tracked-repositories"] });
      toast({
        title: "Repository untracked",
        description: `You will no longer receive notifications for ${repositoryName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to untrack repository",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return null;
  }

  if (isTracked) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => untrackMutation.mutate()}
        disabled={untrackMutation.isPending}
        className={`${className} border-primary/30 hover:border-primary/50`}
        data-testid={`button-untrack-${repositoryId}`}
      >
        <EyeOff className="h-3 w-3 mr-1" />
        {untrackMutation.isPending ? "Untracking..." : "Tracked"}
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={trackMutation.isPending}
          data-testid={`button-track-${repositoryId}`}
        >
          <Eye className="h-3 w-3 mr-1" />
          {trackMutation.isPending ? "Tracking..." : "Track"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Choose tracking type</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => trackMutation.mutate("all")}
          data-testid={`button-track-all-${repositoryId}`}
        >
          <span className="mr-2">🔄</span>
          Track All Updates
          <span className="ml-auto text-xs text-muted-foreground">
            Stars, releases, commits
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => trackMutation.mutate("stars")}
          data-testid={`button-track-stars-${repositoryId}`}
        >
          <span className="mr-2">⭐</span>
          Track Stars Only
          <span className="ml-auto text-xs text-muted-foreground">
            Star milestones
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => trackMutation.mutate("releases")}
          data-testid={`button-track-releases-${repositoryId}`}
        >
          <span className="mr-2">🚀</span>
          Track Releases
          <span className="ml-auto text-xs text-muted-foreground">
            New versions
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => trackMutation.mutate("commits")}
          data-testid={`button-track-commits-${repositoryId}`}
        >
          <span className="mr-2">💻</span>
          Track Commits
          <span className="ml-auto text-xs text-muted-foreground">
            Code changes
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => trackMutation.mutate("issues")}
          data-testid={`button-track-issues-${repositoryId}`}
        >
          <span className="mr-2">🐛</span>
          Track Issues
          <span className="ml-auto text-xs text-muted-foreground">
            New & closed
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}