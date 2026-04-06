import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  Filter, 
  X, 
  Calendar as CalendarIcon, 
  Star, 
  GitFork, 
  Eye, 
  Code,
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

export interface SearchFilters {
  languages: string[];
  minStars: number;
  maxStars: number;
  minForks: number;
  maxForks: number;
  dateRange: {
    from?: Date;
    to?: Date;
  };
  topics: string[];
  hasIssues: boolean;
  hasWiki: boolean;
  hasProjects: boolean;
  license: string;
  size: 'any' | 'small' | 'medium' | 'large' | 'huge';
  activity: 'any' | 'active' | 'inactive' | 'archived';
  sortBy: 'relevance' | 'stars' | 'forks' | 'updated' | 'created';
  sortOrder: 'desc' | 'asc';
  scoreRange: [number, number];
}

interface AdvancedSearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onReset: () => void;
  isLoading?: boolean;
}

const POPULAR_LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C#',
  'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'Scala', 'R', 'MATLAB'
];

const POPULAR_TOPICS = [
  'web-development', 'mobile', 'machine-learning', 'ai', 'blockchain',
  'game-development', 'devops', 'frontend', 'backend', 'full-stack',
  'microservices', 'api', 'database', 'security', 'testing'
];

const LICENSE_OPTIONS = [
  { value: 'any', label: 'Any License' },
  { value: 'mit', label: 'MIT' },
  { value: 'apache-2.0', label: 'Apache 2.0' },
  { value: 'gpl-3.0', label: 'GPL 3.0' },
  { value: 'bsd-3-clause', label: 'BSD 3-Clause' },
  { value: 'unlicense', label: 'Unlicense' },
  { value: 'none', label: 'No License' }
];

