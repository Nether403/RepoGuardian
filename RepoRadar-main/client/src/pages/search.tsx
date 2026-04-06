import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { PageWithBackground } from "@/components/layout/PageWithBackground";
import RepositoryCard from "@/components/repository-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Filter, Search as SearchIcon, Star, Calendar, Code, TrendingUp } from "lucide-react";
import { LoadingSkeleton } from "@/components/skeleton-loader";
import { ContentTransition } from "@/components/content-transition";
import { trackSearch, trackPageView } from "@/lib/analytics";
import { useEffect } from "react";

interface SearchFilters {
  language: string;
  minStars: number;
  maxStars: number;
  dateRange: string;
  sortBy: string;
  includeArchived: boolean;
  includeForked: boolean;
  hasIssues: boolean;
  license: string;
  topics: string[];
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<SearchFilters>({
    language: 'all',
    minStars: 0,
    maxStars: 100000,
    dateRange: 'all',
    sortBy: 'best-match',
    includeArchived: false,
    includeForked: false,
    hasIssues: false,
    license: 'all',
    topics: []
  });
  const [topicInput, setTopicInput] = useState("");

  // Track page view
  useEffect(() => {
    trackPageView('/search');
  }, []);

  const buildSearchQuery = () => {
    let searchQuery = searchTerm;
    
    // Add language filter
    if (filters.language !== 'all') {
      searchQuery += ` language:${filters.language}`;
    }
    
    // Add star range
    if (filters.minStars > 0) {
      searchQuery += ` stars:>=${filters.minStars}`;
    }
    if (filters.maxStars < 100000) {
      searchQuery += ` stars:<=${filters.maxStars}`;
    }
    
    // Add date filter
    if (filters.dateRange !== 'all') {
      const date = new Date();
      switch (filters.dateRange) {
        case 'today':
          date.setDate(date.getDate() - 1);
          break;
        case 'week':
          date.setDate(date.getDate() - 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() - 1);
          break;
        case 'year':
          date.setFullYear(date.getFullYear() - 1);
          break;
      }
      searchQuery += ` created:>=${date.toISOString().split('T')[0]}`;
    }
    
    // Add archived filter
    if (!filters.includeArchived) {
      searchQuery += ' archived:false';
    }
    
    // Add fork filter
    if (!filters.includeForked) {
      searchQuery += ' fork:false';
    }
    
    // Add issues filter
    if (filters.hasIssues) {
      searchQuery += ' has:issues';
    }
    
    // Add license filter
    if (filters.license !== 'all') {
      searchQuery += ` license:${filters.license}`;
    }
    
    // Add topics
    filters.topics.forEach(topic => {
      searchQuery += ` topic:${topic}`;
    });
    
    return searchQuery;
  };

