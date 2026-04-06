import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, History, Loader2, Command } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'suggestion' | 'popular';
}

export default function EnhancedSearch() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock suggestions - in real app, these would come from API
  const mockSuggestions: SearchSuggestion[] = [
    { id: '1', text: 'react', type: 'popular' },
    { id: '2', text: 'typescript', type: 'popular' },
    { id: '3', text: 'next.js', type: 'popular' },
    { id: '4', text: 'vue.js', type: 'popular' },
    { id: '5', text: 'angular', type: 'popular' },
    { id: '6', text: 'node.js', type: 'popular' },
    { id: '7', text: 'python machine learning', type: 'suggestion' },
    { id: '8', text: 'rust web framework', type: 'suggestion' },
  ];

  // Get recent searches from localStorage
  const getRecentSearches = (): SearchSuggestion[] => {
    try {
      const recent = localStorage.getItem('repoRadar_recentSearches');
      return recent ? JSON.parse(recent) : [];
    } catch {
      return [];
    }
  };

  // Save search to localStorage
  const saveRecentSearch = (searchTerm: string) => {
    try {
      const recent = getRecentSearches();
      const newSearch: SearchSuggestion = {
        id: Date.now().toString(),
        text: searchTerm,
        type: 'recent'
      };
      
      const updated = [newSearch, ...recent.filter(s => s.text !== searchTerm)].slice(0, 5);
      localStorage.setItem('repoRadar_recentSearches', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  };

  // Filter suggestions based on query
  useEffect(() => {
    if (!query.trim()) {
      const recent = getRecentSearches();
      setSuggestions([...recent, ...mockSuggestions.slice(0, 6)]);
    } else {
      const filtered = mockSuggestions.filter(s => 
        s.text.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
    }
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchTerm?: string) => {
    const term = searchTerm || query.trim();
    if (!term) return;

    setIsSearching(true);
    saveRecentSearch(term);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setLocation(`/search?q=${encodeURIComponent(term)}`);
    setShowSuggestions(false);
    setSelectedSuggestion(-1);
    setIsSearching(false);
  };

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    
    setIsAnalyzing(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setLocation(`/analyze?url=${encodeURIComponent(url.trim())}`);
    setIsAnalyzing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestion >= 0) {
          handleSearch(suggestions[selectedSuggestion].text);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'recent':
        return <History className="w-4 h-4 text-gray-400" />;
      case 'popular':
        return <Search className="w-4 h-4 text-gray-400" />;
      default:
        return <Command className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <section className="py-20 bg-gradient-to-b from-dark via-card to-dark">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold mb-4">Discover & Analyze</h2>
        <p className="text-xl text-gray-300 mb-12">
          Search repositories or analyze specific ones with AI-powered insights
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Enhanced Search Repositories */}
          <Card className="bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
            <CardContent className="p-8">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-6">
                <img 
                  src="/Images/search.png" 
                  alt="Search Repositories" 
                  className="w-12 h-12 object-contain"
                />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Search Repositories</h3>
              <p className="text-gray-400 mb-6">
                Discover repositories by keywords, topics, or technology
              </p>
              
              <div ref={searchRef} className="relative">
                <div className="flex space-x-3">
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Search repositories... (try 'react', 'typescript')"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={handleKeyDown}
                      className="bg-dark border-border text-white focus:border-primary/50 transition-colors pr-10"
                      data-testid="input-search"
                      data-tour="search-box"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      <kbd className="px-2 py-1 text-xs bg-gray-800 rounded">⌘K</kbd>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSearch()}
                    disabled={isSearching}
                    className="bg-primary hover:bg-primary/80 text-white transition-all duration-200 hover:scale-105"
                    data-testid="button-search"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Search"
                    )}
                  </Button>
                </div>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors",
                          index === selectedSuggestion 
                            ? "bg-primary/20 text-primary" 
                            : "hover:bg-gray-700/50"
                        )}
                        onClick={() => handleSearch(suggestion.text)}
                      >
                        {getSuggestionIcon(suggestion.type)}
                        <span className="flex-1">{suggestion.text}</span>
                        {suggestion.type === 'popular' && (
                          <span className="text-xs text-gray-500">Popular</span>
                        )}
                        {suggestion.type === 'recent' && (
                          <span className="text-xs text-gray-500">Recent</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Analyze Repository */}
          <Card className="bg-card border border-border hover:border-accent/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10">
            <CardContent className="p-8">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-6">
                <img 
                  src="/Images/analyze.png" 
                  alt="Analyze Repository" 
                  className="w-12 h-12 object-contain"
                />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Analyze Repository</h3>
              <p className="text-gray-400 mb-6">
                Get comprehensive AI analysis of any GitHub repository
              </p>
              <div className="flex space-x-3">
                <Input
                  type="text"
                  placeholder="GitHub repository URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="flex-1 bg-dark border-border text-white focus:border-accent/50 transition-colors"
                  data-testid="input-analyze"
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="bg-accent hover:bg-accent/80 text-white transition-all duration-200 hover:scale-105"
                  data-testid="button-analyze"
                  data-tour="analyze-button"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Analyze"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}