export default function AdvancedSearchFilters({
  filters,
  onFiltersChange,
  onReset,
  isLoading = false
}: AdvancedSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [languageInput, setLanguageInput] = useState('');
  const [topicInput, setTopicInput] = useState('');

  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const addLanguage = (language: string) => {
    if (language && !filters.languages.includes(language)) {
      updateFilters({
        languages: [...filters.languages, language]
      });
    }
    setLanguageInput('');
  };

  const removeLanguage = (language: string) => {
    updateFilters({
      languages: filters.languages.filter(l => l !== language)
    });
  };

  const addTopic = (topic: string) => {
    if (topic && !filters.topics.includes(topic)) {
      updateFilters({
        topics: [...filters.topics, topic]
      });
    }
    setTopicInput('');
  };

  const removeTopic = (topic: string) => {
    updateFilters({
      topics: filters.topics.filter(t => t !== topic)
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.languages.length > 0 ||
      filters.minStars > 0 ||
      filters.maxStars < 100000 ||
      filters.minForks > 0 ||
      filters.maxForks < 10000 ||
      filters.dateRange.from ||
      filters.dateRange.to ||
      filters.topics.length > 0 ||
      filters.hasIssues ||
      filters.hasWiki ||
      filters.hasProjects ||
      filters.license !== 'any' ||
      filters.size !== 'any' ||
      filters.activity !== 'any' ||
      filters.sortBy !== 'relevance' ||
      filters.sortOrder !== 'desc' ||
      filters.scoreRange[0] > 0 ||
      filters.scoreRange[1] < 10
    );
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Advanced Filters
            {hasActiveFilters() && (
              <Badge variant="secondary" className="ml-2">
                {filters.languages.length + filters.topics.length + 
                 (filters.minStars > 0 ? 1 : 0) + 
                 (filters.dateRange.from ? 1 : 0)} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={isLoading || !hasActiveFilters()}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Languages */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Code className="w-4 h-4" />
              Programming Languages
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.languages.map(lang => (
                <Badge key={lang} variant="secondary" className="gap-1">
                  {lang}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => removeLanguage(lang)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add language..."
                value={languageInput}
                onChange={(e) => setLanguageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addLanguage(languageInput)}
                className="flex-1"
              />
              <Button 
                size="sm" 
                onClick={() => addLanguage(languageInput)}
                disabled={!languageInput.trim()}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {POPULAR_LANGUAGES.filter(lang => !filters.languages.includes(lang)).map(lang => (
                <Button
                  key={lang}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => addLanguage(lang)}
                >
                  {lang}
                </Button>
              ))}
            </div>
          </div>

          {/* Repository Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Star className="w-4 h-4" />
                Stars Range
              </label>
              <div className="px-2">
                <Slider
                  value={[filters.minStars]}
                  onValueChange={([value]) => updateFilters({ minStars: value })}
                  max={100000}
                  step={100}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{filters.minStars.toLocaleString()}+</span>
                  <span>100K</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <GitFork className="w-4 h-4" />
                Forks Range
              </label>
              <div className="px-2">
                <Slider
                  value={[filters.minForks]}
                  onValueChange={([value]) => updateFilters({ minForks: value })}
                  max={10000}
                  step={10}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{filters.minForks.toLocaleString()}+</span>
                  <span>10K</span>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Score Range */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Analysis Score Range
            </label>
            <div className="px-2">
              <Slider
                value={filters.scoreRange}
                onValueChange={(value) => updateFilters({ scoreRange: value as [number, number] })}
                max={10}
                min={0}
                step={0.1}
                className="mb-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{filters.scoreRange[0].toFixed(1)}</span>
                <span>{filters.scoreRange[1].toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Date Range
            </label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange.from ? (
                      format(filters.dateRange.from, "PPP")
                    ) : (
                      "From date"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.from}
                    onSelect={(date) => updateFilters({ 
                      dateRange: { ...filters.dateRange, from: date }
                    })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange.to ? (
                      format(filters.dateRange.to, "PPP")
                    ) : (
                      "To date"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.to}
                    onSelect={(date) => updateFilters({ 
                      dateRange: { ...filters.dateRange, to: date }
                    })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Topics */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Topics</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.topics.map(topic => (
                <Badge key={topic} variant="secondary" className="gap-1">
                  {topic}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => removeTopic(topic)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add topic..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTopic(topicInput)}
                className="flex-1"
              />
              <Button 
                size="sm" 
                onClick={() => addTopic(topicInput)}
                disabled={!topicInput.trim()}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {POPULAR_TOPICS.filter(topic => !filters.topics.includes(topic)).map(topic => (
                <Button
                  key={topic}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => addTopic(topic)}
                >
                  {topic}
                </Button>
              ))}
            </div>
          </div>

          {/* Repository Features */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Repository Features</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasIssues"
                  checked={filters.hasIssues}
                  onCheckedChange={(checked) => updateFilters({ hasIssues: !!checked })}
                />
                <label htmlFor="hasIssues" className="text-sm">Has Issues</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasWiki"
                  checked={filters.hasWiki}
                  onCheckedChange={(checked) => updateFilters({ hasWiki: !!checked })}
                />
                <label htmlFor="hasWiki" className="text-sm">Has Wiki</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasProjects"
                  checked={filters.hasProjects}
                  onCheckedChange={(checked) => updateFilters({ hasProjects: !!checked })}
                />
                <label htmlFor="hasProjects" className="text-sm">Has Projects</label>
              </div>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">License</label>
              <Select 
                value={filters.license} 
                onValueChange={(value) => updateFilters({ license: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Repository Size</label>
              <Select 
                value={filters.size} 
                onValueChange={(value: any) => updateFilters({ size: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Size</SelectItem>
                  <SelectItem value="small">Small (&lt;1MB)</SelectItem>
                  <SelectItem value="medium">Medium (1-10MB)</SelectItem>
                  <SelectItem value="large">Large (10-100MB)</SelectItem>
                  <SelectItem value="huge">Huge (&gt;100MB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Activity</label>
              <Select 
                value={filters.activity} 
                onValueChange={(value: any) => updateFilters({ activity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Activity</SelectItem>
                  <SelectItem value="active">Recently Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sorting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select 
                value={filters.sortBy} 
                onValueChange={(value: any) => updateFilters({ sortBy: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="stars">Stars</SelectItem>
                  <SelectItem value="forks">Forks</SelectItem>
                  <SelectItem value="updated">Last Updated</SelectItem>
                  <SelectItem value="created">Date Created</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Order</label>
              <Select 
                value={filters.sortOrder} 
                onValueChange={(value: any) => updateFilters({ sortOrder: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}