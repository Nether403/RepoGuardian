import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Header } from "@/components/layout/Header";
import { PageWithBackground } from "@/components/layout/PageWithBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { ProgressIndicator } from "@/components/progress-indicator";
import { AnalysisRadarChart, LanguageDistributionChart } from "@/components/analysis-chart";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { trackRepositoryAnalysis, trackExport, trackPageView } from "@/lib/analytics";

export default function Analyze() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Get URL from query params on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlParam = urlParams.get('url');
    if (urlParam) {
      setUrl(decodeURIComponent(urlParam));
    }
    
    // Track page view
    trackPageView('/analyze');
  }, []);

  const analyzeRepositoryMutation = useMutation({
    mutationFn: async (repositoryUrl: string) => {
      console.log('Mutation starting for URL:', repositoryUrl);
      setIsAnalyzing(true);
      const response = await apiRequest('POST', '/api/repositories/analyze', { url: repositoryUrl });
      const data = await response.json();
      console.log('API Response received:', data);
      return data;
    },
    onSuccess: (data: any) => {
      console.log('Analysis SUCCESS - data received:', data);
      
      if (!data || !data.repository) {
        console.log('Incomplete analysis data');
        toast({
          title: "Incomplete Analysis",
          description: "The analysis was incomplete. Please try again.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }
      
      console.log('Setting analysis state...');
      console.log('Analysis object:', data.analysis);
      
      // Ensure we have valid analysis data
      const analysisData = data.analysis || {};
      
      // Validate that we have the required fields
      if (!analysisData.summary || !analysisData.strengths || !analysisData.recommendations) {
        console.warn('Analysis data is missing required fields:', {
          hasSummary: !!analysisData.summary,
          hasStrengths: !!analysisData.strengths,
          hasRecommendations: !!analysisData.recommendations
        });
      }
      
      // Flatten the data structure - spread analysis properties to top level
      const flattenedData = {
        repository: data.repository,
        similar: data.similar,
        // Spread all analysis properties to top level for easier access
        originality: analysisData.originality || 0,
        completeness: analysisData.completeness || 0,
        marketability: analysisData.marketability || 0,
        monetization: analysisData.monetization || 0,
        usefulness: analysisData.usefulness || 0,
        overallScore: analysisData.overallScore || 0,
        summary: analysisData.summary || 'No summary available',
        strengths: analysisData.strengths || [],
        weaknesses: analysisData.weaknesses || [],
        recommendations: analysisData.recommendations || [],
        scoreExplanations: analysisData.scoreExplanations || {},
        // Keep original analysis object for components that expect it
        analysis: analysisData,
      };
      
      console.log('Flattened data:', {
        hasStrengths: flattenedData.strengths?.length,
        hasWeaknesses: flattenedData.weaknesses?.length,
        hasRecommendations: flattenedData.recommendations?.length
      });
      
      setAnalysis(flattenedData);
      setIsAnalyzing(false);
      setIsSaved(data.isSaved || false);
      toast({
        title: "Analysis Complete",
        description: "Repository has been analyzed successfully.",
      });
      
      // Track successful analysis
      trackRepositoryAnalysis(url, true, {
        repositoryName: data.repository?.fullName,
        language: data.repository?.language,
        stars: data.repository?.stars,
        overallScore: flattenedData.overallScore,
      });
    },
    onError: (error: Error) => {
      console.log('Analysis ERROR:', error);
      setIsAnalyzing(false);
      if (isUnauthorizedError(error)) {
        console.log('Unauthorized error - redirecting to login');
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      console.log('Regular error - showing toast');
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze repository. Please try again.",
        variant: "destructive",
      });
      
      // Track failed analysis
      trackRepositoryAnalysis(url, false, {
        errorMessage: error.message,
      });
    },
  });

  const handleAnalyze = (e: React.FormEvent) => {
    console.log('Form submitted, preventing default...');
    e.preventDefault();
    
    console.log('URL to analyze:', url.trim());
    
    if (!url.trim()) {
      console.log('No URL provided');
      toast({
        title: "URL Required",
        description: "Please enter a GitHub repository URL.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Starting analysis...');
    // Clear any previous analysis
    setAnalysis(null);
    analyzeRepositoryMutation.mutate(url.trim());
  };

  const saveRepositoryMutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      await apiRequest('POST', '/api/saved-repositories', { repositoryId });
    },
    onSuccess: () => {
      setIsSaved(true);
      toast({
        title: "Repository Saved",
        description: "Repository has been added to your saved list.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-repositories'] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Please Log In",
          description: "You need to log in to save repositories.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: "Failed to save repository. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unsaveRepositoryMutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      await apiRequest('DELETE', `/api/saved-repositories/${repositoryId}`);
    },
    onSuccess: () => {
      setIsSaved(false);
      toast({
        title: "Repository Unsaved",
        description: "Repository has been removed from your saved list.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-repositories'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to unsave repository. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-400";
    if (score >= 6) return "text-yellow-400";
    return "text-red-400";
  };

  const generatePDFReport = async () => {
    if (!analysis) return;
    
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;
      
      // Header with gradient background
      pdf.setFillColor(59, 130, 246); // Primary color
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('Repository Analysis Report', pageWidth / 2, 20, { align: 'center' });
      
      // Repository name
      pdf.setFontSize(14);
      pdf.text(analysis.repository?.name || 'Unknown Repository', pageWidth / 2, 30, { align: 'center' });
      
      yPosition = 50;
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
      
      // Repository Info Section
      pdf.setFontSize(16);
      pdf.setFont(undefined as any, 'bold');
      pdf.text('Repository Information', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont(undefined as any, 'normal');
      
      const repoInfo = [
        `Name: ${analysis.repository?.name || 'N/A'}`,
        `Description: ${analysis.repository?.description || 'No description available'}`,
        `Language: ${analysis.repository?.language || 'N/A'}`,
        `Stars: ${analysis.repository?.stars || 0}`,
        `Forks: ${analysis.repository?.forks || 0}`,
        `Last Updated: ${analysis.repository?.updatedAt ? new Date(analysis.repository.updatedAt).toLocaleDateString() : 'N/A'}`
      ];
      
      repoInfo.forEach(info => {
        const lines = pdf.splitTextToSize(info, pageWidth - 2 * margin);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin, yPosition);
          yPosition += 6;
        });
      });
      
      yPosition += 5;
      
      // Analysis Summary
      pdf.setFontSize(16);
      pdf.setFont(undefined as any, 'bold');
      pdf.text('Analysis Summary', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont(undefined as any, 'normal');
      const summaryLines = pdf.splitTextToSize(analysis.summary || 'No summary available', pageWidth - 2 * margin);
      summaryLines.forEach((line: string) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 6;
      });
      
      yPosition += 10;
      
      // Scores Section
      pdf.setFontSize(16);
      pdf.setFont(undefined as any, 'bold');
      pdf.text('Analysis Scores', margin, yPosition);
      yPosition += 10;
      
      const scores = [
        { label: 'Originality', value: analysis.originality, explanation: analysis.scoreExplanations?.originality },
        { label: 'Completeness', value: analysis.completeness, explanation: analysis.scoreExplanations?.completeness },
        { label: 'Marketability', value: analysis.marketability, explanation: analysis.scoreExplanations?.marketability },
        { label: 'Monetization', value: analysis.monetization, explanation: analysis.scoreExplanations?.monetization },
        { label: 'Usefulness', value: analysis.usefulness, explanation: analysis.scoreExplanations?.usefulness },
        { label: 'Overall Score', value: analysis.overallScore, explanation: null }
      ];
      
      scores.forEach(({ label, value, explanation }) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // Score label and value
        pdf.setFont(undefined as any, 'bold');
        pdf.text(`${label}: ${value?.toFixed(1)}/10`, margin, yPosition);
        yPosition += 6;
        
        // Score bar
        const barWidth = 50;
        const barHeight = 4;
        pdf.setFillColor(230, 230, 230);
        pdf.rect(margin, yPosition - 3, barWidth, barHeight, 'F');
        
        // Filled portion
        const fillColor = value >= 8 ? [34, 197, 94] : value >= 6 ? [59, 130, 246] : value >= 4 ? [251, 191, 36] : [239, 68, 68];
        pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        pdf.rect(margin, yPosition - 3, (value / 10) * barWidth, barHeight, 'F');
        yPosition += 5;
        
        // Explanation if available
        if (explanation) {
          pdf.setFont(undefined as any, 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          const explainLines = pdf.splitTextToSize(explanation, pageWidth - 2 * margin - 10);
          explainLines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(11);
        }
        
        yPosition += 3;
      });
      
      // Check if we need a new page for strengths
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = margin;
      }
      
      yPosition += 5;
      
      // Strengths Section
      pdf.setFontSize(16);
      pdf.setFont(undefined as any, 'bold');
      pdf.text('Key Strengths', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont(undefined as any, 'normal');
      analysis.strengths?.forEach((strength: any) => {
        const point = typeof strength === 'string' ? strength : strength.point;
        const reason = typeof strength === 'object' ? strength.reason : null;
        
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }
        
        pdf.setFont(undefined as any, 'bold');
        pdf.text('• ', margin, yPosition);
        const pointLines = pdf.splitTextToSize(point, pageWidth - 2 * margin - 10);
        pointLines.forEach((line: string, index: number) => {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin + (index === 0 ? 5 : 0), yPosition);
          yPosition += 6;
        });
        
        if (reason) {
          pdf.setFont(undefined as any, 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          const reasonLines = pdf.splitTextToSize(reason, pageWidth - 2 * margin - 10);
          reasonLines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(11);
        }
        
        yPosition += 2;
      });
      
      // Check if we need a new page for weaknesses
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = margin;
      }
      
      yPosition += 5;
      
      // Weaknesses Section
      pdf.setFontSize(16);
      pdf.setFont(undefined as any, 'bold');
      pdf.text('Areas for Improvement', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont(undefined as any, 'normal');
      analysis.weaknesses?.forEach((weakness: any) => {
        const point = typeof weakness === 'string' ? weakness : weakness.point;
        const reason = typeof weakness === 'object' ? weakness.reason : null;
        
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }
        
        pdf.setFont(undefined as any, 'bold');
        pdf.text('• ', margin, yPosition);
        const pointLines = pdf.splitTextToSize(point, pageWidth - 2 * margin - 10);
        pointLines.forEach((line: string, index: number) => {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin + (index === 0 ? 5 : 0), yPosition);
          yPosition += 6;
        });
        
        if (reason) {
          pdf.setFont(undefined as any, 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          const reasonLines = pdf.splitTextToSize(reason, pageWidth - 2 * margin - 10);
          reasonLines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(11);
        }
        
        yPosition += 2;
      });
      
      // Check if we need a new page for recommendations
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = margin;
      }
      
      yPosition += 5;
      
      // Recommendations Section
      pdf.setFontSize(16);
      pdf.setFont(undefined as any, 'bold');
      pdf.text('Recommendations', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont(undefined as any, 'normal');
      analysis.recommendations?.forEach((rec: any) => {
        const suggestion = typeof rec === 'string' ? rec : rec.suggestion;
        const reason = typeof rec === 'object' ? rec.reason : null;
        const impact = typeof rec === 'object' ? rec.impact : null;
        
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = margin;
        }
        
        pdf.setFont(undefined as any, 'bold');
        pdf.text('• ', margin, yPosition);
        const suggestionLines = pdf.splitTextToSize(suggestion, pageWidth - 2 * margin - 10);
        suggestionLines.forEach((line: string, index: number) => {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin + (index === 0 ? 5 : 0), yPosition);
          yPosition += 6;
        });
        
        if (reason) {
          pdf.setFont(undefined as any, 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          const reasonLines = pdf.splitTextToSize(`Why: ${reason}`, pageWidth - 2 * margin - 10);
          reasonLines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
        }
        
        if (impact) {
          pdf.setTextColor(34, 197, 94);
          const impactLines = pdf.splitTextToSize(`Impact: ${impact}`, pageWidth - 2 * margin - 10);
          impactLines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        yPosition += 2;
      });
      
      // Footer on last page
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated on ${new Date().toLocaleDateString()} by RepoAnalyzer`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Save the PDF
      const fileName = `${analysis.repository?.name || 'repository'}-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "PDF Generated",
        description: `Report saved as ${fileName}`,
      });
      
      // Track successful export
      trackExport('pdf', 'analysis', true, {
        repositoryName: analysis.repository?.name,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Failed",
        description: "Unable to generate PDF report. Please try again.",
        variant: "destructive",
      });
      
      // Track failed export
      trackExport('pdf', 'analysis', false, {
        repositoryName: analysis.repository?.name,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getScoreGradient = (score: number) => {
    if (score >= 8) return "from-green-400 to-blue-500";
    if (score >= 6) return "from-yellow-400 to-orange-500";
    return "from-red-400 to-pink-500";
  };

  const exportToPDF = async () => {
    if (!analysis) return;
    
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Title
    pdf.setFontSize(20);
    pdf.text('Repository Analysis Report', pageWidth / 2, 20, { align: 'center' });
    
    // Repository Info
    pdf.setFontSize(16);
    pdf.text(analysis.repository?.fullName || 'Unknown Repository', 20, 40);
    
    pdf.setFontSize(12);
    pdf.text(`Overall Score: ${analysis?.overallScore?.toFixed(1) || 'N/A'}`, 20, 50);
    pdf.text(`Language: ${analysis.repository?.language || 'Unknown'}`, 20, 60);
    pdf.text(`Stars: ${analysis.repository?.stars?.toLocaleString() || 0}`, 20, 70);
    
    // Scores
    pdf.setFontSize(14);
    pdf.text('Analysis Scores:', 20, 90);
    pdf.setFontSize(12);
    pdf.text(`Originality: ${analysis?.originality || 0}/10`, 30, 100);
    pdf.text(`Completeness: ${analysis?.completeness || 0}/10`, 30, 110);
    pdf.text(`Marketability: ${analysis?.marketability || 0}/10`, 30, 120);
    pdf.text(`Monetization: ${analysis?.monetization || 0}/10`, 30, 130);
    pdf.text(`Usefulness: ${analysis?.usefulness || 0}/10`, 30, 140);
    
    // Summary
    pdf.setFontSize(14);
    pdf.text('Summary:', 20, 160);
    pdf.setFontSize(10);
    const summary = pdf.splitTextToSize(analysis?.summary || 'No summary available', pageWidth - 40);
    pdf.text(summary, 20, 170);
    
    // Save the PDF
    pdf.save(`${analysis.repository?.name || 'repository'}-analysis.pdf`);
    
    toast({
      title: "Export Successful",
      description: "Analysis report has been downloaded as PDF.",
    });
  };

  return (
    <PageWithBackground>
      <Header />
      
      {/* Analysis Section */}
      <section className="py-12 bg-gradient-to-r from-dark via-card to-dark">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              <span className="gradient-text">AI-Powered</span> Repository Analysis
            </h1>
            <p className="text-xl text-gray-300">Get comprehensive insights into any GitHub repository</p>
          </div>
          
          <Card className="bg-card/50 border border-border backdrop-blur-sm">
            <CardContent className="p-6">
              <form onSubmit={handleAnalyze} className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Enter GitHub repository URL (e.g., https://github.com/owner/repo)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-dark border border-border text-white placeholder-gray-400"
                    data-testid="input-analyze-url"
                    disabled={isAnalyzing}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!url.trim() || isAnalyzing}
                  className="bg-gradient-to-r from-accent to-primary hover:from-primary hover:to-accent px-8 py-2 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50"
                  data-testid="button-analyze"
                >
                  {isAnalyzing ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-robot mr-2"></i>
                      Analyze
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          {/* Progress Indicator */}
          <ProgressIndicator isAnalyzing={isAnalyzing} />
        </div>
      </section>

      {/* Results Section */}
      {analysis && (
        <section className="py-16 bg-dark">
          <div className="max-w-6xl mx-auto px-6">
            {/* Repository Info */}
            <Card className="bg-card border border-border mb-8">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      <i className="fab fa-github text-white text-2xl"></i>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold" data-testid="text-repo-name">
                        {analysis.repository?.name}
                      </h2>
                      <p className="text-lg text-gray-400" data-testid="text-repo-fullname">
                        {analysis.repository?.fullName}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="flex items-center space-x-1">
                          <i className="fas fa-star text-yellow-500"></i>
                          <span>{analysis.repository?.stars?.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <i className="fas fa-code-branch text-blue-400"></i>
                          <span>{analysis.repository?.forks?.toLocaleString()}</span>
                        </div>
                        {analysis.repository?.language && (
                          <Badge variant="secondary">{analysis.repository.language}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-bold ${getScoreColor(analysis?.overallScore || 0)} mb-2`}>
                      {analysis?.overallScore?.toFixed(1) || 'N/A'}
                    </div>
                    <p className="text-gray-400">Overall Score</p>
                    <div className="flex items-center justify-end space-x-2 mt-4">
                      <Button
                        onClick={exportToPDF}
                        variant="outline"
                        size="sm"
                        className="border-border text-gray-300 hover:bg-gray-800"
                        data-testid="button-export-pdf"
                      >
                        <i className="fas fa-download mr-2"></i>
                        Export PDF
                      </Button>
                      {isAuthenticated && analysis?.repository?.id && (
                        <Button
                          onClick={() => {
                            if (isSaved) {
                              unsaveRepositoryMutation.mutate(analysis.repository.id);
                            } else {
                              saveRepositoryMutation.mutate(analysis.repository.id);
                            }
                          }}
                          variant={isSaved ? "secondary" : "default"}
                          size="sm"
                          data-testid={isSaved ? "button-unsave" : "button-save"}
                        >
                          {isSaved ? (
                            <>
                              <i className="fas fa-bookmark mr-2"></i>
                              Saved
                            </>
                          ) : (
                            <>
                              <i className="far fa-bookmark mr-2"></i>
                              Save
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-300 leading-relaxed" data-testid="text-repo-description">
                  {analysis.repository?.description || 'No description available'}
                </p>
              </CardContent>
            </Card>

            {/* Enhanced Charts */}
            {analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <AnalysisRadarChart analysis={analysis} />
                <LanguageDistributionChart languages={analysis.repository?.languages} />
              </div>
            )}
            
            {/* Analysis Results */}
            {analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Scores with Explanations */}
                <Card className="bg-card border border-border">
                  <CardContent className="p-8">
                    <h3 className="text-2xl font-semibold mb-6">Analysis Scores</h3>
                    
                    <div className="space-y-6">
                      {[
                        { label: 'Originality', score: analysis?.originality, key: 'originality' },
                        { label: 'Completeness', score: analysis?.completeness, key: 'completeness' },
                        { label: 'Marketability', score: analysis?.marketability, key: 'marketability' },
                        { label: 'Monetization', score: analysis?.monetization, key: 'monetization' },
                        { label: 'Usefulness', score: analysis?.usefulness, key: 'usefulness' },
                      ].map(({ label, score, key }) => (
                        <div key={label} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 font-medium">{label}</span>
                            <div className="flex items-center space-x-3">
                              <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${getScoreGradient(score)}`}
                                  style={{ width: `${(score / 10) * 100}%` }}
                                ></div>
                              </div>
                              <span className={`font-bold text-lg ${getScoreColor(score)} min-w-[3rem] text-right`}>
                                {score?.toFixed(1)}
                              </span>
                            </div>
                          </div>
                          {analysis?.scoreExplanations?.[key] && (
                            <p className="text-sm text-gray-400 pl-4 border-l-2 border-gray-700">
                              {analysis.scoreExplanations[key]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Insights */}
                <Card className="bg-card border border-border">
                  <CardContent className="p-8">
                    <h3 className="text-2xl font-semibold mb-6">AI Insights</h3>
                    
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-lg font-semibold text-green-400 mb-3">Strengths</h4>
                        <ul className="space-y-4">
                          {analysis?.strengths?.map((strength: any, index: number) => (
                            <li key={index} className="space-y-1">
                              <div className="flex items-start space-x-3">
                                <i className="fas fa-check text-green-400 mt-1"></i>
                                <span className="text-gray-300 font-medium">
                                  {typeof strength === 'string' ? strength : strength.point}
                                </span>
                              </div>
                              {typeof strength === 'object' && strength.reason && (
                                <p className="text-sm text-gray-400 ml-8 pl-3 border-l-2 border-green-400/30">
                                  {strength.reason}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-yellow-400 mb-3">Areas for Improvement</h4>
                        <ul className="space-y-4">
                          {analysis?.weaknesses?.map((weakness: any, index: number) => (
                            <li key={index} className="space-y-1">
                              <div className="flex items-start space-x-3">
                                <i className="fas fa-exclamation-triangle text-yellow-400 mt-1"></i>
                                <span className="text-gray-300 font-medium">
                                  {typeof weakness === 'string' ? weakness : weakness.point}
                                </span>
                              </div>
                              {typeof weakness === 'object' && weakness.reason && (
                                <p className="text-sm text-gray-400 ml-8 pl-3 border-l-2 border-yellow-400/30">
                                  {weakness.reason}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary and Recommendations */}
                <Card className="bg-card border border-border lg:col-span-2">
                  <CardContent className="p-8">
                    <h3 className="text-2xl font-semibold mb-6">Summary & Recommendations</h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Summary</h4>
                        <p className="text-gray-300 leading-relaxed">
                          {analysis?.summary}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Recommendations</h4>
                        <ul className="space-y-4">
                          {analysis?.recommendations?.map((recommendation: any, index: number) => (
                            <li key={index} className="space-y-2">
                              <div className="flex items-start space-x-3">
                                <i className="fas fa-lightbulb text-blue-400 mt-1"></i>
                                <div className="flex-1">
                                  <span className="text-gray-300 font-medium block">
                                    {typeof recommendation === 'string' ? recommendation : recommendation.suggestion}
                                  </span>
                                  {typeof recommendation === 'object' && recommendation.reason && (
                                    <p className="text-sm text-gray-400 mt-1">
                                      <strong>Why:</strong> {recommendation.reason}
                                    </p>
                                  )}
                                  {typeof recommendation === 'object' && recommendation.impact && (
                                    <p className="text-sm text-green-400 mt-1">
                                      <strong>Impact:</strong> {recommendation.impact}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center justify-center space-x-4 mt-8 pt-6 border-t border-border">
                      {analysis.repository?.id && (
                        <Button
                          onClick={() => {
                            const repoId = analysis.repository?.id;
                            if (repoId) {
                              setLocation(`/repository/${repoId}`);
                            } else {
                              toast({
                                title: "Navigation Error",
                                description: "Unable to navigate to repository details.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="bg-primary hover:bg-primary/80 text-white"
                          data-testid="button-view-details"
                        >
                          <i className="fas fa-eye mr-2"></i>
                          View Full Details
                        </Button>
                      )}
                      <Button
                        onClick={generatePDFReport}
                        disabled={isGeneratingPDF}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        data-testid="button-export-pdf"
                      >
                        {isGeneratingPDF ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Generating...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-file-pdf mr-2"></i>
                            Export PDF
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          const repoId = analysis.repository?.id;
                          const repoUrl = analysis.repository?.htmlUrl;
                          if (repoId && repoUrl) {
                            window.location.href = `/discover?repoId=${repoId}&repoUrl=${encodeURIComponent(repoUrl)}`;
                          } else {
                            toast({
                              title: "Navigation Error", 
                              description: "Unable to find similar repositories.",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white"
                        data-testid="button-find-similar"
                      >
                        <i className="fas fa-search mr-2"></i>
                        Find Similar
                      </Button>
                      <Button
                        onClick={() => {
                          setAnalysis(null);
                          setUrl("");
                        }}
                        variant="outline"
                        className="border-border text-gray-300 hover:bg-gray-800"
                        data-testid="button-analyze-another"
                      >
                        <i className="fas fa-plus mr-2"></i>
                        Analyze Another
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>
      )}
    </PageWithBackground>
  );
}