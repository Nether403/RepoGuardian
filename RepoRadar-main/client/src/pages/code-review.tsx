import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Code, FileCode, GitBranch, AlertTriangle, CheckCircle, 
  XCircle, Info, Lightbulb, Shield, Zap, Clock, 
  Bug, Sparkles, FileText, ExternalLink, Loader2,
  Download, History, Trash2, FileDown
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CodeIssue {
  type: 'error' | 'warning' | 'suggestion' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  column: number;
  message: string;
  suggestion?: string;
  file: string;
  category: string;
}

interface ReviewResult {
  overallScore: number;
  codeQuality: number;
  security: number;
  performance: number;
  maintainability: number;
  testCoverage: number;
  issues: CodeIssue[];
  suggestions: string[];
  positives: string[];
  metrics: {
    linesOfCode: number;
    complexity: number;
    duplications: number;
    technicalDebt: string;
  };
}

interface SavedReview {
  id: string;
  type: string;
  content: string;
  repositoryName?: string;
  repositoryUrl?: string;
  overallScore: number;
  codeQuality: number;
  security: number;
  performance: number;
  maintainability: number;
  testCoverage: number;
  issues: CodeIssue[];
  suggestions: string[];
  positives: string[];
  metrics: {
    linesOfCode: number;
    complexity: number;
    duplications: number;
    technicalDebt: string;
  };
  createdAt: string;
}

