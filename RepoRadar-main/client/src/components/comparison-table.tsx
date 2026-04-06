import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
}

interface Analysis {
  originality: number;
  completeness: number;
  marketability: number;
  monetization: number;
  usefulness: number;
  overallScore: number;
}

interface ComparisonTableProps {
  repoA: Repository;
  repoB: Repository;
}

export default function ComparisonTable({ repoA, repoB }: ComparisonTableProps) {
  const { data: dataA } = useQuery({
    queryKey: ['/api/repositories', repoA.id],
    enabled: !!repoA.id,
  });

  const { data: dataB } = useQuery({
    queryKey: ['/api/repositories', repoB.id],
    enabled: !!repoB.id,
  });

  const analysisA = dataA?.analysis;
  const analysisB = dataB?.analysis;

  const compareMetric = (valueA: number | undefined, valueB: number | undefined) => {
    if (!valueA || !valueB) return 'tie';
    if (valueA > valueB) return 'a';
    if (valueB > valueA) return 'b';
    return 'tie';
  };

  const getWinnerIcon = (winner: string) => {
    switch (winner) {
      case 'a':
        return <i className="fas fa-trophy text-primary" data-testid="trophy-repo-a"></i>;
      case 'b':
        return <i className="fas fa-trophy text-accent" data-testid="trophy-repo-b"></i>;
      default:
        return <i className="fas fa-minus text-gray-400" data-testid="tie-icon"></i>;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-8">
        <h3 className="text-2xl font-bold mb-8 text-center gradient-text">Comparison Results</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 font-medium text-gray-300">Metric</th>
                <th className="text-center py-4 font-medium">
                  <div className="flex flex-col items-center">
                    <span className="text-primary" data-testid="header-repo-a">{repoA.name}</span>
                    <span className="text-xs text-gray-400">{repoA.fullName}</span>
                  </div>
                </th>
                <th className="text-center py-4 font-medium">
                  <div className="flex flex-col items-center">
                    <span className="text-accent" data-testid="header-repo-b">{repoB.name}</span>
                    <span className="text-xs text-gray-400">{repoB.fullName}</span>
                  </div>
                </th>
                <th className="text-center py-4 font-medium text-gray-300">Winner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Basic Repository Metrics */}
              <tr>
                <td className="py-4 font-medium">Stars</td>
                <td className="py-4 text-center">
                  <span className="text-primary font-bold" data-testid="stars-repo-a">
                    {formatNumber(repoA.stars)}
                  </span>
                </td>
                <td className="py-4 text-center">
                  <span className="text-accent font-bold" data-testid="stars-repo-b">
                    {formatNumber(repoB.stars)}
                  </span>
                </td>
                <td className="py-4 text-center">
                  {getWinnerIcon(compareMetric(repoA.stars, repoB.stars))}
                </td>
              </tr>

              <tr>
                <td className="py-4 font-medium">Forks</td>
                <td className="py-4 text-center">
                  <span className="text-primary font-bold" data-testid="forks-repo-a">
                    {formatNumber(repoA.forks)}
                  </span>
                </td>
                <td className="py-4 text-center">
                  <span className="text-accent font-bold" data-testid="forks-repo-b">
                    {formatNumber(repoB.forks)}
                  </span>
                </td>
                <td className="py-4 text-center">
                  {getWinnerIcon(compareMetric(repoA.forks, repoB.forks))}
                </td>
              </tr>

              <tr>
                <td className="py-4 font-medium">Primary Language</td>
                <td className="py-4 text-center">
                  <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30" data-testid="language-repo-a">
                    {repoA.language || 'Unknown'}
                  </Badge>
                </td>
                <td className="py-4 text-center">
                  <Badge className="bg-green-500/20 text-green-400 border border-green-500/30" data-testid="language-repo-b">
                    {repoB.language || 'Unknown'}
                  </Badge>
                </td>
                <td className="py-4 text-center">
                  <i className="fas fa-minus text-gray-400"></i>
                </td>
              </tr>

              {/* AI Analysis Metrics */}
              {analysisA && analysisB && (
                <>
                  <tr className="bg-dark/30">
                    <td colSpan={4} className="py-3 text-center font-semibold text-lg gradient-text">
                      AI Analysis Comparison
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 font-medium">Originality</td>
                    <td className="py-4 text-center">
                      <span className="text-primary font-bold text-lg" data-testid="originality-repo-a">
                        {analysisA.originality.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-accent font-bold text-lg" data-testid="originality-repo-b">
                        {analysisB.originality.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {getWinnerIcon(compareMetric(analysisA.originality, analysisB.originality))}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 font-medium">Completeness</td>
                    <td className="py-4 text-center">
                      <span className="text-primary font-bold text-lg" data-testid="completeness-repo-a">
                        {analysisA.completeness.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-accent font-bold text-lg" data-testid="completeness-repo-b">
                        {analysisB.completeness.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {getWinnerIcon(compareMetric(analysisA.completeness, analysisB.completeness))}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 font-medium">Marketability</td>
                    <td className="py-4 text-center">
                      <span className="text-primary font-bold text-lg" data-testid="marketability-repo-a">
                        {analysisA.marketability.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-accent font-bold text-lg" data-testid="marketability-repo-b">
                        {analysisB.marketability.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {getWinnerIcon(compareMetric(analysisA.marketability, analysisB.marketability))}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 font-medium">Monetization Potential</td>
                    <td className="py-4 text-center">
                      <span className="text-primary font-bold text-lg" data-testid="monetization-repo-a">
                        {analysisA.monetization.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-accent font-bold text-lg" data-testid="monetization-repo-b">
                        {analysisB.monetization.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {getWinnerIcon(compareMetric(analysisA.monetization, analysisB.monetization))}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 font-medium">Usefulness</td>
                    <td className="py-4 text-center">
                      <span className="text-primary font-bold text-lg" data-testid="usefulness-repo-a">
                        {analysisA.usefulness.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-accent font-bold text-lg" data-testid="usefulness-repo-b">
                        {analysisB.usefulness.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {getWinnerIcon(compareMetric(analysisA.usefulness, analysisB.usefulness))}
                    </td>
                  </tr>

                  <tr className="bg-primary/10 border-t-2 border-primary/30">
                    <td className="py-6 font-bold text-lg">Overall Score</td>
                    <td className="py-6 text-center">
                      <span className="text-2xl font-bold gradient-text" data-testid="overall-repo-a">
                        {analysisA.overallScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-6 text-center">
                      <span className="text-2xl font-bold gradient-text" data-testid="overall-repo-b">
                        {analysisB.overallScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-6 text-center">
                      <div className="text-2xl">
                        {getWinnerIcon(compareMetric(analysisA.overallScore, analysisB.overallScore))}
                      </div>
                    </td>
                  </tr>
                </>
              )}

              {(!analysisA || !analysisB) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <div className="text-gray-400">
                      <i className="fas fa-info-circle mr-2"></i>
                      AI analysis data is not available for one or both repositories. 
                      Analyze the repositories first to see detailed comparisons.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {analysisA && analysisB && (
          <div className="mt-8 p-6 bg-dark rounded-lg border border-border">
            <h4 className="text-lg font-semibold mb-4">Comparison Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium text-primary mb-2">{repoA.name}</h5>
                <p className="text-sm text-gray-300 line-clamp-3">
                  {repoA.description || 'No description available'}
                </p>
              </div>
              <div>
                <h5 className="font-medium text-accent mb-2">{repoB.name}</h5>
                <p className="text-sm text-gray-300 line-clamp-3">
                  {repoB.description || 'No description available'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
