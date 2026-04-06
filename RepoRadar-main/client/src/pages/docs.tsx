import { useEffect, useState, lazy, Suspense } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Header } from '@/components/layout/Header';
import { DocSEO } from '@/components/docs/DocSEO';
import { parseMarkdown, extractPlainText } from '@/utils/markdown';

// React 19 compatibility workarounds
const SuspenseComponent = Suspense as any;

// Lazy load heavy components for better performance
const DocViewer = lazy(() => import('@/components/docs/DocViewer').then(m => ({ default: m.DocViewer }))) as any;
const DocSidebar = lazy(() => import('@/components/docs/DocSidebar').then(m => ({ default: m.DocSidebar }))) as any;
const DocSearch = lazy(() => import('@/components/docs/DocSearch').then(m => ({ default: m.DocSearch }))) as any;
import { 
  BookOpen, 
  Zap, 
  Code, 
  HelpCircle, 
  Wrench,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface DocMetadata {
  title: string;
  description?: string;
  category: string;
  lastUpdated?: string;
  author?: string;
  tags?: string[];
}

interface DocData {
  content: string;
  metadata: DocMetadata;
}

interface SearchableDoc {
  title: string;
  path: string;
  category: string;
  description?: string;
  content: string;
}

// Document cache for performance
const docCache = new Map<string, DocData>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

// Documentation structure
const docCategories = [
  {
    name: 'Getting Started',
    slug: 'getting-started',
    icon: BookOpen,
    docs: [
      { title: 'Overview', path: 'index', description: 'Introduction to RepoRadar' },
      { title: 'Installation', path: 'installation', description: 'Setup and installation guide' },
      { title: 'Quick Start', path: 'quick-start', description: 'Get started in 5 minutes' },
    ],
  },
  {
    name: 'Features',
    slug: 'features',
    icon: Zap,
    docs: [
      { title: 'Overview', path: 'index', description: 'Feature overview' },
      { title: 'Repository Analysis', path: 'repository-analysis', description: 'AI-powered analysis' },
      { title: 'Similar Repositories', path: 'similar-repositories', description: 'Find related projects' },
      { title: 'Batch Analysis', path: 'batch-analysis', description: 'Analyze multiple repos' },
      { title: 'Analytics Dashboard', path: 'analytics-dashboard', description: 'Track your usage' },
      { title: 'Subscriptions', path: 'subscription', description: 'Subscription tiers' },
    ],
  },
  {
    name: 'API Reference',
    slug: 'api-reference',
    icon: Code,
    docs: [
      { title: 'Overview', path: 'index', description: 'API documentation' },
      { title: 'Authentication', path: 'authentication', description: 'Auth endpoints' },
      { title: 'Repositories', path: 'repositories', description: 'Repository endpoints' },
      { title: 'Analytics', path: 'analytics', description: 'Analytics endpoints' },
    ],
  },
  {
    name: 'FAQ',
    slug: 'faq',
    icon: HelpCircle,
    docs: [
      { title: 'Frequently Asked Questions', path: 'index', description: 'Common questions' },
    ],
  },
  {
    name: 'Troubleshooting',
    slug: 'troubleshooting',
    icon: Wrench,
    docs: [
      { title: 'Common Issues', path: 'index', description: 'Troubleshooting guide' },
    ],
  },
];

export default function DocsPage() {
  const [, params] = useRoute('/docs/:category/:doc?');
  const [, setLocation] = useLocation();
  const [docData, setDocData] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchableDoc[]>([]);

  const category = params?.category || 'getting-started';
  const docName = params?.doc || 'index';

  useEffect(() => {
    loadDocument(category, docName);
  }, [category, docName]);

  // Build search index on mount
  useEffect(() => {
    buildSearchIndex();
  }, []);

  const loadDocument = async (cat: string, doc: string) => {
    setLoading(true);
    setError(null);

    const cacheKey = `${cat}/${doc}`;
    const now = Date.now();
    const cachedTimestamp = cacheTimestamps.get(cacheKey);

    // Check if we have a valid cached version
    if (cachedTimestamp && now - cachedTimestamp < CACHE_DURATION && docCache.has(cacheKey)) {
      setDocData(docCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    try {
      // Try to fetch the markdown file
      const response = await fetch(`/docs/${cat}/${doc}.md`);
      
      if (!response.ok) {
        throw new Error('Document not found');
      }

      const markdown = await response.text();
      const { content, metadata } = parseMarkdown(markdown);

      // Set default metadata if not provided
      const docMetadata: DocMetadata = {
        title: metadata.title || doc.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: metadata.description,
        category: cat,
        lastUpdated: metadata.lastUpdated,
        author: metadata.author,
        tags: metadata.tags,
      };

      const docData = { content, metadata: docMetadata };
      
      // Cache the document
      docCache.set(cacheKey, docData);
      cacheTimestamps.set(cacheKey, now);

      setDocData(docData);
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Document not found');
    } finally {
      setLoading(false);
    }
  };

  const buildSearchIndex = async () => {
    const index: SearchableDoc[] = [];

    for (const category of docCategories) {
      for (const doc of category.docs) {
        try {
          const response = await fetch(`/docs/${category.slug}/${doc.path}.md`);
          if (response.ok) {
            const markdown = await response.text();
            const { content, metadata } = parseMarkdown(markdown);
            const plainText = extractPlainText(content);

            index.push({
              title: metadata.title || doc.title,
              path: `/docs/${category.slug}/${doc.path}`,
              category: category.slug,
              description: metadata.description || doc.description,
              content: plainText,
            });
          }
        } catch (err) {
          console.error(`Error indexing ${category.slug}/${doc.path}:`, err);
        }
      }
    }

    setSearchIndex(index);
  };

  // Redirect to default doc if no category/doc specified
  useEffect(() => {
    if (!params?.category) {
      setLocation('/docs/getting-started/index');
    }
  }, [params, setLocation]);

  return (
    <div className="min-h-screen bg-background">
      {/* SEO Meta Tags */}
      {docData && (
        <DocSEO
          title={docData.metadata.title}
          description={docData.metadata.description || `${docData.metadata.title} - RepoRadar Documentation`}
          category={docData.metadata.category}
          path={`${category}/${docName}`}
          lastUpdated={docData.metadata.lastUpdated}
          author={docData.metadata.author}
        />
      )}
      
      <Header />
      
      <div className="container mx-auto px-4 py-8 pt-32">
        {/* Search Bar */}
        <div className="mb-8 max-w-2xl mx-auto">
          <SuspenseComponent fallback={
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          }>
            <DocSearch documents={searchIndex} />
          </SuspenseComponent>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8">
          {/* Sidebar */}
          <SuspenseComponent fallback={
            <div className="space-y-4">
              <div className="h-8 bg-muted animate-pulse rounded-md" />
              <div className="h-32 bg-muted animate-pulse rounded-md" />
              <div className="h-32 bg-muted animate-pulse rounded-md" />
            </div>
          }>
            <DocSidebar 
              categories={docCategories} 
              currentDoc={`/docs/${category}/${docName}`}
            />
          </SuspenseComponent>

          {/* Main Content */}
          <main id="main-content" className="min-w-0" role="main" aria-label="Documentation content">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-2xl font-bold mb-2">Document Not Found</h2>
                <p className="text-muted-foreground mb-6">
                  The documentation page you're looking for doesn't exist.
                </p>
                <button
                  onClick={() => setLocation('/docs/getting-started/index')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Go to Getting Started
                </button>
              </div>
            )}

            {!loading && !error && docData && (
              <SuspenseComponent fallback={
                <div className="space-y-4">
                  <div className="h-12 bg-muted animate-pulse rounded-md" />
                  <div className="h-64 bg-muted animate-pulse rounded-md" />
                </div>
              }>
                <DocViewer
                  content={docData.content}
                  metadata={docData.metadata}
                  category={category}
                  docName={docName}
                />
              </SuspenseComponent>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
