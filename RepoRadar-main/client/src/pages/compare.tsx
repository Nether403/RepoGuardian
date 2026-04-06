import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Compare() {
  const { toast } = useToast();
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [repoA, setRepoA] = useState<any>(null);
  const [repoB, setRepoB] = useState<any>(null);
  const [isAnalyzingA, setIsAnalyzingA] = useState(false);
  const [isAnalyzingB, setIsAnalyzingB] = useState(false);

  const analyzeRepositoryA = useMutation({
    mutationFn: async (url: string) => {
      setIsAnalyzingA(true);
      const response = await apiRequest('POST', '/api/repositories/analyze', { url });
      return response;
    },
    onSuccess: (data: any) => {
      setRepoA(data);
      setIsAnalyzingA(false);
      toast({
        title: "Repository A Analyzed",
        description: "First repository has been analyzed successfully.",
      });
    },
    onError: (error: Error) => {
      setIsAnalyzingA(false);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze repository A.",
        variant: "destructive",
      });
    },
  });

  const analyzeRepositoryB = useMutation({
    mutationFn: async (url: string) => {
      setIsAnalyzingB(true);
      const response = await apiRequest('POST', '/api/repositories/analyze', { url });
      return response;
    },
    onSuccess: (data: any) => {
      setRepoB(data);
      setIsAnalyzingB(false);
      toast({
        title: "Repository B Analyzed",
        description: "Second repository has been analyzed successfully.",
      });
    },
    onError: (error: Error) => {
      setIsAnalyzingB(false);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze repository B.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-dark text-white">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8 pt-32">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold gradient-text mb-4">Repository Comparison</h1>
          <p className="text-xl text-gray-400">Compare repositories side-by-side to make informed decisions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Repository A */}
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Repository A</h3>
              
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Enter GitHub repository URL"
                    value={urlA}
                    onChange={(e) => setUrlA(e.target.value)}
                    className="flex-1 bg-dark border border-border"
                    data-testid="input-repo-a"
                  />
                  <Button
                    onClick={() => urlA && analyzeRepositoryA.mutate(urlA)}
                    disabled={!urlA || isAnalyzingA}
                    data-testid="button-analyze-a"
                  >
                    {isAnalyzingA ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>

                {repoA && (
                  <div className="bg-dark rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                          <i className="fab fa-github text-white"></i>
                        </div>
                        <div>
                          <h4 className="font-medium" data-testid="text-repo-a-name">{repoA.repository?.name}</h4>
                          <p className="text-sm text-gray-400">{repoA.repository?.fullName}</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-400">
                        {repoA.analysis?.overallScore?.toFixed(1) || 'N/A'}
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{repoA.repository?.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Repository B */}
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Repository B</h3>
              
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Enter GitHub repository URL"
                    value={urlB}
                    onChange={(e) => setUrlB(e.target.value)}
                    className="flex-1 bg-dark border border-border"
                    data-testid="input-repo-b"
                  />
                  <Button
                    onClick={() => urlB && analyzeRepositoryB.mutate(urlB)}
                    disabled={!urlB || isAnalyzingB}
                    data-testid="button-analyze-b"
                  >
                    {isAnalyzingB ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>

                {repoB && (
                  <div className="bg-dark rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center">
                          <i className="fab fa-github text-white"></i>
                        </div>
                        <div>
                          <h4 className="font-medium" data-testid="text-repo-b-name">{repoB.repository?.name}</h4>
                          <p className="text-sm text-gray-400">{repoB.repository?.fullName}</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-400">
                        {repoB.analysis?.overallScore?.toFixed(1) || 'N/A'}
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{repoB.repository?.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        {repoA && repoB && (
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-6">Side-by-Side Comparison</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4">Metric</th>
                      <th className="text-center py-3 px-4">{repoA.repository?.name}</th>
                      <th className="text-center py-3 px-4">{repoB.repository?.name}</th>
                      <th className="text-center py-3 px-4">Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Overall Score', keyA: repoA.analysis?.overallScore, keyB: repoB.analysis?.overallScore },
                      { label: 'Originality', keyA: repoA.analysis?.originality, keyB: repoB.analysis?.originality },
                      { label: 'Completeness', keyA: repoA.analysis?.completeness, keyB: repoB.analysis?.completeness },
                      { label: 'Marketability', keyA: repoA.analysis?.marketability, keyB: repoB.analysis?.marketability },
                      { label: 'Monetization', keyA: repoA.analysis?.monetization, keyB: repoB.analysis?.monetization },
                      { label: 'Usefulness', keyA: repoA.analysis?.usefulness, keyB: repoB.analysis?.usefulness },
                      { label: 'Stars', keyA: repoA.repository?.stars, keyB: repoB.repository?.stars },
                      { label: 'Forks', keyA: repoA.repository?.forks, keyB: repoB.repository?.forks },
                    ].map(({ label, keyA, keyB }) => {
                      const winner = keyA > keyB ? 'A' : keyB > keyA ? 'B' : 'Tie';
                      return (
                        <tr key={label} className="border-b border-border/50">
                          <td className="py-3 px-4 font-medium">{label}</td>
                          <td className={`text-center py-3 px-4 ${winner === 'A' ? 'text-green-400 font-bold' : ''}`}>
                            {typeof keyA === 'number' ? (keyA < 100 ? keyA.toFixed(1) : keyA.toLocaleString()) : 'N/A'}
                          </td>
                          <td className={`text-center py-3 px-4 ${winner === 'B' ? 'text-green-400 font-bold' : ''}`}>
                            {typeof keyB === 'number' ? (keyB < 100 ? keyB.toFixed(1) : keyB.toLocaleString()) : 'N/A'}
                          </td>
                          <td className="text-center py-3 px-4">
                            {winner === 'Tie' ? (
                              <Badge variant="secondary">Tie</Badge>
                            ) : (
                              <Badge variant={winner === 'A' ? 'default' : 'default'} className={winner === 'A' ? 'bg-blue-600' : 'bg-green-600'}>
                                Repo {winner}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