  const { data: searchResults, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/repositories/search', searchTerm, filters],
    queryFn: async () => {
      if (!searchTerm) return [];
      const fullQuery = buildSearchQuery();
      const response = await fetch(`/api/repositories/search?q=${encodeURIComponent(fullQuery)}&sort=${filters.sortBy}`);
      if (!response.ok) throw new Error('Search failed');
      const results = await response.json();
      
      // Track search event
      trackSearch(searchTerm, results.length, {
        filters: filters,
        fullQuery: fullQuery,
      });
      
      return results;
    },
    enabled: !!searchTerm,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query);
  };

  const handleAddTopic = () => {
    if (topicInput && !filters.topics.includes(topicInput)) {
      setFilters(prev => ({
        ...prev,
        topics: [...prev.topics, topicInput]
      }));
      setTopicInput("");
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setFilters(prev => ({
      ...prev,
      topics: prev.topics.filter(t => t !== topic)
    }));
  };

  const resetFilters = () => {
    setFilters({
      language: 'all',
      minStars: 0,
      maxStars: 100000,
      dateRange: 'all',
      sortBy: 'best-match',
      includeArchived: false,
      includeForked: false,
      hasIssues: false,
      license: 'all',
      topics: []
    });
  };

  return (
    <PageWithBackground>
      <Header />
      
      {/* Search Section */}
      <section className="py-8 md:py-12 bg-gradient-to-r from-dark via-card to-dark" aria-label="Search form">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
              Advanced <span className="gradient-text">Repository Search</span>
            </h1>
            <p className="text-base md:text-xl text-gray-300">Discover repositories with powerful filters and sorting</p>
          </div>
          
          <Card className="bg-card/50 border border-border backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1 relative">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      type="text"
                      placeholder="Search repositories by name, description, or topic..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full bg-dark border border-border text-white placeholder-gray-400 pl-10"
                      data-testid="input-search"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary px-6 md:px-8 py-2 rounded-lg font-semibold transition-all duration-300 touch-target w-full sm:w-auto"
                    disabled={!query}
                    data-testid="button-search"
                  >
                    <SearchIcon className="mr-2 w-4 h-4" />
                    Search
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    variant="outline"
                    className="border-border text-gray-300 hover:bg-gray-800 touch-target w-full sm:w-auto"
                  >
                    <Filter className="mr-2 w-4 h-4" />
                    Filters
                    {filtersOpen ? <ChevronUp className="ml-2 w-4 h-4" /> : <ChevronDown className="ml-2 w-4 h-4" />}
                  </Button>
                </div>

                <Collapsible open={filtersOpen}>
                  <CollapsibleContent className="space-y-6 pt-4">
                    {/* First Row of Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Language Filter */}
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-300">
                          <Code className="inline w-4 h-4 mr-1" />
                          Language
                        </Label>
                        <Select value={filters.language} onValueChange={(value) => setFilters(prev => ({ ...prev, language: value }))}>
                          <SelectTrigger className="bg-dark border-border">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent className="bg-dark border-border">
                            <SelectItem value="all">All Languages</SelectItem>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="typescript">TypeScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="java">Java</SelectItem>
                            <SelectItem value="go">Go</SelectItem>
                            <SelectItem value="rust">Rust</SelectItem>
                            <SelectItem value="cpp">C++</SelectItem>
                            <SelectItem value="csharp">C#</SelectItem>
                            <SelectItem value="ruby">Ruby</SelectItem>
                            <SelectItem value="php">PHP</SelectItem>
                            <SelectItem value="swift">Swift</SelectItem>
                            <SelectItem value="kotlin">Kotlin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date Range Filter */}
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-300">
                          <Calendar className="inline w-4 h-4 mr-1" />
                          Created
                        </Label>
                        <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                          <SelectTrigger className="bg-dark border-border">
                            <SelectValue placeholder="Select time range" />
                          </SelectTrigger>
                          <SelectContent className="bg-dark border-border">
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="year">This Year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sort By */}
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-300">
                          <TrendingUp className="inline w-4 h-4 mr-1" />
                          Sort By
                        </Label>
                        <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}>
                          <SelectTrigger className="bg-dark border-border">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent className="bg-dark border-border">
                            <SelectItem value="best-match">Best Match</SelectItem>
                            <SelectItem value="stars">Most Stars</SelectItem>
                            <SelectItem value="forks">Most Forks</SelectItem>
                            <SelectItem value="updated">Recently Updated</SelectItem>
                            <SelectItem value="created">Newest First</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Star Range */}
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-300">
                        <Star className="inline w-4 h-4 mr-1" />
                        Star Range: {filters.minStars.toLocaleString()} - {filters.maxStars < 100000 ? filters.maxStars.toLocaleString() : '100k+'}
                      </Label>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-gray-400 w-20">Min Stars</span>
                          <Slider
                            value={[filters.minStars]}
                            onValueChange={(value) => setFilters(prev => ({ ...prev, minStars: value[0] }))}
                            max={10000}
                            step={100}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={filters.minStars}
                            onChange={(e) => setFilters(prev => ({ ...prev, minStars: parseInt(e.target.value) || 0 }))}
                            className="w-24 bg-dark border-border"
                          />
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-gray-400 w-20">Max Stars</span>
                          <Slider
                            value={[filters.maxStars > 100000 ? 100000 : filters.maxStars]}
                            onValueChange={(value) => setFilters(prev => ({ ...prev, maxStars: value[0] }))}
                            max={100000}
                            step={1000}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={filters.maxStars}
                            onChange={(e) => setFilters(prev => ({ ...prev, maxStars: parseInt(e.target.value) || 100000 }))}
                            className="w-24 bg-dark border-border"
                          />
                        </div>
                      </div>
                    </div>

                    {/* License Filter */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-300">License</Label>
                        <Select value={filters.license} onValueChange={(value) => setFilters(prev => ({ ...prev, license: value }))}>
                          <SelectTrigger className="bg-dark border-border">
                            <SelectValue placeholder="Select license" />
                          </SelectTrigger>
                          <SelectContent className="bg-dark border-border">
                            <SelectItem value="all">All Licenses</SelectItem>
                            <SelectItem value="mit">MIT</SelectItem>
                            <SelectItem value="apache-2.0">Apache 2.0</SelectItem>
                            <SelectItem value="gpl-3.0">GPL 3.0</SelectItem>
                            <SelectItem value="bsd-3-clause">BSD 3-Clause</SelectItem>
                            <SelectItem value="unlicense">Unlicense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Topics */}
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-300">Topics</Label>
                        <div className="flex space-x-2">
                          <Input
                            type="text"
                            placeholder="Add topic..."
                            value={topicInput}
                            onChange={(e) => setTopicInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTopic())}
                            className="flex-1 bg-dark border-border"
                          />
                          <Button
                            type="button"
                            onClick={handleAddTopic}
                            size="sm"
                            variant="outline"
                            className="border-border"
                          >
                            Add
                          </Button>
                        </div>
                        {filters.topics.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {filters.topics.map(topic => (
                              <Badge
                                key={topic}
                                variant="secondary"
                                className="cursor-pointer hover:bg-red-900"
                                onClick={() => handleRemoveTopic(topic)}
                              >
                                {topic} ×
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toggle Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="archived"
                          checked={filters.includeArchived}
                          onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeArchived: checked }))}
                        />
                        <Label htmlFor="archived" className="text-sm text-gray-300 cursor-pointer">
                          Include Archived
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="forked"
                          checked={filters.includeForked}
                          onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeForked: checked }))}
                        />
                        <Label htmlFor="forked" className="text-sm text-gray-300 cursor-pointer">
                          Include Forked
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="issues"
                          checked={filters.hasIssues}
                          onCheckedChange={(checked) => setFilters(prev => ({ ...prev, hasIssues: checked }))}
                        />
                        <Label htmlFor="issues" className="text-sm text-gray-300 cursor-pointer">
                          Has Open Issues
                        </Label>
                      </div>
                    </div>

                    {/* Reset Button */}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={resetFilters}
                        variant="ghost"
                        className="text-gray-400 hover:text-white"
                      >
                        Reset All Filters
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Results Section */}
      <main id="main-content" className="py-8 md:py-16 bg-dark" role="main" aria-label="Search results">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {searchTerm && (
            <div className="mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold mb-2">
                Search results for "<span className="text-primary">{searchTerm}</span>"
              </h2>
              {searchResults && (
                <p className="text-sm md:text-base text-gray-400">
                  Found {searchResults.length} repositories
                </p>
              )}
            </div>
          )}

          <ContentTransition
            isLoading={isLoading}
            skeleton={
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <LoadingSkeleton variant="card" count={9} />
              </div>
            }
          >
            {searchResults && searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {searchResults.map((repository: { id: string; name: string; full_name: string; description?: string; language?: string; stargazers_count?: number; forks_count?: number }) => (
                <div
                  key={repository.id}
                  className="bg-card border border-border rounded-xl p-4 md:p-6 hover:border-primary/30 transition-all duration-300 cursor-pointer touch-target"
                  onClick={() => window.location.href = `/repository/${repository.id}`}
                  data-testid={`card-repository-${repository.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <i className="fab fa-github text-white"></i>
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg" data-testid={`text-repo-name-${repository.id}`}>
                          {repository.name}
                        </h4>
                        <p className="text-sm text-gray-400" data-testid={`text-repo-owner-${repository.id}`}>
                          {repository.full_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-star text-yellow-500"></i>
                      <span className="text-sm" data-testid={`text-stars-${repository.id}`}>
                        {repository.stargazers_count?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-6 line-clamp-3" data-testid={`text-description-${repository.id}`}>
                    {repository.description || 'No description available'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {repository.language && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                          {repository.language}
                        </span>
                      )}
                      {(repository as any).topics && (repository as any).topics.slice(0, 2).map((topic: string) => (
                        <span key={topic} className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                          {topic}
                        </span>
                      ))}
                    </div>
                    <button className="text-primary hover:text-secondary transition-colors text-sm font-medium">
                      View Details
                    </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchTerm ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-secondary to-accent flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-search text-white text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold mb-2">No Results Found</h3>
              <p className="text-gray-400 mb-6">
                No repositories found for "<span className="text-primary">{searchTerm}</span>". 
                Try adjusting your search terms.
              </p>
              <Button
                onClick={() => setSearchTerm("")}
                variant="outline"
                className="border border-primary/30 text-primary hover:bg-primary/10"
                data-testid="button-clear-search"
              >
                Clear Search
                </Button>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-4 animate-float">
                  <i className="fas fa-search text-white text-2xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-2">Search Repositories</h3>
                <p className="text-gray-400">
                  Enter a search term above to discover GitHub repositories
                </p>
              </div>
            )}
          </ContentTransition>
        </div>
      </main>
    </PageWithBackground>
  );
}
