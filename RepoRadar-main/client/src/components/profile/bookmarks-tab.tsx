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
  Bookmark, 
  Trash2, 
  Star, 
  GitFork, 
  Calendar,
  AlertCircle,
  BookmarkX
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { UpgradePrompt } from "@/components/upgrade-prompt";

interface BookmarkWithRepository {
  id: number;
  userId: string;
  repositoryId: string;
  notes?: string;
  createdAt: string;
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
}

interface BookmarksTabProps {
  className?: string;
}

const ITEMS_PER_PAGE = 20;

export function BookmarksTab({ className }: BookmarksTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch bookmarks with pagination
  const { 
    data: bookmarksResponse, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery<{
    data: BookmarkWithRepository[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: ["/api/bookmarks", { page: currentPage, limit: ITEMS_PER_PAGE }],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const bookmarks = bookmarksResponse?.data || [];
  const pagination = bookmarksResponse?.pagination;

  // Remove bookmark mutation
  const removeBookmarkMutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      await apiRequest("DELETE", `/api/bookmarks/${repositoryId}`);
    },
    onMutate: async (repositoryId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/bookmarks", { page: currentPage, limit: ITEMS_PER_PAGE }] });
      
      // Snapshot previous value
      const previousBookmarks = queryClient.getQueryData(["/api/bookmarks", { page: currentPage, limit: ITEMS_PER_PAGE }]);
      
      // Optimistically update
      queryClient.setQueryData(["/api/bookmarks", { page: currentPage, limit: ITEMS_PER_PAGE }], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((b: BookmarkWithRepository) => b.repositoryId !== repositoryId),
          pagination: {
            ...old.pagination,
            total: old.pagination.total - 1,
          },
        };
      });
      
      return { previousBookmarks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({
        title: "Bookmark removed",
        description: "Repository has been removed from your bookmarks.",
      });
    },
    onError: (error: any, _, context) => {
      // Rollback on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(["/api/bookmarks", { page: currentPage, limit: ITEMS_PER_PAGE }], context.previousBookmarks);
      }
      toast({
        title: "Failed to remove bookmark",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Use server-side pagination
  const totalPages = pagination?.totalPages || 1;
  const paginatedBookmarks = bookmarks; // Already paginated from server

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
                <Skeleton className="h-9 w-9 rounded-md" />
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
      return <UpgradePrompt feature="bookmarks" />;
    }
    
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load bookmarks</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage || "An error occurred while loading your bookmarks."}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (bookmarks.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-12 text-center">
          <div className="mb-6">
            <BookmarkX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No bookmarks yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start bookmarking repositories to quickly access them later. 
              Click the bookmark icon on any repository card to add it to your collection.
            </p>
          </div>
          <Link href="/">
            <Button>
              Discover Repositories
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Bookmarks count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {bookmarks.length} {bookmarks.length === 1 ? "Bookmark" : "Bookmarks"}
          </h3>
        </div>
        {totalPages > 1 && (
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        )}
      </div>

      {/* Bookmarks list */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {paginatedBookmarks.map((bookmark, index) => (
            <motion.div
              key={bookmark.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.05 }}
              layout
            >
              <Link href={`/repository/${bookmark.repositoryId}`}>
                <Card className="group hover:border-primary/50 transition-all duration-200 cursor-pointer overflow-hidden">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      {/* Repository icon */}
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <i className="fab fa-github text-white text-xl"></i>
                      </div>

                      {/* Repository details */}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-base sm:text-lg truncate group-hover:text-primary transition-colors">
                              {bookmark.repository.name}
                            </h4>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {bookmark.repository.fullName}
                            </p>
                          </div>
                          {/* Remove button - mobile positioned */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeBookmarkMutation.mutate(bookmark.repositoryId);
                            }}
                            disabled={removeBookmarkMutation.isPending}
                            className="flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-w-[44px] min-h-[44px]"
                            aria-label="Remove bookmark"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Description */}
                        {bookmark.repository.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3">
                            {bookmark.repository.description}
                          </p>
                        )}

                        {/* Notes */}
                        {bookmark.notes && (
                          <div className="mb-3 p-2 sm:p-3 bg-muted/50 rounded-md border border-border/50">
                            <p className="text-xs sm:text-sm italic text-muted-foreground">
                              "{bookmark.notes}"
                            </p>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center gap-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span>{bookmark.repository.stars?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0">
                            <GitFork className="h-4 w-4 text-blue-400" />
                            <span>{bookmark.repository.forks?.toLocaleString() || 0}</span>
                          </div>
                          {bookmark.repository.language && (
                            <Badge variant="secondary" className="text-xs">
                              {bookmark.repository.language}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 w-full sm:w-auto sm:ml-auto">
                            <Calendar className="h-4 w-4" />
                            <span className="text-xs">
                              Bookmarked {new Date(bookmark.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1;
              // Show first, last, current, and adjacent pages
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-9"
                  >
                    {page}
                  </Button>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <span key={page} className="px-2 text-muted-foreground">
                    ...
                  </span>
                );
              }
              return null;
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
