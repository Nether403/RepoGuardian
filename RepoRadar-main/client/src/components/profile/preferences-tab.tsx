import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle,
  Check,
  X,
  Settings,
  Sparkles,
  Mail,
  Star,
  Code,
  Tag,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { UpgradePrompt } from "@/components/upgrade-prompt";

interface UserPreference {
  id: number;
  userId: string;
  preferredLanguages: string[];
  preferredTopics: string[];
  excludedTopics: string[];
  minStars: number;
  maxAge: string;
  aiRecommendations: boolean;
  emailNotifications: boolean;
  updatedAt: string;
}

interface PreferencesTabProps {
  className?: string;
}

// Popular programming languages
const POPULAR_LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust",
  "Ruby", "PHP", "Swift", "Kotlin", "Dart", "Scala", "R", "Perl",
  "Haskell", "Elixir", "Clojure", "Lua", "Shell", "PowerShell",
  "Objective-C", "C", "Assembly", "MATLAB", "Julia", "Groovy",
  "F#", "Erlang", "OCaml", "Nim", "Crystal", "Zig", "V",
  "Solidity", "Move", "Cairo", "Vyper", "WebAssembly", "COBOL",
  "Fortran", "Ada", "Pascal", "Prolog", "Scheme", "Racket",
  "Common Lisp", "Smalltalk", "Tcl", "Verilog", "VHDL"
];

