import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Zap, X, CheckCircle, AlertCircle, Upload, Download, FileText } from "lucide-react";
import { Link } from "wouter";
import { exportBatchSummary, exportToCSV } from "@/utils/export-utils";
import { useAuth } from "@/hooks/useAuth";

interface BatchRepository {
  url: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  error?: string;
  analysis?: any;
}

export default function BatchAnalyze() {
  const [repoUrls, setRepoUrls] = useState("");
  const [repositories, setRepositories] = useState<BatchRepository[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (url: string) => {
      const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
      if (!repoMatch) throw new Error('Invalid GitHub URL');
      
      // Clean the URL to ensure it's properly formatted
      const cleanUrl = url.replace(/\.git$/, '').trim();
      return apiRequest("POST", "/api/repositories/analyze", {
        url: cleanUrl
      });
    }
  });

  const handleParse = () => {
    const urls = repoUrls
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => url.includes('github.com'))
      .map(url => ({
        url,
        status: 'pending' as const,
      }));

    if (urls.length === 0) {
      toast({
        title: "No valid URLs",
        description: "Please enter at least one valid GitHub repository URL",
        variant: "destructive"
      });
      return;
    }

    if (!user && urls.length > 3) {
      toast({
        title: "Sign in required",
        description: "Free users can analyze up to 3 repositories at once. Sign in for unlimited batch analysis.",
        variant: "destructive"
      });
      return;
    }

    setRepositories(urls);
  };

  const handleAnalyze = async () => {
    if (repositories.length === 0) return;

    setIsAnalyzing(true);
    
    // Process repositories sequentially to avoid overwhelming the API
    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];
      
      // Update status to analyzing
      setRepositories(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'analyzing' } : r
      ));

      try {
        const result = await analyzeMutation.mutateAsync(repo.url);
        
        // Update with completed analysis
        setRepositories(prev => prev.map((r, idx) => 
          idx === i ? { 
            ...r, 
            status: 'completed', 
            analysis: result 
          } : r
        ));
      } catch (error) {
        // Update with error
        setRepositories(prev => prev.map((r, idx) => 
          idx === i ? { 
            ...r, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Analysis failed' 
          } : r
        ));
      }
    }

    setIsAnalyzing(false);
    
    const completed = repositories.filter(r => r.status === 'completed').length;
    const failed = repositories.filter(r => r.status === 'error').length;
    
    toast({
      title: "Batch analysis complete",
      description: `Successfully analyzed ${completed} repositories${failed > 0 ? `, ${failed} failed` : ''}`,
    });
  };

  const handleExportCSV = async () => {
    const completedRepos = repositories.filter(r => r.status === 'completed' && r.analysis);
    
    if (completedRepos.length === 0) {
      toast({
        title: "No data to export",
        description: "Complete at least one analysis before exporting",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Add a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Transform data for export utility
      const exportData = completedRepos.map(repo => {
        const repoInfo = repo.url.split('/');
        const repoName = repoInfo[repoInfo.length - 1];
        const repoOwner = repoInfo[repoInfo.length - 2];
        
        return {
          id: 'batch-' + Date.now(),
          repositoryId: repo.url,
          originality: repo.analysis.scores?.originality || 0,
          completeness: repo.analysis.scores?.completeness || 0,
          marketability: repo.analysis.scores?.marketability || 0,
          monetization: repo.analysis.scores?.monetization || 0,
          usefulness: repo.analysis.scores?.usefulness || 0,
          overallScore: repo.analysis.overall_score || 0,
          summary: repo.analysis.summary || '',
          strengths: repo.analysis.key_findings || [],
          weaknesses: repo.analysis.weaknesses || [],
          recommendations: repo.analysis.recommendations || [],
          createdAt: new Date().toISOString(),
          repository: {
            name: repoName,
            full_name: `${repoOwner}/${repoName}`,
            description: repo.analysis.description || '',
            language: repo.analysis.language || '',
            stargazers_count: repo.analysis.stars || 0,
            forks_count: repo.analysis.forks || 0,
          },
          // For backward compatibility
          originality_score: repo.analysis.scores?.originality || 0,
          completeness_score: repo.analysis.scores?.completeness || 0,
          marketability_score: repo.analysis.scores?.marketability || 0,
          monetization_score: repo.analysis.scores?.monetization || 0,
          usefulness_score: repo.analysis.scores?.usefulness || 0,
          overall_score: repo.analysis.overall_score || 0,
          key_findings: repo.analysis.key_findings || [],
        };
      });

      exportToCSV(exportData);
      toast({
        title: "Export Successful",
        description: "Batch analysis results exported as CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    const completedRepos = repositories.filter(r => r.status === 'completed' && r.analysis);
    
    if (completedRepos.length === 0) {
      toast({
        title: "No data to export",
        description: "Complete at least one analysis before exporting",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Add a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Transform data for export utility
      const exportData = completedRepos.map(repo => {
        const repoInfo = repo.url.split('/');
        const repoName = repoInfo[repoInfo.length - 1];
        const repoOwner = repoInfo[repoInfo.length - 2];
        
        return {
          id: 'batch-' + Date.now(),
          repositoryId: repo.url,
          originality: repo.analysis.scores?.originality || 0,
          completeness: repo.analysis.scores?.completeness || 0,
          marketability: repo.analysis.scores?.marketability || 0,
          monetization: repo.analysis.scores?.monetization || 0,
          usefulness: repo.analysis.scores?.usefulness || 0,
          overallScore: repo.analysis.overall_score || 0,
          summary: repo.analysis.summary || '',
          strengths: repo.analysis.key_findings || [],
          weaknesses: repo.analysis.weaknesses || [],
          recommendations: repo.analysis.recommendations || [],
          createdAt: new Date().toISOString(),
          repository: {
            name: repoName,
            full_name: `${repoOwner}/${repoName}`,
            description: repo.analysis.description || '',
            language: repo.analysis.language || '',
            stargazers_count: repo.analysis.stars || 0,
            forks_count: repo.analysis.forks || 0,
          },
          // For backward compatibility
          originality_score: repo.analysis.scores?.originality || 0,
          completeness_score: repo.analysis.scores?.completeness || 0,
          marketability_score: repo.analysis.scores?.marketability || 0,
          monetization_score: repo.analysis.scores?.monetization || 0,
          usefulness_score: repo.analysis.scores?.usefulness || 0,
          overall_score: repo.analysis.overall_score || 0,
          key_findings: repo.analysis.key_findings || [],
        };
      });

      exportBatchSummary(exportData);
      toast({
        title: "Export Successful",
        description: "Batch analysis results exported as PDF",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };



  const handleRemove = (index: number) => {
    setRepositories(prev => prev.filter((_, i) => i !== index));
  };

  const completedCount = repositories.filter(r => r.status === 'completed').length;
  const errorCount = repositories.filter(r => r.status === 'error').length;
  const progress = repositories.length > 0 
    ? ((completedCount + errorCount) / repositories.length) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-dark text-white">
      <Header />

      {/* Hero Section */}
      <section className="py-12 pt-32 bg-gradient-to-r from-dark via-card to-dark">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              <Zap className="inline w-10 h-10 mr-2 text-yellow-400" />
              Batch <span className="gradient-text">Repository Analysis</span>
            </h1>
            <p className="text-xl text-gray-300">Analyze multiple repositories at once with AI-powered insights</p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 bg-dark">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <Card className="bg-card border border-border">
              <CardHeader>
                <CardTitle className="text-xl flex items-center">
                  <Upload className="mr-2 w-5 h-5" />
                  Add Repositories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Enter GitHub repository URLs (one per line or comma-separated)
                  </label>
                  <Textarea
                    placeholder="https://github.com/owner/repo1&#10;https://github.com/owner/repo2&#10;https://github.com/owner/repo3"
                    value={repoUrls}
                    onChange={(e) => setRepoUrls(e.target.value)}
                    className="min-h-[200px] bg-dark border-border text-white placeholder-gray-500"
                    disabled={isAnalyzing}
                  />
                </div>
                
                <div className="flex space-x-4">
                  <Button
                    onClick={handleParse}
                    variant="outline"
                    className="flex-1"
                    disabled={isAnalyzing || !repoUrls}
                  >
                    Parse URLs
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    className="flex-1 bg-primary hover:bg-primary/80"
                    disabled={isAnalyzing || repositories.length === 0}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                  </Button>
                </div>

                {!user && (
                  <Alert className="bg-yellow-900/20 border-yellow-600">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-100">
                      Free users can analyze up to 3 repositories at once. 
                      <Link href="/pricing" className="underline ml-1">Upgrade to Pro</Link> for unlimited batch analysis.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Results Section */}
            <Card className="bg-card border border-border">
              <CardHeader>
                <CardTitle className="text-xl flex items-center justify-between">
                  <span className="flex items-center">
                    <FileText className="mr-2 w-5 h-5" />
                    Analysis Queue ({repositories.length})
                  </span>
                  {completedCount > 0 && (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportCSV}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <div className="w-4 h-4 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                          <Download className="w-4 h-4 mr-1" />
                        )}
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportPDF}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <div className="w-4 h-4 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                          <Download className="w-4 h-4 mr-1" />
                        )}
                        PDF
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {repositories.length > 0 && (
                  <div className="space-y-4">
                    <Progress value={progress} className="h-2" />
                    
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {repositories.map((repo, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-dark rounded-lg border border-border"
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            {repo.status === 'pending' && (
                              <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                            )}
                            {repo.status === 'analyzing' && (
                              <div className="w-4 h-4 rounded-full bg-yellow-500 animate-pulse"></div>
                            )}
                            {repo.status === 'completed' && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            {repo.status === 'error' && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            
                            <div className="flex-1">
                              <p className="text-sm font-mono truncate">
                                {repo.url.split('/').slice(-2).join('/')}
                              </p>
                              {repo.status === 'completed' && repo.analysis && (
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    Score: {repo.analysis.overall_score}/100
                                  </Badge>
                                  <Link
                                    href={`/repository/${repo.analysis.repository_id}`}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    View Details →
                                  </Link>
                                </div>
                              )}
                              {repo.status === 'error' && (
                                <p className="text-xs text-red-400 mt-1">{repo.error}</p>
                              )}
                            </div>
                          </div>
                          
                          {!isAnalyzing && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemove(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {repositories.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No repositories added yet</p>
                    <p className="text-sm mt-2">Add GitHub URLs and click "Parse URLs" to begin</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Statistics */}
          {repositories.length > 0 && (
            <Card className="bg-card border border-border mt-8">
              <CardContent className="py-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-white">{repositories.length}</p>
                    <p className="text-sm text-gray-400">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-400">
                      {repositories.filter(r => r.status === 'analyzing').length}
                    </p>
                    <p className="text-sm text-gray-400">Analyzing</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{completedCount}</p>
                    <p className="text-sm text-gray-400">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                    <p className="text-sm text-gray-400">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}