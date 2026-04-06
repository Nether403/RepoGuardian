import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Brain, Bookmark, FolderOpen, Tag, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface UpgradePromptProps {
  feature?: 'bookmarks' | 'tags' | 'preferences' | 'recommendations' | 'all';
  compact?: boolean;
}

const featureDetails = {
  bookmarks: {
    icon: Bookmark,
    title: "Smart Bookmarks",
    description: "Save and organize repositories with notes and tags for quick access",
  },
  tags: {
    icon: Tag,
    title: "Custom Tags",
    description: "Categorize repositories with custom colored tags and organize your workflow",
  },
  preferences: {
    icon: Sparkles,
    title: "AI Preferences",
    description: "Set your preferences for personalized AI recommendations and content filtering",
  },
  recommendations: {
    icon: Brain,
    title: "AI Recommendations",
    description: "Get personalized repository suggestions based on your interests and activity",
  },
};

export function UpgradePrompt({ feature = 'all', compact = false }: UpgradePromptProps) {
  if (compact) {
    const details = feature !== 'all' ? featureDetails[feature] : null;
    const Icon = details?.icon || Lock;
    
    return (
      <Card className="border-2 border-primary/20">
        <CardContent className="p-6 text-center">
          <Icon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {details?.title || 'Premium Feature'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {details?.description || 'This feature is available for Pro and Enterprise users'}
          </p>
          <Link href="/pricing">
            <Button className="gap-2">
              <Crown className="w-4 h-4" />
              Upgrade to Pro
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="text-center">
        <div className="mb-4">
          <Lock className="w-16 h-16 mx-auto text-muted-foreground" />
        </div>
        <CardTitle className="text-2xl">Unlock Intelligent Profile Features</CardTitle>
        <CardDescription className="text-lg mt-2">
          Upgrade to Pro or Enterprise to access AI-powered organization and discovery tools
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-6 text-center text-muted-foreground">
          Intelligent Profile features help you organize, track, and discover repositories tailored to your interests and workflow.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <Brain className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">AI Recommendations</h3>
            <p className="text-sm text-muted-foreground">
              Get personalized repository suggestions based on your activity, preferences, and interests
            </p>
          </div>
          
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <Bookmark className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Smart Bookmarks</h3>
            <p className="text-sm text-muted-foreground">
              Save repositories for quick access with optional notes and organize them with tags
            </p>
          </div>
          
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <Tag className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Custom Tags</h3>
            <p className="text-sm text-muted-foreground">
              Create custom colored tags to categorize and filter repositories by your own system
            </p>
          </div>
          
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <Sparkles className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">AI Preferences</h3>
            <p className="text-sm text-muted-foreground">
              Set your preferred languages, topics, and filters to personalize your experience
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/pricing">
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              <Crown className="w-5 h-5" />
              Upgrade to Pro
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Compare Plans
            </Button>
          </Link>
        </div>
        
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-center text-muted-foreground">
            <strong>Pro Plan:</strong> $9.99/month • All intelligent profile features • Priority support
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
