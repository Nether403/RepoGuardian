import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  FileText, 
  Image, 
  FileJson, 
  Mail, 
  Printer,
  Settings,
  Eye,
  Share2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportOptions {
  format: 'pdf' | 'json' | 'csv' | 'png' | 'svg';
  includeCharts: boolean;
  includeRawData: boolean;
  includeComments: boolean;
  includeMetadata: boolean;
  template: 'standard' | 'executive' | 'technical' | 'minimal';
  orientation: 'portrait' | 'landscape';
  colorScheme: 'light' | 'dark' | 'auto';
}

interface AnalysisData {
  repositoryName: string;
  repositoryUrl: string;
  analysisDate: string;
  overallScore: number;
  metrics: {
    originality: number;
    completeness: number;
    marketability: number;
    monetization: number;
    usefulness: number;
  };
  insights: string[];
  recommendations: string[];
  charts: any[];
  metadata: {
    analyzer: string;
    version: string;
    duration: number;
  };
}

interface ExportAnalysisProps {
  analysisData: AnalysisData;
  analysisId: string;
}

export default function ExportAnalysis({ analysisData, analysisId }: ExportAnalysisProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    includeCharts: true,
    includeRawData: false,
    includeComments: false,
    includeMetadata: true,
    template: 'standard',
    orientation: 'portrait',
    colorScheme: 'light'
  });

  const updateOptions = (updates: Partial<ExportOptions>) => {
    setOptions(prev => ({ ...prev, ...updates }));
  };

  const exportAnalysis = async () => {
    setIsExporting(true);
    
    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      switch (options.format) {
        case 'pdf':
          await exportToPDF();
          break;
        case 'json':
          await exportToJSON();
          break;
        case 'csv':
          await exportToCSV();
          break;
        case 'png':
          await exportToPNG();
          break;
        case 'svg':
          await exportToSVG();
          break;
      }
      
      toast({
        title: 'Export successful',
        description: `Analysis exported as ${options.format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export analysis. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    // Mock PDF generation
    const pdfContent = generatePDFContent();
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    downloadFile(blob, `${analysisData.repositoryName}-analysis.pdf`);
  };

  const exportToJSON = async () => {
    const jsonData = {
      ...analysisData,
      exportOptions: options,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    downloadFile(blob, `${analysisData.repositoryName}-analysis.json`);
  };

  const exportToCSV = async () => {
    const csvContent = [
      'Metric,Score,Description',
      `Overall Score,${analysisData.overallScore},Combined score across all metrics`,
      `Originality,${analysisData.metrics.originality},How unique and innovative the project is`,
      `Completeness,${analysisData.metrics.completeness},How complete and polished the project is`,
      `Marketability,${analysisData.metrics.marketability},Commercial potential and market appeal`,
      `Monetization,${analysisData.metrics.monetization},Potential for generating revenue`,
      `Usefulness,${analysisData.metrics.usefulness},Practical value and utility`
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    downloadFile(blob, `${analysisData.repositoryName}-analysis.csv`);
  };

  const exportToPNG = async () => {
    // Mock chart image export
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#000000';
      ctx.font = '24px Arial';
      ctx.fillText(`${analysisData.repositoryName} Analysis`, 50, 50);
    }
    
    canvas.toBlob((blob) => {
      if (blob) {
        downloadFile(blob, `${analysisData.repositoryName}-chart.png`);
      }
    });
  };

  const exportToSVG = async () => {
    const svgContent = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="white"/>
        <text x="50" y="50" font-family="Arial" font-size="24" fill="black">
          ${analysisData.repositoryName} Analysis
        </text>
      </svg>
    `;
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    downloadFile(blob, `${analysisData.repositoryName}-chart.svg`);
  };

  const generatePDFContent = () => {
    return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 720 Td
(${analysisData.repositoryName} Analysis Report) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000110 00000 n 
0000000205 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
299
%%EOF`;
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Analysis Report: ${analysisData.repositoryName}`);
    const body = encodeURIComponent(`
Hi,

I've completed an analysis of the ${analysisData.repositoryName} repository. Here are the key findings:

Overall Score: ${analysisData.overallScore}/10

Key Metrics:
- Originality: ${analysisData.metrics.originality}/10
- Completeness: ${analysisData.metrics.completeness}/10
- Marketability: ${analysisData.metrics.marketability}/10
- Monetization: ${analysisData.metrics.monetization}/10
- Usefulness: ${analysisData.metrics.usefulness}/10

You can view the full analysis at: ${window.location.origin}/analysis/${analysisId}

Best regards
    `);
    
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'json': return <FileJson className="w-4 h-4" />;
      case 'csv': return <FileText className="w-4 h-4" />;
      case 'png': return <Image className="w-4 h-4" />;
      case 'svg': return <Image className="w-4 h-4" />;
      default: return <Download className="w-4 h-4" />;
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'pdf': return 'Professional report with charts and formatting';
      case 'json': return 'Raw data for programmatic access';
      case 'csv': return 'Spreadsheet-compatible metrics data';
      case 'png': return 'High-quality chart image';
      case 'svg': return 'Scalable vector chart';
      default: return '';
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Analysis
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="format" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="format">Format</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>

          {/* Format Selection */}
          <TabsContent value="format" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(['pdf', 'json', 'csv', 'png', 'svg'] as const).map((format) => (
                <Card 
                  key={format}
                  className={`p-4 cursor-pointer transition-all ${
                    options.format === format 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => updateOptions({ format })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {getFormatIcon(format)}
                    <span className="font-medium uppercase">{format}</span>
                    {options.format === format && (
                      <Badge variant="secondary">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    {getFormatDescription(format)}
                  </p>
                </Card>
              ))}
            </div>

            {options.format === 'pdf' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template</label>
                  <Select 
                    value={options.template} 
                    onValueChange={(value: any) => updateOptions({ template: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Report</SelectItem>
                      <SelectItem value="executive">Executive Summary</SelectItem>
                      <SelectItem value="technical">Technical Deep Dive</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Orientation</label>
                  <Select 
                    value={options.orientation} 
                    onValueChange={(value: any) => updateOptions({ orientation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Export Options */}
          <TabsContent value="options" className="space-y-4">
            <div className="space-y-4">
              <h3 className="font-medium">Include in Export</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeCharts"
                      checked={options.includeCharts}
                      onCheckedChange={(checked) => updateOptions({ includeCharts: !!checked })}
                    />
                    <label htmlFor="includeCharts" className="text-sm">Charts and Visualizations</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeRawData"
                      checked={options.includeRawData}
                      onCheckedChange={(checked) => updateOptions({ includeRawData: !!checked })}
                    />
                    <label htmlFor="includeRawData" className="text-sm">Raw Data</label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeComments"
                      checked={options.includeComments}
                      onCheckedChange={(checked) => updateOptions({ includeComments: !!checked })}
                    />
                    <label htmlFor="includeComments" className="text-sm">Comments & Reviews</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeMetadata"
                      checked={options.includeMetadata}
                      onCheckedChange={(checked) => updateOptions({ includeMetadata: !!checked })}
                    />
                    <label htmlFor="includeMetadata" className="text-sm">Analysis Metadata</label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Color Scheme</label>
                <Select 
                  value={options.colorScheme} 
                  onValueChange={(value: any) => updateOptions({ colorScheme: value })}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light Theme</SelectItem>
                    <SelectItem value="dark">Dark Theme</SelectItem>
                    <SelectItem value="auto">Auto (Match System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Share Options */}
          <TabsContent value="share" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="w-5 h-5 text-primary" />
                  <span className="font-medium">Email Report</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Share analysis summary via email
                </p>
                <Button onClick={shareViaEmail} className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  Open Email Client
                </Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Share2 className="w-5 h-5 text-primary" />
                  <span className="font-medium">Generate Link</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Create shareable link to analysis
                </p>
                <Button variant="outline" className="w-full">
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Share Link
                </Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Printer className="w-5 h-5 text-primary" />
                  <span className="font-medium">Print Report</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Print-friendly version
                </p>
                <Button variant="outline" className="w-full">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Preview
                </Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Eye className="w-5 h-5 text-primary" />
                  <span className="font-medium">Preview</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Preview before exporting
                </p>
                <Button variant="outline" className="w-full">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Export
                </Button>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Export Button */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <div className="text-sm text-gray-400">
            Exporting as {options.format.toUpperCase()} with {
              [
                options.includeCharts && 'charts',
                options.includeRawData && 'raw data',
                options.includeComments && 'comments',
                options.includeMetadata && 'metadata'
              ].filter(Boolean).join(', ') || 'basic content'
            }
          </div>
          
          <Button 
            onClick={exportAnalysis}
            disabled={isExporting}
            className="bg-primary hover:bg-primary/80"
          >
            {isExporting ? (
              <>
                <Settings className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Analysis
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}