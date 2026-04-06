import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Tag, 
  Trash2, 
  Plus,
  AlertCircle,
  Tags as TagsIcon,
  Palette
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { UpgradePrompt } from "@/components/upgrade-prompt";

interface TagWithCount {
  id: number;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  repositoryCount?: number;
}

interface TagsTabProps {
  className?: string;
}

const DEFAULT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
];

export function TagsTab({ className }: TagsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0]);
  const [tagToDelete, setTagToDelete] = useState<TagWithCount | null>(null);
  const [nameError, setNameError] = useState("");

  // Fetch tags with pagination
  const { 
    data: tagsResponse, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery<{
    data: TagWithCount[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: ["/api/tags", { page: 1, limit: 1000 }], // Load all tags at once for now
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const tags = tagsResponse?.data || [];

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return await apiRequest("POST", "/api/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Tag created",
        description: "Your new tag has been created successfully.",
      });
      setNewTagName("");
      setSelectedColor(DEFAULT_COLORS[0]);
      setIsCreating(false);
      setNameError("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create tag",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      await apiRequest("DELETE", `/api/tags/${tagId}`);
    },
    onMutate: async (tagId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/tags"] });
      
      // Snapshot previous value
      const previousTags = queryClient.getQueryData(["/api/tags", { page: 1, limit: 1000 }]);
      
      // Optimistically update
      queryClient.setQueryData(["/api/tags", { page: 1, limit: 1000 }], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((t: TagWithCount) => t.id !== tagId),
          pagination: {
            ...old.pagination,
            total: old.pagination.total - 1,
          },
        };
      });
      
      return { previousTags };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Tag deleted",
        description: "Tag and all its associations have been removed.",
      });
      setTagToDelete(null);
    },
    onError: (error: any, _, context) => {
      // Rollback on error
      if (context?.previousTags) {
        queryClient.setQueryData(["/api/tags", { page: 1, limit: 1000 }], context.previousTags);
      }
      toast({
        title: "Failed to delete tag",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
      setTagToDelete(null);
    },
  });

  const handleCreateTag = () => {
    // Validate tag name
    const trimmedName = newTagName.trim();
    if (!trimmedName) {
      setNameError("Tag name is required");
      return;
    }
    if (trimmedName.length > 50) {
      setNameError("Tag name must be 50 characters or less");
      return;
    }
    
    // Check for duplicate names
    if (tags.some(tag => tag.name.toLowerCase() === trimmedName.toLowerCase())) {
      setNameError("A tag with this name already exists");
      return;
    }

    createTagMutation.mutate({ name: trimmedName, color: selectedColor });
  };

  const handleNameChange = (value: string) => {
    setNewTagName(value);
    if (nameError) {
      setNameError("");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state - check if it's a 403 (tier restriction)
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : "";
    const is403Error = errorMessage.includes("403") || errorMessage.includes("FEATURE_NOT_AVAILABLE");
    
    if (is403Error) {
      return <UpgradePrompt feature="tags" />;
    }
    
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load tags</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage || "An error occurred while loading your tags."}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagsIcon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {tags.length} {tags.length === 1 ? "Tag" : "Tags"}
          </h3>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          size="sm"
          variant={isCreating ? "outline" : "default"}
        >
          {isCreating ? (
            <>Cancel</>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Tag
            </>
          )}
        </Button>
      </div>

      {/* Create tag form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-primary/50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tag-name">Tag Name</Label>
                    <Input
                      id="tag-name"
                      placeholder="Enter tag name..."
                      value={newTagName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !createTagMutation.isPending) {
                          handleCreateTag();
                        }
                      }}
                      className={cn(nameError && "border-destructive")}
                      maxLength={50}
                      autoFocus
                    />
                    {nameError && (
                      <p className="text-sm text-destructive">{nameError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Color
                    </Label>
                    <div className="grid grid-cols-8 sm:grid-cols-16 gap-2">
                      {DEFAULT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={cn(
                            "w-8 h-8 rounded-md transition-all hover:scale-110",
                            selectedColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Select color ${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateTag}
                      disabled={createTagMutation.isPending || !newTagName.trim()}
                      className="flex-1"
                    >
                      {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {tags.length === 0 && !isCreating && (
        <Card>
          <CardContent className="p-12 text-center">
            <Tag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No tags yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Create custom tags to organize your repositories. 
              Tags help you categorize and filter repositories based on your own system.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Tag
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tags grid */}
      {tags.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {tags.map((tag, index) => (
              <motion.div
                key={tag.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className="group hover:border-primary/50 transition-all duration-200">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            style={{ backgroundColor: tag.color }}
                            className="text-white font-medium text-xs sm:text-sm"
                          >
                            {tag.name}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {tag.repositoryCount || 0} {tag.repositoryCount === 1 ? "repository" : "repositories"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTagToDelete(tag)}
                        disabled={deleteTagMutation.isPending}
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px]"
                        aria-label="Delete tag"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{tagToDelete?.name}"? 
              This will remove the tag from all {tagToDelete?.repositoryCount || 0} associated repositories. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tagToDelete && deleteTagMutation.mutate(tagToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
