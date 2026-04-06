import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Trash2, Play, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RepositoryUrl {
  id: string;
  url: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  error?: string;
  result?: any;
}

export default function BulkAnalysis() {
  const [repositories, setRepositories] = useState<RepositoryUrl[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseRepositoryUrls = (text: string): string[] => {
    // Extract GitHub URLs from text
    const githubUrlPattern = /https?:\/\/github\.com\/[^\s/]+\/[^\s/]+(?:\/[^\s]*)?/g;
    const urls = text.match(githubUrlPattern) || [];
    
    // Also handle simple owner/repo format
    const simplePattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/gm;
    const simpleRepos = text.match(simplePattern) || [];
    
    const allUrls = [
      ...urls,
      ...simpleRepos.map(repo => `https://github.com/${repo}`)
    ];
    
    // Remove duplicates
    return Array.from(new Set(allUrls));
  };

  const addRepositoriesFromText = () => {
    if (!textInput.trim()) return;
    
    const urls = parseRepositoryUrls(textInput);
    
    if (urls.length === 0) {
      toast({
        title: 'No repositories found',
        description: 'Please enter valid GitHub URLs or owner/repo names',
        variant: 'destructive'
      });
      return;
    }

    const newRepos: RepositoryUrl[] = urls.map(url => ({
      id: Math.random().toString(36).substr(2, 9),
      url,
      status: 'pending'
    }));

    setRepositories(prev => [...prev, ...newRepos]);
    setTextInput('');
    
    toast({
      title: 'Repositories added',
      description: `Added ${urls.length} repositories to the queue`,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/plain' && !file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a .txt or .csv file',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const urls = parseRepositoryUrls(content);
      
      if (urls.length === 0) {
        toast({
          title: 'No repositories found in file',
          description: 'The file doesn\'t contain valid GitHub URLs',
          variant: 'destructive'
        });
        return;
      }

      const newRepos: RepositoryUrl[] = urls.map(url => ({
        id: Math.random().toString(36).substr(2, 9),
        url,
        status: 'pending'
      }));

      setRepositories(prev => [...prev, ...newRepos]);
      
      toast({
        title: 'File uploaded successfully',
        description: `Found ${urls.length} repositories in the file`,
      });
    };

    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeRepository = (id: string) => {
    setRepositories(prev => prev.filter(repo => repo.id !== id));
  };

  const clearAll = () => {
    setRepositories([]);
    setProgress(0);
  };

  const analyzeAll = async () => {
    if (repositories.length === 0) return;
    
    setIsAnalyzing(true);
    setProgress(0);
    
    const pendingRepos = repositories.filter(repo => repo.status === 'pending' || repo.status === 'error');
    
    for (let i = 0; i < pendingRepos.length; i++) {
      const repo = pendingRepos[i];
      
      // Update status to analyzing
      setRepositories(prev => prev.map(r => 
        r.id === repo.id ? { ...r, status: 'analyzing' } : r
      ));
      
      try {
        // Simulate API call - replace with actual analysis
        const response = await fetch('/api/analyze-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryUrl: repo.url })
        });
        
        if (response.ok) {
          const result = await response.json();
          setRepositories(prev => prev.map(r => 
            r.id === repo.id ? { ...r, status: 'completed', result } : r
          ));
        } else {
          throw new Error(`Analysis failed: ${response.statusText}`);
        }
      } catch (error) {
        setRepositories(prev => prev.map(r => 
          r.id === repo.id ? { 
            ...r, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error'
          } : r
        ));
      }
      
      // Update progress
      const completedCount = i + 1;
      setProgress((completedCount / pendingRepos.length) * 100);
      
      // Add delay between requests to avoid rate limiting
      if (i < pendingRepos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setIsAnalyzing(false);
    
    toast({
      title: 'Bulk analysis completed',
      description: `Analyzed ${pendingRepos.length} repositories`,
    });
  };

  const exportResults = () => {
    const completedRepos = repositories.filter(repo => repo.status === 'completed');
    
    if (completedRepos.length === 0) {
      toast({
        title: 'No results to export',
        description: 'Complete some analyses first',
        variant: 'destructive'
      });
      return;
    }
    
    const csvContent = [
      'Repository URL,Overall Score,Originality,Completeness,Marketability,Monetization,Usefulness',
      ...completedRepos.map(repo => {
        const analysis = repo.result?.data?.analysis;
        return [
          repo.url,
          analysis?.overallScore || 0,
          analysis?.originality || 0,
          analysis?.completeness || 0,
          analysis?.marketability || 0,
          analysis?.monetization || 0,
          analysis?.usefulness || 0
        ].join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-analysis-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Results exported',
      description: 'CSV file has been downloaded',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-500';
      case 'analyzing': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'analyzing': return <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />;
      case 'completed': return '✓';
      case 'error': return '✗';
      default: return '○';
    }
  };

  const pendingCount = repositories.filter(r => r.status === 'pending').length;
  const analyzingCount = repositories.filter(r => r.status === 'analyzing').length;
  const completedCount = repositories.filter(r => r.status === 'completed').length;
  const errorCount = repositories.filter(r => r.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Add Repositories for Bulk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Paste Repository URLs or owner/repo names
            </label>
            <Textarea
              placeholder={`Enter GitHub URLs or repository names (one per line):
https://github.com/facebook/react
microsoft/typescript
vercel/next.js`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="bg-dark border-border text-white min-h-[120px]"
              rows={5}
            />
            <Button
              onClick={addRepositoriesFromText}
              className="mt-2 bg-primary hover:bg-primary/80"
              disabled={!textInput.trim()}
            >
              Add Repositories
            </Button>
          </div>

          {/* File Upload */}
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="border-border hover:bg-gray-700/50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File (.txt or .csv)
            </Button>
            <span className="text-sm text-gray-400">
              Upload a file containing repository URLs
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Repository List */}
      {repositories.length > 0 && (
        <Card className="bg-card border border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Repository Queue ({repositories.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={analyzeAll}
                  disabled={isAnalyzing || pendingCount === 0}
                  className="bg-primary hover:bg-primary/80"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isAnalyzing ? 'Analyzing...' : `Analyze ${pendingCount} Repositories`}
                </Button>
                <Button
                  onClick={exportResults}
                  disabled={completedCount === 0}
                  variant="outline"
                  className="border-border hover:bg-gray-700/50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Results
                </Button>
                <Button
                  onClick={clearAll}
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>
            
            {/* Status Summary */}
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="secondary" className="bg-gray-500">
                Pending: {pendingCount}
              </Badge>
              <Badge variant="secondary" className="bg-yellow-500">
                Analyzing: {analyzingCount}
              </Badge>
              <Badge variant="secondary" className="bg-green-500">
                Completed: {completedCount}
              </Badge>
              {errorCount > 0 && (
                <Badge variant="secondary" className="bg-red-500">
                  Errors: {errorCount}
                </Badge>
              )}
            </div>

            {/* Progress Bar */}
            {isAnalyzing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-400">
                  Progress: {Math.round(progress)}%
                </p>
              </div>
            )}
          </CardHeader>
          
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    "bg-dark border-border hover:border-primary/30 transition-colors"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs text-white",
                      getStatusColor(repo.status)
                    )}>
                      {getStatusIcon(repo.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{repo.url}</p>
                      {repo.error && (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {repo.error}
                        </p>
                      )}
                      {repo.result && (
                        <p className="text-xs text-green-400">
                          Score: {repo.result.data?.analysis?.overallScore?.toFixed(1) || 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => removeRepository(repo.id)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-400"
                    disabled={repo.status === 'analyzing'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}