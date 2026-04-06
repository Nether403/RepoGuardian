import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  repositoryId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BookmarkButton({
  repositoryId,
  size = 'md',
  className = "",
}: BookmarkButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOptimistic, setIsOptimistic] = useState(false);

  // Check if user has Pro/Enterprise tier
  const isPremiumUser = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'enterprise';

  // Fetch bookmarks to check if this repository is bookmarked
  const { data: bookmarksResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/bookmarks"],
    enabled: isAuthenticated && isPremiumUser,
  });

  const bookmarks = bookmarksResponse?.data || [];
  const isBookmarked = bookmarks.some((b: any) => b.repositoryId === repositoryId) || isOptimistic;

  // Toggle bookmark mutation
  const toggleBookmarkMutation = useMutation({
    mutationFn: async () => {
      if (isBookmarked && !isOptimistic) {
        // Remove bookmark
        await apiRequest("DELETE", `/api/bookmarks/${repositoryId}`);
        return { action: 'removed' };
      } else {
        // Add bookmark
        await apiRequest("POST", "/api/bookmarks", { repositoryId });
        return { action: 'added' };
      }
    },
    onMutate: async () => {
      // Optimistic update
      setIsOptimistic(!isBookmarked);
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/bookmarks"] });
      
      // Snapshot previous value
      const previousBookmarks = queryClient.getQueryData(["/api/bookmarks"]);
      
      // Optimistically update cache
      queryClient.setQueryData(["/api/bookmarks"], (old: any) => {
        const oldData = old?.data || [];
        const newData = isBookmarked
          ? oldData.filter((b: any) => b.repositoryId !== repositoryId)
          : [...oldData, { repositoryId, createdAt: new Date() }];
        
        return {
          data: newData,
          pagination: old?.pagination || { page: 1, limit: 20, total: newData.length, totalPages: 1, hasMore: false }
        };
      });
      
      return { previousBookmarks };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({
        title: data.action === 'added' ? "Bookmark added" : "Bookmark removed",
        description: data.action === 'added' 
          ? "Repository has been bookmarked" 
          : "Repository bookmark has been removed",
      });
      setIsOptimistic(false);
    },
    onError: (error: any, _, context) => {
      // Rollback optimistic update
      if (context?.previousBookmarks) {
        queryClient.setQueryData(["/api/bookmarks"], context.previousBookmarks);
      }
      setIsOptimistic(false);
      
      // Handle tier restriction error
      if (error.message.includes('403') || error.message.includes('FEATURE_NOT_AVAILABLE')) {
        toast({
          title: "Premium feature",
          description: "Bookmarks are available for Pro and Enterprise users. Upgrade to unlock this feature.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to update bookmark",
          description: error.message || "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Don't show button if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Don't show button for free users (tier enforcement)
  if (!isPremiumUser) {
    return null;
  }

  // Size variants
  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmarkMutation.mutate();
      }}
      disabled={toggleBookmarkMutation.isPending}
      className={cn(
        sizeClasses[size],
        "transition-all duration-200",
        isBookmarked 
          ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10" 
          : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/10",
        className
      )}
      data-testid={`bookmark-button-${repositoryId}`}
      aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <Bookmark 
        className={cn(
          iconSizes[size],
          "transition-all duration-200",
          isBookmarked && "fill-current"
        )}
      />
    </Button>
  );
}
