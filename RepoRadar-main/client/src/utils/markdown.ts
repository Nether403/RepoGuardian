import matter from 'gray-matter';

/**
 * Metadata extracted from markdown frontmatter
 */
export interface DocMetadata {
  title: string;
  description: string;
  category: string;
  order: number;
  lastUpdated: string;
  author?: string;
  tags?: string[];
}

/**
 * Parsed markdown document with metadata and content
 */
export interface ParsedMarkdown {
  metadata: DocMetadata;
  content: string;
  excerpt?: string;
}

/**
 * Table of contents item
 */
export interface TocItem {
  id: string;
  text: string;
  level: number;
  children?: TocItem[];
}

/**
 * Parse markdown content with frontmatter
 * @param markdownContent - Raw markdown string with frontmatter
 * @returns Parsed markdown with metadata and content
 */
export function parseMarkdown(markdownContent: string): ParsedMarkdown {
  const { data, content, excerpt } = matter(markdownContent, {
    excerpt: true,
    excerpt_separator: '<!-- more -->',
  });

  return {
    metadata: data as DocMetadata,
    content,
    excerpt: excerpt || undefined,
  };
}

/**
 * Generate table of contents from markdown content
 * @param markdownContent - Markdown content string
 * @returns Array of table of contents items
 */
export function generateTableOfContents(markdownContent: string): TocItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(markdownContent)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugify(text);

    headings.push({
      id,
      text,
      level,
    });
  }

  return buildTocHierarchy(headings);
}

/**
 * Build hierarchical table of contents from flat list
 * @param items - Flat array of TOC items
 * @returns Hierarchical TOC structure
 */
function buildTocHierarchy(items: TocItem[]): TocItem[] {
  const root: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const item of items) {
    // Remove items from stack that are at same or deeper level
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top level item
      root.push(item);
    } else {
      // Nested item
      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(item);
    }

    stack.push(item);
  }

  return root;
}

/**
 * Convert text to URL-friendly slug
 * @param text - Text to slugify
 * @returns URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extract plain text from markdown (remove formatting)
 * @param markdown - Markdown content
 * @returns Plain text content
 */
export function extractPlainText(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`[^`]+`/g, '')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove bold/italic
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estimate reading time for markdown content
 * @param markdown - Markdown content
 * @param wordsPerMinute - Average reading speed (default: 200)
 * @returns Estimated reading time in minutes
 */
export function estimateReadingTime(
  markdown: string,
  wordsPerMinute: number = 200
): number {
  const plainText = extractPlainText(markdown);
  const wordCount = plainText.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, minutes); // Minimum 1 minute
}

/**
 * Search markdown content for a query
 * @param markdown - Markdown content to search
 * @param query - Search query
 * @returns True if query is found (case-insensitive)
 */
export function searchMarkdown(markdown: string, query: string): boolean {
  const plainText = extractPlainText(markdown);
  return plainText.toLowerCase().includes(query.toLowerCase());
}

/**
 * Get excerpt from markdown content
 * @param markdown - Markdown content
 * @param maxLength - Maximum excerpt length (default: 200)
 * @returns Excerpt text
 */
export function getExcerpt(markdown: string, maxLength: number = 200): string {
  const plainText = extractPlainText(markdown);
  
  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find the last complete sentence within maxLength
  const truncated = plainText.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > maxLength * 0.6) {
    // If we found a sentence end in the last 40% of the excerpt
    return plainText.substring(0, lastSentenceEnd + 1);
  }

  // Otherwise, truncate at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return plainText.substring(0, lastSpace) + '...';
}

/**
 * Add IDs to headings in markdown for anchor links
 * @param markdown - Markdown content
 * @returns Markdown with heading IDs
 */
export function addHeadingIds(markdown: string): string {
  return markdown.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
    const id = slugify(text);
    return `${hashes} ${text} {#${id}}`;
  });
}

/**
 * Validate markdown frontmatter
 * @param metadata - Metadata object to validate
 * @returns True if valid, false otherwise
 */
export function validateMetadata(metadata: Partial<DocMetadata>): boolean {
  const required = ['title', 'description', 'category'];
  return required.every(field => field in metadata && metadata[field as keyof DocMetadata]);
}