export default function CodeReview() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [repoUrl, setRepoUrl] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [activeTab, setActiveTab] = useState("repository");
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [viewCodeDialog, setViewCodeDialog] = useState<{
    open: boolean;
    content?: string;
    filePath?: string;
    line?: number;
    fileUrl?: string;
  }>({ open: false });
  
  // Get GitHub token from user profile
  const githubToken = (user as any)?.githubToken || "";

  // Fetch review history
  const { data: reviewHistory, refetch: refetchHistory } = useQuery<SavedReview[]>({
    queryKey: ['/api/code-review/history'],
    enabled: isAuthenticated && showHistory,
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { type: string; content: string; githubToken?: string }) => {
      const response = await fetch('/api/code-review/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze code');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setReviewResult(data);
      setCurrentReviewId(null); // Reset review ID for new review
      toast({ 
        title: "Code review completed", 
        description: `Found ${data.issues.length} issues to address` 
      });
    },
    onError: (error: Error) => {
      console.error('[Code Review] Error:', error);
      toast({ 
        title: "Review failed", 
        description: error.message || "Unable to complete code review",
        variant: "destructive" 
      });
    },
  });

  const saveReviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewResult) throw new Error('No review to save');
      
      const parsed = repoUrl ? githubService.parseRepositoryUrl(repoUrl) : null;
      
      const response = await fetch('/api/code-review/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          content: activeTab === 'repository' ? repoUrl : codeSnippet,
          repositoryName: parsed?.repo,
          repositoryUrl: repoUrl || undefined,
          result: reviewResult,
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save review');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setCurrentReviewId(data.id);
      refetchHistory();
      toast({
        title: "Review saved",
        description: "Code review has been saved to your history"
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Unable to save code review",
        variant: "destructive"
      });
    }
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await fetch(`/api/code-review/${reviewId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete review');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      refetchHistory();
      toast({
        title: "Review deleted",
        description: "Code review has been removed from your history"
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Unable to delete code review",
        variant: "destructive"
      });
    }
  });

  const viewCodeMutation = useMutation({
    mutationFn: async (data: { repoUrl: string; filePath: string; line?: number; githubToken?: string }) => {
      const response = await fetch('/api/code-review/view-code', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch code');
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      setViewCodeDialog({
        open: true,
        content: data.content,
        filePath: data.filePath,
        line: data.line,
        fileUrl: data.fileUrl
      });
    },
    onError: () => {
      toast({
        title: "Failed to load code",
        description: "Unable to fetch file content from GitHub",
        variant: "destructive"
      });
    }
  });

  const createFixMutation = useMutation({
    mutationFn: async (data: {
      repoUrl: string;
      filePath: string;
      line?: number;
      issue: string;
      suggestion?: string;
      githubToken: string;
    }) => {
      const response = await fetch('/api/code-review/create-fix', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Pull request created!",
        description: (
          <div className="flex flex-col gap-2">
            <p>AI-generated fix has been submitted as PR #{data.pullRequest.number}</p>
            <a 
              href={data.pullRequest.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline flex items-center gap-1"
            >
              View on GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )
      });
    },
    onError: (error: any) => {
      const message = error?.requiresAuth 
        ? "Please provide a GitHub token to create pull requests"
        : "Failed to create pull request";
      
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    }
  });

  const startReview = () => {
    if (activeTab === "repository" && repoUrl) {
      reviewMutation.mutate({ 
        type: "repository", 
        content: repoUrl,
        githubToken: githubToken || undefined
      });
    } else if (activeTab === "snippet" && codeSnippet) {
      reviewMutation.mutate({ 
        type: "snippet", 
        content: codeSnippet 
      });
    }
  };

  const loadReview = (review: SavedReview) => {
    setReviewResult({
      overallScore: review.overallScore,
      codeQuality: review.codeQuality,
      security: review.security,
      performance: review.performance,
      maintainability: review.maintainability,
      testCoverage: review.testCoverage,
      issues: review.issues,
      suggestions: review.suggestions,
      positives: review.positives,
      metrics: review.metrics,
    });
    setCurrentReviewId(review.id);
    setActiveTab(review.type);
    if (review.type === 'repository' && review.repositoryUrl) {
      setRepoUrl(review.repositoryUrl);
    } else if (review.type === 'snippet') {
      setCodeSnippet(review.content);
    }
    setShowHistory(false);
    toast({
      title: "Review loaded",
      description: "Previous code review has been loaded"
    });
  };

  const exportToPDF = async () => {
    if (!reviewResult) return;
    
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = margin;

    // Title
    pdf.setFontSize(20);
    pdf.setTextColor(99, 102, 241);
    pdf.text('Code Review Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Repository/Snippet info
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    if (activeTab === 'repository' && repoUrl) {
      const parsed = githubService.parseRepositoryUrl(repoUrl);
      pdf.text(`Repository: ${parsed?.owner}/${parsed?.repo}`, margin, yPosition);
    } else {
      pdf.text('Code Snippet Review', margin, yPosition);
    }
    yPosition += 10;

    // Date
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Review Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 15;

    // Scores
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Scores', margin, yPosition);
    yPosition += 10;

    const scores = [
      { name: 'Overall', value: reviewResult.overallScore },
      { name: 'Code Quality', value: reviewResult.codeQuality },
      { name: 'Security', value: reviewResult.security },
      { name: 'Performance', value: reviewResult.performance },
      { name: 'Maintainability', value: reviewResult.maintainability },
      { name: 'Test Coverage', value: reviewResult.testCoverage },
    ];

    pdf.setFontSize(10);
    scores.forEach(score => {
      pdf.setTextColor(0, 0, 0);
      pdf.text(score.name, margin, yPosition);
      
      const color = score.value >= 80 ? [34, 197, 94] : score.value >= 60 ? [251, 191, 36] : [239, 68, 68];
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(margin + 40, yPosition - 4, (score.value / 100) * 40, 6, 'F');
      pdf.text(`${score.value}/100`, margin + 85, yPosition);
      yPosition += 8;
    });
    yPosition += 10;

    // Issues
    if (reviewResult.issues.length > 0) {
      pdf.setFontSize(14);
      pdf.text(`Issues (${reviewResult.issues.length})`, margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(9);
      reviewResult.issues.slice(0, 10).forEach(issue => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.setTextColor(0, 0, 0);
        const lines = pdf.splitTextToSize(`• ${issue.message}`, pageWidth - margin * 2);
        pdf.text(lines, margin + 2, yPosition);
        yPosition += lines.length * 5 + 2;
      });
      yPosition += 5;
    }

    // Suggestions
    if (reviewResult.suggestions.length > 0) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.setFontSize(14);
      pdf.text('Suggestions', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(9);
      reviewResult.suggestions.forEach(suggestion => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = margin;
        }
        const lines = pdf.splitTextToSize(`• ${suggestion}`, pageWidth - margin * 2);
        pdf.text(lines, margin + 2, yPosition);
        yPosition += lines.length * 5 + 2;
      });
    }

    const fileName = activeTab === 'repository' && repoUrl
      ? `code_review_${githubService.parseRepositoryUrl(repoUrl)?.repo}_${new Date().toISOString().split('T')[0]}.pdf`
      : `code_review_${new Date().toISOString().split('T')[0]}.pdf`;
    
    pdf.save(fileName);
    
    toast({
      title: "Export successful",
      description: "Code review exported as PDF"
    });
  };

  const exportToMarkdown = () => {
    if (!reviewResult) return;

    let markdown = '# Code Review Report\n\n';
    
    if (activeTab === 'repository' && repoUrl) {
      const parsed = githubService.parseRepositoryUrl(repoUrl);
      markdown += `**Repository:** ${parsed?.owner}/${parsed?.repo}\n`;
      markdown += `**URL:** ${repoUrl}\n\n`;
    } else {
      markdown += '**Type:** Code Snippet\n\n';
    }

    markdown += `**Review Date:** ${new Date().toLocaleDateString()}\n\n`;

    markdown += '## Scores\n\n';
    markdown += `- Overall: ${reviewResult.overallScore}/100\n`;
    markdown += `- Code Quality: ${reviewResult.codeQuality}/100\n`;
    markdown += `- Security: ${reviewResult.security}/100\n`;
    markdown += `- Performance: ${reviewResult.performance}/100\n`;
    markdown += `- Maintainability: ${reviewResult.maintainability}/100\n`;
    markdown += `- Test Coverage: ${reviewResult.testCoverage}%\n\n`;

    if (reviewResult.issues.length > 0) {
      markdown += `## Issues (${reviewResult.issues.length})\n\n`;
      reviewResult.issues.forEach((issue, idx) => {
        markdown += `### ${idx + 1}. ${issue.message}\n\n`;
        markdown += `- **Type:** ${issue.type}\n`;
        markdown += `- **Severity:** ${issue.severity}\n`;
        markdown += `- **File:** ${issue.file}:${issue.line}:${issue.column}\n`;
        markdown += `- **Category:** ${issue.category}\n`;
        if (issue.suggestion) {
          markdown += `- **Suggestion:** ${issue.suggestion}\n`;
        }
        markdown += '\n';
      });
    }

    if (reviewResult.suggestions.length > 0) {
      markdown += '## Suggestions\n\n';
      reviewResult.suggestions.forEach(suggestion => {
        markdown += `- ${suggestion}\n`;
      });
      markdown += '\n';
    }

    if (reviewResult.positives.length > 0) {
      markdown += '## Positives\n\n';
      reviewResult.positives.forEach(positive => {
        markdown += `- ${positive}\n`;
      });
      markdown += '\n';
    }

    markdown += '## Metrics\n\n';
    markdown += `- Lines of Code: ${reviewResult.metrics.linesOfCode}\n`;
    markdown += `- Complexity: ${reviewResult.metrics.complexity}\n`;
    markdown += `- Duplications: ${reviewResult.metrics.duplications}\n`;
    markdown += `- Technical Debt: ${reviewResult.metrics.technicalDebt}\n`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const fileName = activeTab === 'repository' && repoUrl
      ? `code_review_${githubService.parseRepositoryUrl(repoUrl)?.repo}_${new Date().toISOString().split('T')[0]}.md`
      : `code_review_${new Date().toISOString().split('T')[0]}.md`;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Code review exported as Markdown"
    });
  };

  // Helper to parse GitHub URLs
  const githubService = {
    parseRepositoryUrl: (url: string) => {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
      }
      return null;
    }
  };

  const handleViewCode = (issue: CodeIssue) => {
    if (!repoUrl) {
      toast({
        title: "Repository URL required",
        description: "Please analyze a repository first",
        variant: "destructive"
      });
      return;
    }
    
    viewCodeMutation.mutate({
      repoUrl,
      filePath: issue.file,
      line: issue.line,
      githubToken: githubToken || undefined
    });
  };

  const handleCreateFix = (issue: CodeIssue) => {
    if (!repoUrl) {
      toast({
        title: "Repository URL required",
        description: "Please analyze a repository first",
        variant: "destructive"
      });
      return;
    }

    if (!githubToken) {
      toast({
        title: "GitHub token required",
        description: "Please provide a GitHub personal access token to create pull requests",
        variant: "destructive"
      });
      return;
    }
    
    createFixMutation.mutate({
      repoUrl,
      filePath: issue.file,
      line: issue.line,
      issue: issue.message,
      suggestion: issue.suggestion,
      githubToken
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'suggestion': return <Lightbulb className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Header />
      <div className="container mx-auto p-6 max-w-7xl pt-24">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              AI-Powered Code Review
            </h1>
            <p className="text-muted-foreground">
              Get comprehensive code analysis with AI-driven insights and recommendations
            </p>
          </div>
          <div className="flex gap-2">
            {isAuthenticated && (
              <Button
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-4 w-4 mr-2" />
                {showHistory ? 'Hide' : 'Show'} History
              </Button>
            )}
            {reviewResult && (
              <>
                {isAuthenticated && !currentReviewId && (
                  <Button
                    variant="outline"
                    onClick={() => saveReviewMutation.mutate()}
                    disabled={saveReviewMutation.isPending}
                  >
                    {saveReviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    Save Review
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={exportToPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToMarkdown}>
                      <FileCode className="h-4 w-4 mr-2" />
                      Export as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

      {showHistory && isAuthenticated && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Review History</CardTitle>
            <CardDescription>
              Your past code reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {reviewHistory && reviewHistory.length > 0 ? (
                <div className="space-y-3">
                  {reviewHistory.map((review) => (
                    <Card key={review.id} className="p-4 hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1" onClick={() => loadReview(review)}>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={review.type === 'repository' ? 'default' : 'secondary'}>
                              {review.type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="font-medium mb-1">
                            {review.repositoryName || 'Code Snippet'}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span>Score: {review.overallScore}/100</span>
                            <span>{review.issues.length} issues</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteReviewMutation.mutate(review.id);
                          }}
                          disabled={deleteReviewMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No saved reviews yet</p>
                  <p className="text-sm">Complete a review and save it to see it here</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Start Review</CardTitle>
              <CardDescription>
                Analyze a repository or code snippet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="repository">Repository</TabsTrigger>
                  <TabsTrigger value="snippet">Code Snippet</TabsTrigger>
                </TabsList>
                
                <TabsContent value="repository" className="space-y-4">
                  <div>
                    <Label htmlFor="repo-url">Repository URL</Label>
                    <Input
                      id="repo-url"
                      type="url"
                      placeholder="https://github.com/user/repo"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                    />
                  </div>
                  {githubToken ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <span className="font-medium">✓ GitHub token added</span> — "View Code" and "Create Fix" features are enabled.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-amber-200 bg-amber-50">
                      <Info className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-900">
                        <span className="font-medium">GitHub token not configured.</span> Add one in your{" "}
                        <Link href="/profile">
                          <span className="text-amber-900 font-semibold hover:underline cursor-pointer">
                            profile settings
                          </span>
                        </Link>
                        {" "}to enable "View Code" and "Create Fix" features.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Enter a public GitHub repository URL for comprehensive analysis
                    </AlertDescription>
                  </Alert>
                </TabsContent>
                
                <TabsContent value="snippet" className="space-y-4">
                  <div>
                    <Label htmlFor="code">Code Snippet</Label>
                    <Textarea
                      id="code"
                      placeholder="Paste your code here..."
                      value={codeSnippet}
                      onChange={(e) => setCodeSnippet(e.target.value)}
                      className="h-64 font-mono text-sm"
                    />
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Paste code for quick analysis and suggestions
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
              
              <Button 
                className="w-full mt-4"
                onClick={startReview}
                disabled={reviewMutation.isPending || (!repoUrl && !codeSnippet)}
              >
                {reviewMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start AI Review
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {reviewResult && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Review Metrics</CardTitle>
                <CardDescription>
                  Comprehensive quality assessment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Overall Score</span>
                    <span className="font-bold">{reviewResult.overallScore}/100</span>
                  </div>
                  <Progress value={reviewResult.overallScore} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {reviewResult.overallScore >= 80 ? '✓ Excellent - Production ready' :
                     reviewResult.overallScore >= 60 ? '⚠ Good - Minor improvements needed' :
                     reviewResult.overallScore >= 40 ? '⚠ Fair - Several issues to address' :
                     '✗ Poor - Major refactoring recommended'}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Code Quality</span>
                    <span className="font-bold">{reviewResult.codeQuality}/100</span>
                  </div>
                  <Progress value={reviewResult.codeQuality} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Readability, structure, and best practices
                  </p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Security</span>
                    <span className="font-bold">{reviewResult.security}/100</span>
                  </div>
                  <Progress value={reviewResult.security} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Vulnerabilities and security best practices
                  </p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Performance</span>
                    <span className="font-bold">{reviewResult.performance}/100</span>
                  </div>
                  <Progress value={reviewResult.performance} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Efficiency and optimization opportunities
                  </p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Maintainability</span>
                    <span className="font-bold">{reviewResult.maintainability}/100</span>
                  </div>
                  <Progress value={reviewResult.maintainability} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Ease of future changes and updates
                  </p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Test Coverage</span>
                    <span className="font-bold">{reviewResult.testCoverage}%</span>
                  </div>
                  <Progress value={reviewResult.testCoverage} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {reviewResult.testCoverage >= 80 ? 'Excellent coverage' :
                     reviewResult.testCoverage >= 60 ? 'Good coverage' :
                     reviewResult.testCoverage >= 40 ? 'Needs more tests' :
                     'Critical - Add tests'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          {reviewResult ? (
            <Tabs defaultValue="issues" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="issues">
                  Issues ({reviewResult.issues.length})
                </TabsTrigger>
                <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
                <TabsTrigger value="positives">Positives</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
              </TabsList>

              <TabsContent value="issues">
                <Card>
                  <CardHeader>
                    <CardTitle>Code Issues</CardTitle>
                    <CardDescription>
                      Problems and improvements found in your code
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px]">
                      <Accordion type="single" collapsible className="space-y-2">
                        {reviewResult.issues.map((issue, index) => (
                          <AccordionItem key={index} value={`issue-${index}`}>
                            <AccordionTrigger>
                              <div className="flex items-center gap-3 text-left">
                                {getTypeIcon(issue.type)}
                                <div className="flex-1">
                                  <div className="font-medium">{issue.message}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className={getSeverityColor(issue.severity)}>
                                      {issue.severity}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {issue.file}:{issue.line}:{issue.column}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3 pt-3">
                                <div>
                                  <p className="text-sm font-medium mb-1">Category</p>
                                  <Badge variant="outline">{issue.category}</Badge>
                                </div>
                                {issue.suggestion && (
                                  <div>
                                    <p className="text-sm font-medium mb-1">Suggestion</p>
                                    <p className="text-sm text-muted-foreground">
                                      {issue.suggestion}
                                    </p>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleViewCode(issue)}
                                    disabled={viewCodeMutation.isPending}
                                  >
                                    {viewCodeMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <FileCode className="h-4 w-4 mr-2" />
                                    )}
                                    View Code
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleCreateFix(issue)}
                                    disabled={createFixMutation.isPending || !githubToken}
                                  >
                                    {createFixMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <GitBranch className="h-4 w-4 mr-2" />
                                    )}
                                    Create Fix
                                  </Button>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="suggestions">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Recommendations</CardTitle>
                    <CardDescription>
                      Suggestions to improve your codebase
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reviewResult.suggestions.map((suggestion, index) => (
                        <Alert key={index}>
                          <Lightbulb className="h-4 w-4" />
                          <AlertDescription>{suggestion}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="positives">
                <Card>
                  <CardHeader>
                    <CardTitle>What's Working Well</CardTitle>
                    <CardDescription>
                      Positive aspects of your code
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reviewResult.positives.map((positive, index) => (
                        <Alert key={index}>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription>{positive}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metrics">
                <Card>
                  <CardHeader>
                    <CardTitle>Code Metrics</CardTitle>
                    <CardDescription>
                      Detailed metrics about your codebase
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Total Lines of Code</span>
                        </div>
                        <p className="text-3xl font-bold">
                          {reviewResult.metrics.linesOfCode.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total lines across all analyzed files
                        </p>
                      </div>
                      <div className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Cyclomatic Complexity</span>
                        </div>
                        <p className="text-3xl font-bold">
                          {reviewResult.metrics.complexity}
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            {reviewResult.metrics.complexity <= 10 ? '(Simple)' :
                             reviewResult.metrics.complexity <= 20 ? '(Moderate)' :
                             reviewResult.metrics.complexity <= 50 ? '(Complex)' :
                             '(Very Complex)'}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Average complexity per function. Lower is better.
                        </p>
                      </div>
                      <div className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Bug className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Code Duplications</span>
                        </div>
                        <p className="text-3xl font-bold">
                          {reviewResult.metrics.duplications}
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            {reviewResult.metrics.duplications === 0 ? '(None)' :
                             reviewResult.metrics.duplications <= 5 ? '(Low)' :
                             reviewResult.metrics.duplications <= 15 ? '(Moderate)' :
                             '(High)'}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Number of duplicated code blocks found
                        </p>
                      </div>
                      <div className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Technical Debt</span>
                        </div>
                        <p className="text-3xl font-bold">{reviewResult.metrics.technicalDebt}</p>
                        <p className="text-xs text-muted-foreground">
                          Estimated time to fix all issues
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-16">
                <Code className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Review Yet</h3>
                <p className="text-muted-foreground">
                  Enter a repository URL or code snippet to start the AI-powered review
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Code Viewer Dialog */}
      <Dialog open={viewCodeDialog.open} onOpenChange={(open) => setViewCodeDialog({ open })}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{viewCodeDialog.filePath}</span>
              {viewCodeDialog.fileUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a
                    href={viewCodeDialog.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on GitHub
                  </a>
                </Button>
              )}
            </DialogTitle>
            {viewCodeDialog.line && (
              <DialogDescription>
                Line {viewCodeDialog.line}
              </DialogDescription>
            )}
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border">
            <pre className="p-4 text-sm">
              <code className="language-javascript">
                {viewCodeDialog.content?.split('\n').map((line, idx) => (
                  <div
                    key={idx}
                    className={`${
                      viewCodeDialog.line && idx + 1 === viewCodeDialog.line
                        ? 'bg-yellow-100 dark:bg-yellow-900/20'
                        : ''
                    }`}
                  >
                    <span className="inline-block w-12 text-right pr-4 text-muted-foreground select-none">
                      {idx + 1}
                    </span>
                    {line}
                  </div>
                ))}
              </code>
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}