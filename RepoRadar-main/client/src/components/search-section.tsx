import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function SearchSection() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");

  const handleSearch = () => {
    if (query.trim()) {
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleAnalyze = () => {
    if (url.trim()) {
      setLocation(`/analyze?url=${encodeURIComponent(url.trim())}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
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
          {/* Search Repositories */}
          <Card className="bg-card border border-border hover-lift hover-border-glow">
            <CardContent className="p-8">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-search text-white"></i>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Search Repositories</h3>
              <p className="text-gray-400 mb-6">
                Discover repositories by keywords, topics, or technology
              </p>
              <div className="flex space-x-3">
                <Input
                  type="text"
                  placeholder="Search repositories..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleSearch)}
                  className="flex-1 bg-dark border-border text-white input-focus"
                  data-testid="input-search"
                  data-tour="search-box"
                />
                <Button
                  onClick={handleSearch}
                  className="bg-primary hover:bg-primary/80 text-white button-hover hover-shine button-scale ripple"
                  data-testid="button-search"
                >
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Analyze Repository */}
          <Card className="bg-card border border-border hover-lift hover-border-glow">
            <CardContent className="p-8">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-accent to-primary flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-robot text-white"></i>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Analyze Repository</h3>
              <p className="text-gray-400 mb-6">
                Get AI-powered analysis of any GitHub repository
              </p>
              <div className="flex space-x-3">
                <Input
                  type="text"
                  placeholder="GitHub repository URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleAnalyze)}
                  className="flex-1 bg-dark border-border text-white input-focus"
                  data-testid="input-analyze"
                />
                <Button
                  onClick={handleAnalyze}
                  className="bg-gradient-to-r from-accent to-primary hover:from-primary hover:to-accent text-white button-hover hover-shine button-scale ripple"
                  data-testid="button-analyze"
                  data-tour="analyze-button"
                >
                  Analyze
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}