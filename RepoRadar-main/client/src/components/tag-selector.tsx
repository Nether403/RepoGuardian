import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tag as TagIcon, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Tag } from "@shared/schema";

interface TagSelectorProps {
  repositoryId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TagSelector({
  repositoryId,
  size = 'md',
  className = "",
}: TagSelectorProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#FF6B35");

  // Check if user has Pro/Enterprise tier
  const isPremiumUser = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'enterprise';

  // Fetch all user's tags
  const { data: tagsResponse } = useQuery<{
    data: Tag[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: ["/api/tags", { page: 1, limit: 1000 }],
    enabled: isAuthenticated && isPremiumUser,
  });

  const allTags = tagsResponse?.data || [];

  // Fetch tags for this specific repository
  const { data: repositoryTags = [] } = useQuery<Tag[]>({
    queryKey: [`/api/repositories/${repositoryId}/tags`],
    enabled: isAuthenticated && isPremiumUser,
  });

  const selectedTagIds = repositoryTags.map((tag: Tag) => tag.id);

  // Add tag to repository mutation
  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      await apiRequest("POST", `/api/repositories/${repositoryId}/tags`, { tagId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/repositories/${repositoryId}/tags`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Tag added",
        description: "Tag has been applied to this repository",
      });
    },
    onError: (error: any) => {
      if (error.message.includes('403') || error.message.includes('FEATURE_NOT_AVAILABLE')) {
        toast({
          title: "Premium feature",
          description: "Tags are available for Pro and Enterprise users. Upgrade to unlock this feature.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to add tag",
          description: error.message || "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Remove tag from repository mutation
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      await apiRequest("DELETE", `/api/repositories/${repositoryId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/repositories/${repositoryId}/tags`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Tag removed",
        description: "Tag has been removed from this repository",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove tag",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create new tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }): Promise<Tag> => {
      const response = await apiRequest("POST", "/api/tags", data);
      return await response.json();
    },
    onSuccess: (newTag: Tag) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Tag created",
        description: "New tag has been created successfully",
      });
      setNewTagName("");
      setNewTagColor("#FF6B35");
      setIsCreating(false);
      // Automatically apply the new tag to this repository
      addTagMutation.mutate(newTag.id);
    },
    onError: (error: any) => {
      if (error.message.includes('403') || error.message.includes('FEATURE_NOT_AVAILABLE')) {
        toast({
          title: "Premium feature",
          description: "Tags are available for Pro and Enterprise users. Upgrade to unlock this feature.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to create tag",
          description: error.message || "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleToggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      removeTagMutation.mutate(tagId);
    } else {
      addTagMutation.mutate(tagId);
    }
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      toast({
        title: "Validation error",
        description: "Tag name is required",
        variant: "destructive",
      });
      return;
    }
    createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor });
  };

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
    <div className={cn("flex items-center gap-2", className)}>
      {/* Display selected tags as badges */}
      {repositoryTags.slice(0, 3).map((tag: Tag) => (
        <Badge
          key={tag.id}
          style={{ backgroundColor: tag.color || '#FF6B35' }}
          className="text-white text-xs px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            removeTagMutation.mutate(tag.id);
          }}
        >
          {tag.name}
          <X className="ml-1 h-3 w-3" />
        </Badge>
      ))}
      
      {/* Show +N if there are more tags */}
      {repositoryTags.length > 3 && (
        <Badge variant="secondary" className="text-xs px-2 py-0.5">
          +{repositoryTags.length - 3}
        </Badge>
      )}

      {/* Tag selector button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              sizeClasses[size],
              "transition-all duration-200 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10"
            )}
            data-testid={`tag-selector-${repositoryId}`}
            aria-label="Manage tags"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <TagIcon className={iconSizes[size]} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0" 
          align="start"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Manage Tags</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreating(!isCreating)}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Tag
              </Button>
            </div>

            {/* Create new tag form */}
            {isCreating && (
              <form onSubmit={handleCreateTag} className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <div className="space-y-2">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    maxLength={50}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-8 w-12 rounded cursor-pointer"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createTagMutation.isPending || !newTagName.trim()}
                      className="h-8 text-xs flex-1"
                    >
                      {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Tag list */}
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {allTags.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No tags yet. Create your first tag!
                  </div>
                ) : (
                  allTags.map((tag: Tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.id)}
                        disabled={addTagMutation.isPending || removeTagMutation.isPending}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-md transition-colors text-left",
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: tag.color || '#FF6B35' }}
                          />
                          <span className="text-sm font-medium">{tag.name}</span>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
