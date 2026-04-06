import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronDown, ChevronRight, FileText, Menu, X } from 'lucide-react';
import { analytics } from '@/hooks/useNavigationTracking';
import { cn } from '@/lib/utils';

interface DocItem {
  title: string;
  path: string;
  description?: string;
}

interface DocCategory {
  name: string;
  slug: string;
  icon?: React.ComponentType<{ className?: string }>;
  docs: DocItem[];
}

interface DocSidebarProps {
  categories: DocCategory[];
  currentDoc?: string;
  className?: string;
}

export function DocSidebar({ categories, currentDoc, className }: DocSidebarProps) {
  const [location] = useLocation();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map(cat => cat.slug))
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCategory = (slug: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const isActiveDoc = (path: string) => {
    return location === path || currentDoc === path;
  };

  const SidebarContent = () => (
    <nav className="space-y-6">
      {categories.map((category) => {
        const isExpanded = expandedCategories.has(category.slug);
        const Icon = category.icon || FileText;

        return (
          <div key={category.slug}>
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.slug)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="capitalize">{category.name.replace(/-/g, ' ')}</span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {/* Document List */}
            {isExpanded && (
              <div className="mt-1 space-y-1 ml-6">
                {category.docs.map((doc) => {
                  const docPath = `/docs/${category.slug}/${doc.path}`;
                  const isActive = isActiveDoc(docPath);

                  return (
                    <Link
                      key={doc.path}
                      href={docPath}
                      onClick={() => {
                        analytics.trackNavigation(location, docPath, 'sidebar');
                        setIsMobileOpen(false);
                      }}
                      className={cn(
                        'block px-3 py-2 text-sm rounded-md transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      <div>
                        <div>{doc.title}</div>
                        {doc.description && (
                          <div className="text-xs opacity-80 mt-0.5">
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed bottom-4 right-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg"
        aria-label="Toggle documentation menu"
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:sticky top-0 left-0 h-screen md:h-auto w-64 bg-background border-r md:border-r-0 overflow-y-auto z-40 transition-transform duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className
        )}
      >
        <div className="p-4 md:p-0">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between mb-4 pb-4 border-b">
            <h2 className="text-lg font-semibold">Documentation</h2>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 hover:bg-accent rounded-md"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
