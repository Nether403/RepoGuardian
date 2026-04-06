import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { useLocation } from 'wouter';
import Fuse from 'fuse.js';
import { analytics } from '@/hooks/useNavigationTracking';
import { cn } from '@/lib/utils';

interface SearchableDoc {
  title: string;
  path: string;
  category: string;
  description?: string;
  content: string;
}

interface DocSearchProps {
  documents: SearchableDoc[];
  className?: string;
}

export function DocSearch({ documents, className }: DocSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchableDoc[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Fuse.js
  const fuse = useRef(
    new Fuse(documents, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'description', weight: 1.5 },
        { name: 'content', weight: 1 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    })
  );

  // Update fuse index when documents change
  useEffect(() => {
    fuse.current.setCollection(documents);
  }, [documents]);

  // Handle search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchResults = fuse.current.search(query);
    const searchResultItems = searchResults.map(result => result.item).slice(0, 10);
    setResults(searchResultItems);
    setIsOpen(true);
    
    // Track search analytics
    analytics.trackSearch(query, searchResultItems.length);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = (doc: SearchableDoc) => {
    setLocation(doc.path);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900">{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={searchRef} className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documentation... (Ctrl+K)"
          className="w-full pl-10 pr-10 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Search documentation"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-md shadow-lg max-h-96 overflow-y-auto z-50">
          <div className="p-2">
            <div className="text-xs text-muted-foreground px-3 py-2">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            {results.map((doc, index) => (
              <button
                key={`${doc.path}-${index}`}
                onClick={() => handleResultClick(doc)}
                className="w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {highlightMatch(doc.title, query)}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {doc.category.replace(/-/g, ' ')}
                    </div>
                    {doc.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {highlightMatch(doc.description, query)}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-md shadow-lg p-4 z-50">
          <p className="text-sm text-muted-foreground text-center">
            No results found for "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
