import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { analytics } from '@/hooks/useNavigationTracking';
import 'highlight.js/styles/github-dark.css';

interface DocMetadata {
  title: string;
  description?: string;
  category: string;
  lastUpdated?: string;
  author?: string;
  tags?: string[];
}

interface DocViewerProps {
  content: string;
  metadata: DocMetadata;
  category: string;
  docName: string;
}

export function DocViewer({ content, metadata, category, docName }: DocViewerProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Track documentation view
  useEffect(() => {
    analytics.trackDocView(category, metadata.title, `${category}/${docName}`);
  }, [category, metadata.title, docName]);

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link href="/docs" className="hover:text-foreground transition-colors">
          Docs
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link 
          href={`/docs/${category}`} 
          className="hover:text-foreground transition-colors capitalize"
        >
          {category.replace(/-/g, ' ')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{metadata.title}</span>
      </nav>

      {/* Document Header */}
      <div className="mb-8 pb-6 border-b">
        <h1 className="text-4xl font-bold mb-3">{metadata.title}</h1>
        {metadata.description && (
          <p className="text-lg text-muted-foreground mb-4">{metadata.description}</p>
        )}
        
        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {metadata.lastUpdated && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Updated {new Date(metadata.lastUpdated).toLocaleDateString()}</span>
            </div>
          )}
          {metadata.author && (
            <span>By {metadata.author}</span>
          )}
          {metadata.tags && metadata.tags.length > 0 && (
            <div className="flex gap-2">
              {metadata.tags.map((tag) => (
                <span 
                  key={tag}
                  className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Markdown Content */}
      <div className="prose prose-slate dark:prose-invert max-w-none">
        {/* @ts-ignore - ReactMarkdown type issue with React 18 */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            // Custom code block with copy button
            pre: ({ children, ...props }: any) => {
              const codeElement = children as any;
              const code = codeElement?.props?.children?.[0] || '';
              const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
              
              return (
                <div className="relative group">
                  <button
                    onClick={() => handleCopyCode(code, codeId)}
                    className="absolute top-2 right-2 p-2 bg-background/80 hover:bg-background border rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Copy code"
                  >
                    {copiedCode === codeId ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <pre {...props}>{children}</pre>
                </div>
              );
            },
            // Custom link handling
            a: ({ href, children, ...props }: any) => {
              const isExternal = href?.startsWith('http');
              if (isExternal) {
                return (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                );
              }
              return <a href={href} {...props}>{children}</a>;
            },
            // Custom image handling
            img: ({ src, alt, ...props }: any) => (
              <img 
                src={src} 
                alt={alt || ''} 
                loading="lazy"
                className="rounded-lg border"
                {...props}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* Edit on GitHub Link */}
      <div className="mt-12 pt-6 border-t">
        <a
          href={`https://github.com/your-org/reporadar/edit/main/docs/${category}/${docName}.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Edit this page on GitHub →
        </a>
      </div>
    </div>
  );
}