export function PreferencesTab({ className }: PreferencesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state for form
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>([]);
  const [preferredTopics, setPreferredTopics] = useState<string[]>([]);
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [minStars, setMinStars] = useState<number>(0);
  const [aiRecommendations, setAiRecommendations] = useState<boolean>(true);
  const [emailNotifications, setEmailNotifications] = useState<boolean>(false);
  
  // Input states for adding new items
  const [languageInput, setLanguageInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [excludedTopicInput, setExcludedTopicInput] = useState("");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch preferences
  const { 
    data: preferences, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery<UserPreference>({
    queryKey: ["/api/user/preferences"],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Update local state when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setPreferredLanguages(preferences.preferredLanguages || []);
      setPreferredTopics(preferences.preferredTopics || []);
      setExcludedTopics(preferences.excludedTopics || []);
      setMinStars(preferences.minStars || 0);
      setAiRecommendations(preferences.aiRecommendations ?? true);
      setEmailNotifications(preferences.emailNotifications ?? false);
      setHasChanges(false);
    }
  }, [preferences]);

  // Track changes
  useEffect(() => {
    if (preferences) {
      const changed = 
        JSON.stringify(preferredLanguages) !== JSON.stringify(preferences.preferredLanguages) ||
        JSON.stringify(preferredTopics) !== JSON.stringify(preferences.preferredTopics) ||
        JSON.stringify(excludedTopics) !== JSON.stringify(preferences.excludedTopics) ||
        minStars !== preferences.minStars ||
        aiRecommendations !== preferences.aiRecommendations ||
        emailNotifications !== preferences.emailNotifications;
      setHasChanges(changed);
    }
  }, [preferences, preferredLanguages, preferredTopics, excludedTopics, minStars, aiRecommendations, emailNotifications]);

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<UserPreference>) => {
      return await apiRequest("PUT", "/api/user/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] }); // Invalidate recommendations cache
      setHasChanges(false);
      toast({
        title: "Preferences saved",
        description: "Your AI preferences have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save preferences",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle save
  const handleSave = () => {
    savePreferencesMutation.mutate({
      preferredLanguages,
      preferredTopics,
      excludedTopics,
      minStars,
      aiRecommendations,
      emailNotifications,
    });
  };

  // Language management
  const addLanguage = (language: string) => {
    if (language && !preferredLanguages.includes(language)) {
      setPreferredLanguages([...preferredLanguages, language]);
      setLanguageInput("");
      setShowLanguageDropdown(false);
    }
  };

  const removeLanguage = (language: string) => {
    setPreferredLanguages(preferredLanguages.filter(l => l !== language));
  };

  // Topic management
  const addTopic = (topic: string) => {
    if (topic && !preferredTopics.includes(topic)) {
      setPreferredTopics([...preferredTopics, topic]);
      setTopicInput("");
    }
  };

  const removeTopic = (topic: string) => {
    setPreferredTopics(preferredTopics.filter(t => t !== topic));
  };

  // Excluded topic management
  const addExcludedTopic = (topic: string) => {
    if (topic && !excludedTopics.includes(topic)) {
      setExcludedTopics([...excludedTopics, topic]);
      setExcludedTopicInput("");
    }
  };

  const removeExcludedTopic = (topic: string) => {
    setExcludedTopics(excludedTopics.filter(t => t !== topic));
  };

  // Filter languages for dropdown
  const filteredLanguages = POPULAR_LANGUAGES.filter(lang =>
    lang.toLowerCase().includes(languageInput.toLowerCase()) &&
    !preferredLanguages.includes(lang)
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - check if it's a 403 (tier restriction)
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : "";
    const is403Error = errorMessage.includes("403") || errorMessage.includes("FEATURE_NOT_AVAILABLE");
    
    if (is403Error) {
      return <UpgradePrompt feature="preferences" />;
    }
    
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load preferences</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage || "An error occurred while loading your preferences."}
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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>AI Preferences</CardTitle>
          </div>
          <CardDescription>
            Customize your AI recommendations by setting your preferred languages, topics, and notification preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Preferred Languages */}
          <div className="space-y-3">
            <Label htmlFor="languages" className="flex items-center gap-2 text-sm sm:text-base">
              <Code className="h-4 w-4" />
              Preferred Programming Languages
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Select the programming languages you're interested in
            </p>
            <div className="space-y-3">
              {/* Selected languages */}
              {preferredLanguages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <AnimatePresence mode="popLayout">
                    {preferredLanguages.map((language) => (
                      <motion.div
                        key={language}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                      >
                        <Badge variant="secondary" className="gap-1 pr-1 text-xs sm:text-sm">
                          {language}
                          <button
                            onClick={() => removeLanguage(language)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                            aria-label={`Remove ${language}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Language input with dropdown */}
              <div className="relative">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="languages"
                    placeholder="Type to search languages..."
                    value={languageInput}
                    onChange={(e) => {
                      setLanguageInput(e.target.value);
                      setShowLanguageDropdown(true);
                    }}
                    onFocus={() => setShowLanguageDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && languageInput) {
                        e.preventDefault();
                        addLanguage(languageInput);
                      }
                    }}
                    className="flex-1 min-h-[44px]"
                  />
                  <Button
                    type="button"
                    onClick={() => addLanguage(languageInput)}
                    disabled={!languageInput}
                    size="sm"
                    className="min-h-[44px] w-full sm:w-auto"
                  >
                    Add
                  </Button>
                </div>
                
                {/* Dropdown */}
                {showLanguageDropdown && filteredLanguages.length > 0 && (
                  <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                    <CardContent className="p-2">
                      {filteredLanguages.slice(0, 10).map((language) => (
                        <button
                          key={language}
                          onClick={() => addLanguage(language)}
                          className="w-full text-left px-3 py-3 hover:bg-accent rounded-md text-sm min-h-[44px]"
                        >
                          {language}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>

          {/* Preferred Topics */}
          <div className="space-y-3">
            <Label htmlFor="topics" className="flex items-center gap-2 text-sm sm:text-base">
              <Tag className="h-4 w-4" />
              Preferred Topics
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Add topics or keywords you're interested in (e.g., "machine learning", "web development")
            </p>
            <div className="space-y-3">
              {/* Selected topics */}
              {preferredTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <AnimatePresence mode="popLayout">
                    {preferredTopics.map((topic) => (
                      <motion.div
                        key={topic}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                      >
                        <Badge variant="default" className="gap-1 pr-1 text-xs sm:text-sm">
                          {topic}
                          <button
                            onClick={() => removeTopic(topic)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                            aria-label={`Remove ${topic}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Topic input */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="topics"
                  placeholder="Enter a topic..."
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && topicInput) {
                      e.preventDefault();
                      addTopic(topicInput);
                    }
                  }}
                  className="flex-1 min-h-[44px]"
                />
                <Button
                  type="button"
                  onClick={() => addTopic(topicInput)}
                  disabled={!topicInput}
                  size="sm"
                  className="min-h-[44px] w-full sm:w-auto"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Excluded Topics */}
          <div className="space-y-3">
            <Label htmlFor="excluded-topics" className="flex items-center gap-2 text-sm sm:text-base">
              <XCircle className="h-4 w-4" />
              Excluded Topics
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Add topics you want to exclude from recommendations
            </p>
            <div className="space-y-3">
              {/* Selected excluded topics */}
              {excludedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <AnimatePresence mode="popLayout">
                    {excludedTopics.map((topic) => (
                      <motion.div
                        key={topic}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                      >
                        <Badge variant="destructive" className="gap-1 pr-1 text-xs sm:text-sm">
                          {topic}
                          <button
                            onClick={() => removeExcludedTopic(topic)}
                            className="ml-1 hover:bg-background/20 rounded-full p-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                            aria-label={`Remove ${topic}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Excluded topic input */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="excluded-topics"
                  placeholder="Enter a topic to exclude..."
                  value={excludedTopicInput}
                  onChange={(e) => setExcludedTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && excludedTopicInput) {
                      e.preventDefault();
                      addExcludedTopic(excludedTopicInput);
                    }
                  }}
                  className="flex-1 min-h-[44px]"
                />
                <Button
                  type="button"
                  onClick={() => addExcludedTopic(excludedTopicInput)}
                  disabled={!excludedTopicInput}
                  size="sm"
                  className="min-h-[44px] w-full sm:w-auto"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Minimum Stars */}
          <div className="space-y-3">
            <Label htmlFor="min-stars" className="flex items-center gap-2 text-sm sm:text-base">
              <Star className="h-4 w-4" />
              Minimum Stars
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Only recommend repositories with at least this many stars (0-1,000,000)
            </p>
            <Input
              id="min-stars"
              type="number"
              min={0}
              max={1000000}
              value={minStars}
              onChange={(e) => setMinStars(Math.max(0, Math.min(1000000, parseInt(e.target.value) || 0)))}
              className="w-full sm:max-w-xs min-h-[44px]"
            />
          </div>

          {/* AI Recommendations Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="ai-recommendations" className="flex items-center gap-2 cursor-pointer">
                <Sparkles className="h-4 w-4" />
                AI Recommendations
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable personalized repository recommendations based on your activity
              </p>
            </div>
            <Switch
              id="ai-recommendations"
              checked={aiRecommendations}
              onCheckedChange={setAiRecommendations}
            />
          </div>

          {/* Email Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="email-notifications" className="flex items-center gap-2 cursor-pointer">
                <Mail className="h-4 w-4" />
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive email alerts for new recommendations and updates
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          {/* Save Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {hasChanges ? (
                <span className="text-amber-600 dark:text-amber-400">You have unsaved changes</span>
              ) : (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  All changes saved
                </span>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || savePreferencesMutation.isPending}
              className="w-full sm:w-auto sm:min-w-32 min-h-[44px]"
            >
              {savePreferencesMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
