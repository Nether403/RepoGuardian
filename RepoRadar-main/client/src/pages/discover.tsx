import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import RepositoryCard from "@/components/repository-card";
import RepositoryListItem from "@/components/repository-list-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Grid3x3, List, Filter, Star, Calendar, Code } from "lucide-react";

export default function Discover() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [functionality, setFunctionality] = useState("");
  const [useCase, setUseCase] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [similarRepos, setSimilarRepos] = useState<any[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [availableTags, setAvailableTags] = useState([
    "React", "Vue.js", "Angular", "Next.js", "Svelte",
    "Node.js", "Express", "FastAPI", "Django", "Flask",
    "PostgreSQL", "MongoDB", "MySQL", "Redis", "GraphQL",
    "TypeScript", "JavaScript", "Python", "Go", "Rust",
    "Docker", "Kubernetes", "AWS", "GCP", "Azure",
    "TailwindCSS", "Material-UI", "REST API", "WebSocket", "OAuth",
    "Machine Learning", "AI", "Blockchain", "Web3", "NFT",
    "E-commerce", "CMS", "Chat", "Video", "Analytics"
  ]);
  
  // New state for advanced filters
  const [minStars, setMinStars] = useState<number>(0);
  const [maxAge, setMaxAge] = useState<string>("any");
  const [maxResults, setMaxResults] = useState<number>(20);
  const [viewMode, setViewMode] = useState<"tiles" | "list">("tiles");
  const [autoViewMode, setAutoViewMode] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [filteredRepos, setFilteredRepos] = useState<any[]>([]);
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [filterMinStars, setFilterMinStars] = useState<number>(0);



  const findSimilarMutation = useMutation({
    mutationFn: async (params: any) => {
      const response = await apiRequest('POST', '/api/repositories/find-similar', params);
      return response;
    },
    onSuccess: (data: any) => {
      const repos = data.similar || [];
      setSimilarRepos(repos);
      setFilteredRepos(repos);
      setReasoning(data.reasoning || "");
      
      // Auto-switch to list view if more than 10 results and auto mode is on
      if (autoViewMode && repos.length > 10) {
        setViewMode("list");
      }
      
      toast({
        title: "Similar Repositories Found",
        description: `Found ${repos.length} similar repositories based on your criteria.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Search Failed",
        description: error.message || "Failed to find similar repositories.",
        variant: "destructive",
      });
    },
  });

  const handleFunctionalitySearch = () => {
    // No mandatory fields - allow search with any combination
    if (!functionality && !useCase && technologies.trim().length === 0) {
      toast({
        title: "Missing Information", 
        description: "Please provide at least one search criteria (functionality, use case, or technologies).",
        variant: "destructive",
      });
      return;
    }

    const techArray = technologies
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    findSimilarMutation.mutate({
      functionality: functionality.trim() || undefined,
      useCase: useCase.trim() || undefined,
      technologies: techArray.length > 0 ? techArray : undefined,
      minStars,
      maxAge,
      maxResults
    });
  };
  
  // Apply filters to results
  useEffect(() => {
    let filtered = [...similarRepos];
    
    // Filter by language
    if (filterLanguage !== "all") {
      filtered = filtered.filter(item => 
        item.repository?.language?.toLowerCase() === filterLanguage.toLowerCase()
      );
    }
    
    // Filter by minimum stars
    if (filterMinStars > 0) {
      filtered = filtered.filter(item => 
        (item.repository?.stars || 0) >= filterMinStars
      );
    }
    
    setFilteredRepos(filtered);
  }, [similarRepos, filterLanguage, filterMinStars]);
  
  // Get unique languages from results
  const getUniqueLanguages = () => {
    const languages = new Set<string>();
    similarRepos.forEach(item => {
      if (item.repository?.language) {
        languages.add(item.repository.language);
      }
    });
    return Array.from(languages).sort();
  };

  const handleRepositorySearchWithUrl = async (url: string) => {
    if (!url) return;

    try {
      // Show loading toast
      toast({
        title: "Analyzing Repository",
        description: "Finding similar repositories based on functionality...",
      });

      // First, analyze the repository if not already in our system
      const analyzeResponse: any = await apiRequest('POST', '/api/repositories/analyze', { url });
      
      if (analyzeResponse?.repository?.id) {
        findSimilarMutation.mutate({
          repositoryId: analyzeResponse.repository.id,
          functionality,
          useCase,
          maxResults
        });
      } else {
        throw new Error("Could not analyze repository");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze the repository. Please check the URL and try again.",
        variant: "destructive",
      });
    }
  };

  const handleRepositorySearch = () => {
    if (!repositoryUrl) {
      toast({
        title: "Missing URL",
        description: "Please provide a repository URL.",
        variant: "destructive",
      });
      return;
    }

    handleRepositorySearchWithUrl(repositoryUrl);
  };

  const handleTagClick = (tag: string) => {
    // Add tag to technologies input
    const currentTechs = technologies.split(',').map(t => t.trim()).filter(t => t);
    if (!currentTechs.includes(tag)) {
      const newTechs = [...currentTechs, tag].join(', ');
      setTechnologies(newTechs);
    }
    
    // Remove tag from available tags with animation
    setAvailableTags(prev => prev.filter(t => t !== tag));
  };

  // Check if repo was passed as query parameter and auto-search
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repoId = params.get('repoId');
    const repoUrl = params.get('repoUrl');
    
    if (repoId && repoUrl) {
      // Repository is already analyzed, use the ID directly
      setRepositoryUrl(decodeURIComponent(repoUrl));
      
      // Directly search using the repository ID
      setTimeout(() => {
        toast({
          title: "Finding Similar Repositories",
          description: "Searching for repositories with similar functionality...",
        });
        
        findSimilarMutation.mutate({
          repositoryId: repoId,
          functionality: "",
          useCase: "",
          maxResults
        });
      }, 100);
    } else if (params.get('repo')) {
      // Legacy support for just URL parameter
      const repoParam = params.get('repo');
      if (repoParam && repoParam !== repositoryUrl) {
        setRepositoryUrl(repoParam);
        setTimeout(() => {
          handleRepositorySearchWithUrl(repoParam);
        }, 100);
      }
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-dark text-white">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8 pt-32">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold gradient-text mb-4">Discover Similar Repositories</h1>
          <p className="text-xl text-gray-400">Find repositories that match your functionality needs and use cases</p>
        </div>

        <Tabs defaultValue="functionality" className="mb-8">
          <TabsList className="grid w-full grid-cols-2 bg-card">
            <TabsTrigger value="functionality">Search by Functionality</TabsTrigger>
            <TabsTrigger value="repository">Find Similar to Repository</TabsTrigger>
          </TabsList>

          <TabsContent value="functionality">
            <Card className="bg-card border border-border">
              <CardHeader>
                <CardTitle>Describe What You're Looking For</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Core Functionality
                  </label>
                  <Textarea
                    placeholder="Describe the main functionality you need (e.g., 'Real-time chat application with video calling', 'E-commerce platform with inventory management')"
                    value={functionality}
                    onChange={(e) => setFunctionality(e.target.value)}
                    className="bg-dark border border-border min-h-[100px]"
                    data-testid="textarea-functionality"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Use Case</label>
                  <Textarea
                    placeholder="Describe your specific use case (e.g., 'Building a marketplace for handmade crafts', 'Creating an internal tool for team collaboration')"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    className="bg-dark border border-border min-h-[80px]"
                    data-testid="textarea-usecase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Technologies (comma-separated)</label>
                  <Input
                    type="text"
                    placeholder="React, Node.js, PostgreSQL, GraphQL..."
                    value={technologies}
                    onChange={(e) => setTechnologies(e.target.value)}
                    className="bg-dark border border-border"
                    data-testid="input-technologies"
                  />
                  
                  {/* Clickable Technology Tags */}
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-2">Click to add popular technologies:</p>
                    <div className="flex flex-wrap gap-2">
                      <AnimatePresence mode="popLayout">
                        {availableTags.map((tag) => (
                          <motion.div
                            key={tag}
                            layout
                            initial={{ opacity: 1, scale: 1 }}
                            exit={{ 
                              opacity: 0, 
                              scale: 0.5,
                              filter: "blur(4px)",
                              transition: { 
                                duration: 0.3,
                                ease: "easeOut"
                              }
                            }}
                            whileHover={{ 
                              scale: 1.05,
                              boxShadow: "0 0 20px rgba(255, 107, 53, 0.3)"
                            }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Badge
                              variant="outline"
                              className="cursor-pointer border-[#FF6B35]/30 hover:border-[#FF6B35] hover:bg-[#FF6B35]/10 transition-all duration-200 flex items-center gap-1"
                              onClick={() => handleTagClick(tag)}
                              data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <Plus className="w-3 h-3" />
                              {tag}
                            </Badge>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="space-y-4 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-gray-400">Advanced Filters</h4>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Minimum Stars: {minStars.toLocaleString()}
                    </label>
                    <Slider
                      value={[minStars]}
                      onValueChange={(value) => setMinStars(value[0])}
                      max={10000}
                      step={100}
                      className="w-full"
                      data-testid="slider-min-stars"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>5,000</span>
                      <span>10,000+</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Repository Age</label>
                    <Select value={maxAge} onValueChange={setMaxAge}>
                      <SelectTrigger className="bg-dark border border-border" data-testid="select-age">
                        <SelectValue placeholder="Any age" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any age</SelectItem>
                        <SelectItem value="1month">Last month</SelectItem>
                        <SelectItem value="3months">Last 3 months</SelectItem>
                        <SelectItem value="6months">Last 6 months</SelectItem>
                        <SelectItem value="1year">Last year</SelectItem>
                        <SelectItem value="2years">Last 2 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Max Results: {maxResults}
                    </label>
                    <Slider
                      value={[maxResults]}
                      onValueChange={(value) => setMaxResults(value[0])}
                      min={5}
                      max={100}
                      step={5}
                      className="w-full"
                      data-testid="slider-max-results"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>5</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleFunctionalitySearch}
                  disabled={findSimilarMutation.isPending}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
                  data-testid="button-search-functionality"
                >
                  {findSimilarMutation.isPending ? "Searching..." : "Find Similar Repositories"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repository">
            <Card className="bg-card border border-border">
              <CardHeader>
                <CardTitle>Find Repositories Similar To</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Repository URL
                  </label>
                  <Input
                    type="text"
                    placeholder="https://github.com/owner/repository"
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    className="bg-dark border border-border"
                    data-testid="input-repository-url"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Additional Context (Optional)
                  </label>
                  <Textarea
                    placeholder="Add any specific aspects you want to match (e.g., 'Focus on repositories with similar API design' or 'Find alternatives with better performance')"
                    value={functionality}
                    onChange={(e) => setFunctionality(e.target.value)}
                    className="bg-dark border border-border min-h-[80px]"
                    data-testid="textarea-context"
                  />
                </div>

                <Button
                  onClick={handleRepositorySearch}
                  disabled={findSimilarMutation.isPending}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
                  data-testid="button-search-repository"
                >
                  {findSimilarMutation.isPending ? "Searching..." : "Find Similar Repositories"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reasoning Section */}
        {reasoning && (
          <Card className="bg-card/50 border border-border mb-8">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <i className="fas fa-lightbulb text-yellow-400 mr-2"></i>
                Why These Repositories Match
              </h3>
              <p className="text-gray-300 whitespace-pre-line">{reasoning}</p>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {similarRepos.length > 0 && (
          <div className="space-y-6">
            {/* Results Header with Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Similar Repositories ({filteredRepos.length})
                </h2>
                {filteredRepos.length < similarRepos.length && (
                  <p className="text-sm text-gray-400 mt-1">
                    Showing {filteredRepos.length} of {similarRepos.length} repositories after filtering
                  </p>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 bg-card rounded-lg p-1">
                  <Button
                    size="sm"
                    variant={viewMode === "tiles" ? "default" : "ghost"}
                    onClick={() => setViewMode("tiles")}
                    className="flex items-center gap-1"
                    data-testid="button-view-tiles"
                  >
                    <Grid3x3 className="w-4 h-4" />
                    Tiles
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    onClick={() => setViewMode("list")}
                    className="flex items-center gap-1"
                    data-testid="button-view-list"
                  >
                    <List className="w-4 h-4" />
                    List
                  </Button>
                </div>
                
                {/* Auto Switch Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={autoViewMode}
                    onCheckedChange={setAutoViewMode}
                    id="auto-view-mode"
                  />
                  <Label htmlFor="auto-view-mode" className="text-sm">
                    Auto-switch view
                  </Label>
                </div>
                
                {/* Filter Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1"
                  data-testid="button-toggle-filters"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {(filterLanguage !== "all" || filterMinStars > 0) && (
                    <Badge variant="secondary" className="ml-1">Active</Badge>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Filter Controls */}
            {showFilters && (
              <Card className="bg-card/50 border border-border p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm mb-2">Language</Label>
                    <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                      <SelectTrigger className="bg-dark border border-border" data-testid="select-filter-language">
                        <SelectValue placeholder="All languages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All languages</SelectItem>
                        {getUniqueLanguages().map(lang => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm mb-2">
                      Minimum Stars: {filterMinStars.toLocaleString()}
                    </Label>
                    <Slider
                      value={[filterMinStars]}
                      onValueChange={(value) => setFilterMinStars(value[0])}
                      max={Math.max(...similarRepos.map(r => r.repository?.stars || 0))}
                      step={100}
                      className="w-full"
                      data-testid="slider-filter-stars"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setFilterLanguage("all");
                        setFilterMinStars(0);
                      }}
                      className="w-full"
                      data-testid="button-clear-filters"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            
            {/* Results Display */}
            {viewMode === "tiles" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRepos.map((item: any, index: number) => (
                  <div key={item.repository?.id || index} className="relative">
                    {item.similarity && (
                      <div className="absolute top-4 right-4 z-10">
                        <Badge 
                          className={`
                            ${item.similarity >= 80 ? 'bg-green-600' : 
                              item.similarity >= 60 ? 'bg-yellow-600' : 'bg-orange-600'}
                            text-white font-bold
                          `}
                        >
                          {item.similarity}% Match
                        </Badge>
                      </div>
                    )}
                    <RepositoryCard
                      repository={item.repository}
                      showAnalysis={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRepos.map((item: any, index: number) => (
                  <RepositoryListItem
                    key={item.repository?.id || index}
                    repository={item.repository}
                    similarity={item.similarity}
                    index={index}
                    onAnalyze={() => {
                      window.location.href = `/analyze?url=${encodeURIComponent(item.repository.htmlUrl)}`;
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!findSimilarMutation.isPending && similarRepos.length === 0 && !reasoning && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-search text-white text-3xl"></i>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Start Your Discovery</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Describe the functionality you need or provide a repository URL to find similar projects that match your requirements.
            </p>
          </div>
        )}

        {/* Loading State */}
        {findSimilarMutation.isPending && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-400">Analyzing repositories and finding matches...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}