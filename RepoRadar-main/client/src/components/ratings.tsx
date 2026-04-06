import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, ThumbsUp, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface RatingsProps {
  repositoryId: string;
}

export function Ratings({ repositoryId }: RatingsProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);

  // Fetch ratings
  const { data: ratingsData, isLoading } = useQuery<any>({
    queryKey: [`/api/repositories/${repositoryId}/ratings`],
  });

  const ratings = ratingsData?.ratings || [];
  const averageRating = ratingsData?.average || 0;
  const totalCount = ratingsData?.count || 0;

  // Check if user has already rated
  const userRating = ratings.find((r: any) => r.userId === user?.id);

  // Add/Update rating mutation
  const submitRatingMutation = useMutation({
    mutationFn: async ({ rating, review }: { rating: number; review: string }) => {
      return await apiRequest("POST", `/api/repositories/${repositoryId}/ratings`, {
        rating,
        review,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/repositories/${repositoryId}/ratings`] });
      setShowRatingForm(false);
      setRating(0);
      setReview("");
      toast({
        title: userRating ? "Rating updated" : "Rating submitted",
        description: "Your rating has been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit rating",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete rating mutation
  const deleteRatingMutation = useMutation({
    mutationFn: async (ratingId: number) => {
      return await apiRequest("DELETE", `/api/ratings/${ratingId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/repositories/${repositoryId}/ratings`] });
      toast({
        title: "Rating deleted",
        description: "Your rating has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete rating",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark rating as helpful mutation
  const markHelpfulMutation = useMutation({
    mutationFn: async (ratingId: number) => {
      return await apiRequest("POST", `/api/ratings/${ratingId}/helpful`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/repositories/${repositoryId}/ratings`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark as helpful",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitRating = () => {
    if (rating > 0) {
      submitRatingMutation.mutate({ rating, review });
    }
  };

  const startEditingRating = () => {
    if (userRating) {
      setRating(userRating.rating);
      setReview(userRating.review || "");
      setShowRatingForm(true);
    }
  };

  const renderStars = (value: number, interactive = false, size = "h-5 w-5") => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= (interactive ? hoveredStar || value : value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-400"
            } ${interactive ? "cursor-pointer transition-colors" : ""}`}
            onClick={interactive ? () => setRating(star) : undefined}
            onMouseEnter={interactive ? () => setHoveredStar(star) : undefined}
            onMouseLeave={interactive ? () => setHoveredStar(0) : undefined}
            data-testid={interactive ? `star-rating-${star}` : undefined}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-24 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Star className="h-5 w-5" />
          Ratings & Reviews
        </h3>
      </div>

      {/* Average Rating Display */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold">{averageRating.toFixed(1)}</div>
            <div>
              {renderStars(Math.round(averageRating))}
              <p className="text-sm text-muted-foreground mt-1">
                Based on {totalCount} {totalCount === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
          {isAuthenticated && !userRating && !showRatingForm && (
            <Button
              onClick={() => setShowRatingForm(true)}
              className="flex items-center gap-2"
              data-testid="button-add-rating"
            >
              <Star className="h-4 w-4" />
              Add Rating
            </Button>
          )}
          {isAuthenticated && userRating && !showRatingForm && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={startEditingRating}
                className="flex items-center gap-2"
                data-testid="button-edit-rating"
              >
                <Edit2 className="h-4 w-4" />
                Edit Your Rating
              </Button>
              <Button
                variant="outline"
                onClick={() => deleteRatingMutation.mutate(userRating.id)}
                disabled={deleteRatingMutation.isPending}
                className="flex items-center gap-2"
                data-testid="button-delete-rating"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Rating Form */}
      {showRatingForm && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4">
            {userRating ? "Edit Your Rating" : "Rate This Repository"}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Rating</label>
              {renderStars(rating, true, "h-8 w-8")}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Your Review (Optional)</label>
              <Textarea
                placeholder="Share your experience with this repository..."
                value={review}
                onChange={(e) => setReview(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-review"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmitRating}
                disabled={rating === 0 || submitRatingMutation.isPending}
                data-testid="button-submit-rating"
              >
                {submitRatingMutation.isPending 
                  ? "Submitting..." 
                  : userRating 
                  ? "Update Rating" 
                  : "Submit Rating"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRatingForm(false);
                  setRating(0);
                  setReview("");
                }}
                data-testid="button-cancel-rating"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Ratings List */}
      <div className="space-y-4">
        {ratings.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No ratings yet. Be the first to rate this repository!</p>
          </Card>
        ) : (
          ratings.map((rating: any) => (
            <Card key={rating.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={rating.user?.profileImageUrl} />
                  <AvatarFallback>
                    {rating.user?.firstName?.[0] || rating.user?.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">
                        {rating.user?.firstName && rating.user?.lastName
                          ? `${rating.user.firstName} ${rating.user.lastName}`
                          : rating.user?.email?.split("@")[0] || "Anonymous"}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {renderStars(rating.rating)}
                  </div>
                  {rating.review && (
                    <p className="mt-2 text-sm">{rating.review}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 h-auto p-1"
                      onClick={() => markHelpfulMutation.mutate(rating.id)}
                      disabled={!isAuthenticated || markHelpfulMutation.isPending}
                      data-testid={`button-helpful-${rating.id}`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span className="text-sm">
                        Helpful ({rating.helpfulCount || 0})
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}