import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { AppError, ErrorCodes } from '@shared/errors';
import { retryHandler } from './utils/retryHandler';
import { queueGeminiRequest, geminiQueue } from './utils/geminiQueue';

const GEMINI_ENABLED = !!process.env.GEMINI_API_KEY;
const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;

if (!GEMINI_ENABLED && !OPENAI_ENABLED) {
  console.warn('No AI API keys configured - AI features will be limited');
} else if (!GEMINI_ENABLED) {
  console.warn('Gemini API key not configured - using OpenAI as primary provider');
} else if (!OPENAI_ENABLED) {
  console.warn('OpenAI API key not configured - no fallback available');
}

const ai = GEMINI_ENABLED 
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  : null;

const openai = OPENAI_ENABLED
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  : null;

export const isGeminiEnabled = () => GEMINI_ENABLED;
export const isOpenAIEnabled = () => OPENAI_ENABLED;
export const isAIEnabled = () => GEMINI_ENABLED || OPENAI_ENABLED;

/**
 * Handle Gemini API errors and convert to AppError
 */
function handleGeminiError(error: unknown, context: string): never {
  console.error(`Gemini API error during ${context}:`, error);
  const err = error as { message?: string; status?: number; code?: string };

  // Rate limit error
  if (err.message?.includes('rate limit') || err.status === 429) {
    throw new AppError(
      ErrorCodes.RATE_LIMIT_EXCEEDED.code,
      `Gemini API rate limit exceeded during ${context}`,
      'AI service rate limit exceeded. Please try again in a moment.',
      ErrorCodes.RATE_LIMIT_EXCEEDED.statusCode,
      'Wait a moment and try again'
    );
  }

  // API key error
  if (err.message?.includes('API key') || err.status === 401) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED.code,
      `Gemini API authentication failed during ${context}`,
      'AI service authentication failed.',
      ErrorCodes.UNAUTHORIZED.statusCode,
      'Contact support if this persists'
    );
  }

  // Timeout error
  if (err.message?.includes('timeout') || err.code === 'ETIMEDOUT') {
    throw new AppError(
      ErrorCodes.TIMEOUT_ERROR.code,
      `Gemini API timeout during ${context}`,
      ErrorCodes.TIMEOUT_ERROR.userMessage,
      ErrorCodes.TIMEOUT_ERROR.statusCode,
      ErrorCodes.TIMEOUT_ERROR.recoveryAction
    );
  }

  // Service unavailable
  if (err.status && err.status >= 500) {
    throw new AppError(
      ErrorCodes.EXTERNAL_API_ERROR.code,
      `Gemini API service error during ${context}`,
      'AI service is temporarily unavailable.',
      ErrorCodes.EXTERNAL_API_ERROR.statusCode,
      'Please try again in a few moments'
    );
  }

  // Generic AI error
  throw new AppError(
    ErrorCodes.ANALYSIS_FAILED.code,
    `AI analysis failed during ${context}: ${err.message || 'Unknown error'}`,
    ErrorCodes.ANALYSIS_FAILED.userMessage,
    ErrorCodes.ANALYSIS_FAILED.statusCode,
    ErrorCodes.ANALYSIS_FAILED.recoveryAction
  );
}

/**
 * Analyze repository using OpenAI GPT-5 as fallback
 */
async function analyzeRepositoryWithOpenAI(repo: RepositoryAnalysisInput): Promise<RepositoryAnalysisResult> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert software repository analyst. Analyze the given repository and provide a comprehensive evaluation with detailed reasoning.

Rate each aspect from 1-10 and provide detailed insights:
1. Originality: How unique and innovative is this project? Consider novelty of approach, creative problem-solving, and differentiation from existing solutions.
2. Completeness: How complete and production-ready is the codebase? Consider documentation, testing, error handling, and polish.
3. Marketability: How appealing would this be to users/customers? Consider demand, user experience, and competitive positioning.
4. Monetization: What are the potential revenue opportunities? Consider business models, target market size, and value proposition.
5. Usefulness: How practically useful is this project? Consider real-world applicability, problem severity, and user impact.

Provide detailed explanations for WHY each score was given.
Include:
- A concise summary (2-3 sentences)
- 3-5 key strengths with clear reasoning
- 3-5 areas for improvement with specific explanations
- 3-5 actionable recommendations with expected impact`;

  const repoInfo = `
Repository: ${repo.name}
Description: ${repo.description}
Primary Language: ${repo.language}
Stars: ${repo.stars}
Forks: ${repo.forks}
Size: ${repo.size} KB
Languages: ${JSON.stringify(repo.languages)}
Topics: ${repo.topics.join(', ')}
${repo.readme ? `README Preview: ${repo.readme.substring(0, 2000)}...` : 'No README available'}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: repoInfo }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content);
  
  // Ensure all scores are between 1-10
  ['originality', 'completeness', 'marketability', 'monetization', 'usefulness', 'overallScore'].forEach(key => {
    if (result[key]) {
      result[key] = Math.max(1, Math.min(10, result[key]));
    }
  });

  return result;
}

/**
 * Ask AI assistant using OpenAI as fallback
 */
async function askAIWithOpenAI(question: string): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an AI assistant for RepoRadar, a GitHub repository analysis platform. Provide helpful, concise answers about RepoRadar features, guide users through navigation, explain metrics and scoring, help troubleshoot issues, and suggest relevant features.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";
}

export interface RepositoryAnalysisInput {
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  size: number;
  languages: Record<string, number>;
  topics: string[];
  readme?: string;
}

export interface RepositoryAnalysisResult {
  originality: number;
  completeness: number;
  marketability: number;
  monetization: number;
  usefulness: number;
  overallScore: number;
  summary: string;
  strengths: Array<{
    point: string;
    reason: string;
  }>;
  weaknesses: Array<{
    point: string;
    reason: string;
  }>;
  recommendations: Array<{
    suggestion: string;
    reason: string;
    impact: string;
  }>;
  scoreExplanations: {
    originality: string;
    completeness: string;
    marketability: string;
    monetization: string;
    usefulness: string;
  };
}

export interface Recommendation {
  repository: {
    id: string;
    fullName: string;
    name: string;
    owner: string;
    description: string;
    language: string;
    stars: number;
    forks: number;
    topics: string[];
  };
  matchScore: number; // 0-100
  reasoning: string;
  basedOn: {
    languages: string[];
    topics: string[];
    similarTo: string[]; // repository names
  };
}

/**
 * Generate AI-powered repository recommendations for a user
 * Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11
 */
export async function generateAIRecommendations(
  userId: string,
  storage: any,
  githubService: any
): Promise<Recommendation[]> {
  if (!isGeminiEnabled() || !ai) {
    throw new AppError(
      ErrorCodes.EXTERNAL_API_ERROR.code,
      'Gemini API not configured',
      'AI recommendations are currently unavailable.',
      ErrorCodes.EXTERNAL_API_ERROR.statusCode,
      'Contact support or try again later'
    );
  }

  try {
    return await retryHandler.executeWithRetry(async () => {
      // 1. Gather user data (Requirements 4.3, 4.4)
      const preferences = await storage.getUserPreferences(userId);
      const recentActivity = await storage.getUserRecentActivity(userId, 100);
      const bookmarks = await storage.getUserBookmarks(userId);
      
      // 2. Extract patterns from user data (Requirement 4.5)
      const analyzedRepos = recentActivity
        .filter((a: any) => a.action === 'analyzed')
        .map((a: any) => a.repositoryId)
        .filter(Boolean);
      
      const bookmarkedRepoIds = bookmarks.map((b: any) => b.repositoryId);
      
      // Get details of recently analyzed repositories for context
      const recentRepoDetails = await Promise.all(
        analyzedRepos.slice(0, 5).map(async (repoId: string) => {
          const repo = await storage.getRepository(repoId);
          return repo ? `${repo.fullName} (${repo.language})` : null;
        })
      );
      const recentRepoNames = recentRepoDetails.filter(Boolean);
      
      // Extract preferences with defaults
      const languages = preferences?.preferredLanguages || [];
      const topics = preferences?.preferredTopics || [];
      const excludedTopics = preferences?.excludedTopics || [];
      const minStars = preferences?.minStars || 0;
      
      // 3. Search GitHub for candidate repositories (Requirement 4.6)
      const searchQueries: string[] = [];
      
      // Build search queries based on preferences
      if (languages.length > 0) {
        // Search for each language separately to get diverse results
        for (const lang of languages.slice(0, 3)) { // Limit to top 3 languages
          searchQueries.push(`language:${lang} stars:>=${minStars}`);
        }
      }
      
      if (topics.length > 0) {
        // Search for each topic
        for (const topic of topics.slice(0, 3)) { // Limit to top 3 topics
          searchQueries.push(`topic:${topic} stars:>=${minStars}`);
        }
      }
      
      // If no preferences, use a general quality search
      if (searchQueries.length === 0) {
        searchQueries.push(`stars:>=${Math.max(minStars, 100)}`);
      }
      
      // Execute searches and collect candidates
      const candidateRepos: any[] = [];
      const seenRepoIds = new Set<string>();
      
      for (const query of searchQueries) {
        try {
          const results = await githubService.searchRepositories(query, 'stars', 10);
          for (const repo of results) {
            const repoId = repo.full_name;
            if (!seenRepoIds.has(repoId)) {
              seenRepoIds.add(repoId);
              candidateRepos.push(repo);
            }
          }
        } catch (error) {
          console.error(`Error searching GitHub with query "${query}":`, error);
          // Continue with other queries even if one fails
        }
      }
      
      // Get dismissed recommendations from Redis
      let dismissedRepoIds: Set<string> = new Set();
      try {
        const { redisManager } = await import('./redis');
        if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
          const redisClient = await redisManager.getClient();
          const dismissedKey = `dismissed_recommendations:${userId}`;
          const dismissed = await redisClient.sMembers(dismissedKey);
          dismissedRepoIds = new Set(dismissed);
        }
      } catch (error) {
        console.error('[Recommendations] Error fetching dismissed recommendations:', error);
        // Continue without dismissed filter
      }
      
      // 4. Filter out already analyzed, bookmarked, and dismissed repositories (Requirement 4.7)
      const filtered = candidateRepos.filter(repo => {
        const repoId = repo.full_name;
        const isAnalyzed = analyzedRepos.includes(repoId);
        const isBookmarked = bookmarkedRepoIds.includes(repoId);
        const isDismissed = dismissedRepoIds.has(repoId);
        
        // Check if any excluded topics match
        const hasExcludedTopic = excludedTopics.some((excluded: string) => 
          repo.topics?.some((topic: string) => 
            topic.toLowerCase().includes(excluded.toLowerCase())
          )
        );
        
        return !isAnalyzed && !isBookmarked && !isDismissed && !hasExcludedTopic;
      });
      
      // If we don't have enough candidates, return empty array
      if (filtered.length === 0) {
        return [];
      }
      
      // 5. Use AI to score and rank repositories (Requirement 4.8, 4.9, 4.10, 4.11)
      const prompt = `You are an expert GitHub repository recommendation system. Analyze these candidate repositories and rank them for a user with the following profile:

User Profile:
- Preferred Languages: ${languages.join(', ') || 'Any'}
- Preferred Topics: ${topics.join(', ') || 'Any'}
- Excluded Topics: ${excludedTopics.join(', ') || 'None'}
- Recently Analyzed: ${recentRepoNames.join(', ') || 'None yet'}
- Minimum Stars Preference: ${minStars}

Candidate Repositories:
${filtered.slice(0, 30).map((repo, idx) => `
${idx + 1}. ${repo.full_name}
   Description: ${repo.description || 'No description'}
   Language: ${repo.language || 'Unknown'}
   Stars: ${repo.stargazers_count}
   Topics: ${repo.topics?.join(', ') || 'None'}
`).join('\n')}

Task: Rank these repositories by relevance to this user. For each repository, provide:
1. A match score (0-100) based on how well it fits the user's interests
2. Clear reasoning explaining why this repository is recommended
3. What aspects of their profile it matches

Consider:
- Language match (high weight if user has language preferences)
- Topic relevance (high weight if user has topic preferences)
- Quality indicators (stars, activity, documentation)
- Similarity to recently analyzed repositories
- Potential usefulness and learning value

Return ONLY the top 10 repositories as a JSON array with this exact structure:
{
  "recommendations": [
    {
      "repositoryFullName": "owner/repo",
      "matchScore": 85,
      "reasoning": "Detailed explanation of why this is recommended",
      "matchedLanguages": ["language1"],
      "matchedTopics": ["topic1", "topic2"],
      "similarToAnalyzed": ["repo1", "repo2"]
    }
  ]
}`;

      const response = await ai!.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    repositoryFullName: { type: "string" },
                    matchScore: { type: "number" },
                    reasoning: { type: "string" },
                    matchedLanguages: { type: "array", items: { type: "string" } },
                    matchedTopics: { type: "array", items: { type: "string" } },
                    similarToAnalyzed: { type: "array", items: { type: "string" } }
                  },
                  required: ["repositoryFullName", "matchScore", "reasoning"]
                }
              }
            },
            required: ["recommendations"]
          }
        },
        contents: prompt
      });

      const aiResult = JSON.parse(response.text || '{"recommendations":[]}');
      const rankedRecommendations = aiResult.recommendations || [];
      
      // 6. Combine AI rankings with repository data and return top 10 (Requirement 4.11)
      const recommendations: Recommendation[] = [];
      
      for (const rec of rankedRecommendations.slice(0, 10)) {
        const repo = filtered.find(r => r.full_name === rec.repositoryFullName);
        if (repo) {
          recommendations.push({
            repository: {
              id: repo.full_name,
              fullName: repo.full_name,
              name: repo.name,
              owner: repo.owner.login,
              description: repo.description || '',
              language: repo.language || 'Unknown',
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              topics: repo.topics || []
            },
            matchScore: Math.min(100, Math.max(0, rec.matchScore)),
            reasoning: rec.reasoning,
            basedOn: {
              languages: rec.matchedLanguages || languages,
              topics: rec.matchedTopics || topics,
              similarTo: rec.similarToAnalyzed || []
            }
          });
        }
      }
      
      return recommendations;
    }, {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      onRetry: (attempt, error) => {
        console.log(`Retrying AI recommendations (attempt ${attempt}):`, error.message);
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    handleGeminiError(error, 'AI recommendations generation');
  }
}

export async function askAI(question: string): Promise<string> {
  // Try Gemini first if available
  if (isGeminiEnabled() && ai) {
    try {
      return await retryHandler.executeWithRetry(async () => {
      const systemPrompt = `You are an AI assistant for RepoRadar (formerly RepoAnalyzer), a GitHub repository analysis platform powered by Google Gemini 2.5 Pro.

CORE FEATURES:

Repository Analysis (5 Metrics):
1. Originality (0-100): Innovation, uniqueness, novel approaches
2. Completeness (0-100): Documentation, tests, maturity, polish
3. Marketability (0-100): Adoption potential, community, growth
4. Monetization (0-100): Revenue potential, business viability
5. Usefulness (0-100): Practical value, problem-solving capability

Each analysis includes:
- Detailed score explanations with reasoning
- 3-5 strengths with evidence
- 3-5 weaknesses with impact analysis
- 3-5 actionable recommendations
- Overall score (weighted average)
- Comprehensive summary

Analysis Process:
- Takes 10-30 seconds per repository
- Fetches real-time data from GitHub
- Uses AI to evaluate code, docs, and community
- Results cached for 24 hours
- Can re-analyze for updated results

NAVIGATION STRUCTURE:

Discover Menu:
- Advanced Search: 15+ filters (language, stars, date, license, topics, forks, issues, etc.)
- Batch Analysis: Analyze multiple repos (3 free, unlimited Pro)
- Compare: Side-by-side comparison of 2-4 repositories
- Discover Trending: Find popular repositories by language/timeframe

Workspace Menu (Pro Features):
- Collections: Organize repositories into custom groups
- Profile: Account settings, preferences, subscription
- Recent Analyses: Quick access to analysis history
- Bookmarks: Save repositories for later

Resources Menu:
- Documentation: Comprehensive guides and help
- Pricing: Free, Pro ($9.99/mo), Enterprise (custom)
- API Reference: Developer documentation
- FAQ: Common questions and answers

SUBSCRIPTION TIERS:

Free Tier:
- 10 analyses per month
- Basic search
- Batch analysis (up to 3 repos)
- PDF/CSV export
- Community support

Pro Tier ($9.99/month):
- Unlimited analyses
- Advanced search (all filters)
- Unlimited batch analysis
- Collections and bookmarks
- AI recommendations
- Priority support
- Analytics dashboard

Enterprise Tier (Custom pricing):
- API access with custom rate limits
- Dedicated support
- Custom integrations
- SLA guarantees
- Team management
- Advanced analytics
- On-premise deployment options

KEY FEATURES:

Batch Analysis:
- Analyze multiple repositories simultaneously
- Real-time progress tracking
- Parallel processing (up to 5 concurrent)
- Export all results together (PDF/CSV)
- Compare results side-by-side

Similar Repositories:
- Find Similar by Metrics: Repositories with similar scores
- Find Similar by Functionality: AI-powered functional similarity
- Similarity scores with reasoning
- Discover alternatives and competitors

Export Options:
- PDF: Professional reports with charts
- CSV: Spreadsheet-compatible data
- JSON: API integration (Pro/Enterprise)
- Batch exports for multiple repositories

Advanced Search:
- 15+ filters including language, stars, forks, issues, license, topics
- Date range filtering (last update, creation date)
- Combine multiple criteria
- Save search templates (Pro)

Collections (Pro):
- Create custom repository groups
- Tag and categorize
- Add notes and comments
- Share with team members
- Quick access organization

Analytics Dashboard (Pro):
- Analysis history and trends
- Search patterns
- Popular repositories
- Language distribution
- Metric averages over time
- Custom reports

AI Recommendations (Pro):
- Personalized repository suggestions
- Based on analysis history and preferences
- Discover new projects in your domain
- Trending in your tech stack

TECHNICAL DETAILS:

Technology Stack:
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- Backend: Node.js, Express, PostgreSQL, Drizzle ORM
- AI: Google Gemini 2.5 Pro
- Caching: Redis (optional, memory fallback)
- Jobs: BullMQ for background processing

Performance:
- Multi-layer caching (memory/Redis)
- Database connection pooling
- Response compression (gzip/brotli)
- Code splitting and lazy loading
- Optimized GitHub API usage

Self-Hosting:
- Node.js 18+ required
- PostgreSQL database (Neon recommended)
- Google Gemini API key required
- Optional: Redis for caching
- Optional: Stripe for payments
- Docker support with multi-instance scaling

COMMON TASKS:

Analyzing a Repository:
1. Paste GitHub URL in search bar (formats: https://github.com/owner/repo, github.com/owner/repo, or owner/repo)
2. Click "Analyze" or press Enter
3. Wait 10-30 seconds
4. Review comprehensive results

Batch Analysis:
1. Navigate to Discover → Batch Analysis
2. Add repository URLs one at a time
3. Click "Start Batch Analysis"
4. Monitor real-time progress
5. Export results when complete

Finding Similar Repositories:
1. Open any analyzed repository
2. Scroll to "Similar Repositories" section
3. Choose "By Metrics" or "By Functionality"
4. Review results and analyze interesting ones

Using Advanced Search:
1. Navigate to Discover → Advanced Search
2. Set filters (language, stars, topics, etc.)
3. Click "Search"
4. Browse results and analyze repositories

Exporting Results:
1. Open analysis results
2. Click "Export" button
3. Choose PDF or CSV format
4. Download starts automatically

TROUBLESHOOTING:

Analysis taking too long:
- Large repos take longer (30-60 seconds)
- Refresh and try again
- Check GitHub Status
- Try smaller repository first

Analysis failed:
- Verify repository URL is correct
- Ensure repository is public (or upgrade to Pro)
- Check if rate limit exceeded
- Wait a few minutes and retry

Can't sign in:
- Enable third-party cookies in browser
- Try incognito/private mode
- Disable browser extensions
- Check GitHub authorization

No search results:
- Remove some filters (may be too restrictive)
- Broaden star count range
- Expand date range
- Check for typos

DOCUMENTATION REFERENCES:

For detailed information, users can find comprehensive guides at:
- Getting Started: /docs/getting-started/
- Feature Guides: /docs/features/
- API Documentation: /docs/API_DOCUMENTATION.md
- FAQ: /docs/faq/
- Troubleshooting: /docs/troubleshooting/

INSTRUCTIONS:

1. Provide helpful, concise answers about RepoRadar features
2. Give step-by-step instructions when asked how to use features
3. Explain metrics and scoring with context
4. Guide users through navigation structure
5. Help troubleshoot common issues
6. Reference documentation for detailed information
7. Be friendly, professional, and supportive
8. Keep answers focused and actionable
9. Use examples when helpful
10. Suggest relevant features users might not know about

RESPONSE STYLE:

- Start with a direct answer
- Provide step-by-step instructions when relevant
- Use bullet points for clarity
- Include examples when helpful
- Mention related features
- Reference documentation for deep dives
- Be encouraging and supportive
- Keep responses concise but complete`;

      const response = await queueGeminiRequest(() => 
        ai!.models.generateContent({
          model: "gemini-2.5-pro",
          config: {
            systemInstruction: systemPrompt,
          },
          contents: question,
        })
      );

      return response.text || "I apologize, but I couldn't generate a response. Please try again.";
    }, {
      maxAttempts: 2, // Fewer retries for interactive chat
      backoff: 'exponential',
      initialDelay: 500,
      onRetry: (attempt, error) => {
        console.log(`Retrying AI assistant (attempt ${attempt}):`, error.message);
      }
    });
    } catch (error) {
      console.error('Error with Gemini AI assistant, trying OpenAI fallback:', error);
      
      // Try OpenAI as fallback
      if (isOpenAIEnabled() && openai) {
        try {
          console.log('Using OpenAI GPT-5 as fallback for AI assistant');
          return await askAIWithOpenAI(question);
        } catch (openaiError) {
          console.error('OpenAI fallback also failed:', openaiError);
          throw new AppError(
            ErrorCodes.EXTERNAL_API_ERROR.code,
            'Both AI services failed',
            'AI assistant is temporarily unavailable.',
            ErrorCodes.EXTERNAL_API_ERROR.statusCode,
            'Please try again in a moment'
          );
        }
      }
      
      // No fallback available
      if (error instanceof AppError) {
        throw error;
      }
      handleGeminiError(error, 'AI assistant');
    }
  }
  
  // If Gemini not available, try OpenAI
  if (isOpenAIEnabled() && openai) {
    try {
      console.log('Gemini not available, using OpenAI GPT-5 for AI assistant');
      return await askAIWithOpenAI(question);
    } catch (error) {
      console.error('Error with OpenAI AI assistant:', error);
      throw new AppError(
        ErrorCodes.EXTERNAL_API_ERROR.code,
        'OpenAI API error',
        'AI assistant is currently unavailable.',
        ErrorCodes.EXTERNAL_API_ERROR.statusCode,
        'Contact support or try again later'
      );
    }
  }
  
  // No AI available
  throw new AppError(
    ErrorCodes.EXTERNAL_API_ERROR.code,
    'No AI API configured',
    'AI assistant is currently unavailable.',
    ErrorCodes.EXTERNAL_API_ERROR.statusCode,
    'Contact support or try again later'
  );
}

export async function analyzeRepository(repo: RepositoryAnalysisInput): Promise<RepositoryAnalysisResult> {
  // Try Gemini first if available
  if (isGeminiEnabled() && ai) {
    try {
      return await retryHandler.executeWithRetry(async () => {
      const systemPrompt = `You are an expert software repository analyst. Analyze the given repository and provide a comprehensive evaluation with detailed reasoning.

Rate each aspect from 1-10 and provide detailed insights:
1. Originality: How unique and innovative is this project? Consider novelty of approach, creative problem-solving, and differentiation from existing solutions.
2. Completeness: How complete and production-ready is the codebase? Consider documentation, testing, error handling, and polish.
3. Marketability: How appealing would this be to users/customers? Consider demand, user experience, and competitive positioning.
4. Monetization: What are the potential revenue opportunities? Consider business models, target market size, and value proposition.
5. Usefulness: How practically useful is this project? Consider real-world applicability, problem severity, and user impact.

Provide detailed explanations for WHY each score was given.
Include:
- A concise summary (2-3 sentences)
- 3-5 key strengths with clear reasoning
- 3-5 areas for improvement with specific explanations
- 3-5 actionable recommendations with expected impact

Respond with valid JSON in this exact format:
{
  "originality": number,
  "completeness": number,
  "marketability": number,
  "monetization": number,
  "usefulness": number,
  "overallScore": number,
  "summary": "string",
  "strengths": [
    {
      "point": "Brief strength statement",
      "reason": "Detailed explanation of why this is a strength and what evidence supports it"
    }
  ],
  "weaknesses": [
    {
      "point": "Brief weakness statement",
      "reason": "Detailed explanation of why this is a weakness and how it impacts the project"
    }
  ],
  "recommendations": [
    {
      "suggestion": "Specific actionable recommendation",
      "reason": "Why this recommendation would help",
      "impact": "Expected positive impact on the project"
    }
  ],
  "scoreExplanations": {
    "originality": "Detailed reasoning for the originality score",
    "completeness": "Detailed reasoning for the completeness score",
    "marketability": "Detailed reasoning for the marketability score",
    "monetization": "Detailed reasoning for the monetization score",
    "usefulness": "Detailed reasoning for the usefulness score"
  }
}`;

      const repoInfo = `
Repository: ${repo.name}
Description: ${repo.description}
Primary Language: ${repo.language}
Stars: ${repo.stars}
Forks: ${repo.forks}
Size: ${repo.size} KB
Languages: ${JSON.stringify(repo.languages)}
Topics: ${repo.topics.join(', ')}
${repo.readme ? `README Preview: ${repo.readme.substring(0, 2000)}...` : 'No README available'}
`;

      const response = await queueGeminiRequest(() =>
        ai!.models.generateContent({
          model: "gemini-2.5-pro",
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                originality: { type: "number" },
                completeness: { type: "number" },
                marketability: { type: "number" },
                monetization: { type: "number" },
                usefulness: { type: "number" },
                overallScore: { type: "number" },
                summary: { type: "string" },
                strengths: { 
                  type: "array", 
                  items: { 
                    type: "object",
                    properties: {
                      point: { type: "string" },
                      reason: { type: "string" }
                    },
                    required: ["point", "reason"]
                  } 
                },
                weaknesses: { 
                  type: "array", 
                  items: { 
                    type: "object",
                    properties: {
                      point: { type: "string" },
                      reason: { type: "string" }
                    },
                    required: ["point", "reason"]
                  } 
                },
                recommendations: { 
                  type: "array", 
                  items: { 
                    type: "object",
                    properties: {
                      suggestion: { type: "string" },
                      reason: { type: "string" },
                      impact: { type: "string" }
                    },
                    required: ["suggestion", "reason", "impact"]
                  } 
                },
                scoreExplanations: {
                  type: "object",
                  properties: {
                    originality: { type: "string" },
                    completeness: { type: "string" },
                    marketability: { type: "string" },
                    monetization: { type: "string" },
                    usefulness: { type: "string" }
                  },
                  required: ["originality", "completeness", "marketability", "monetization", "usefulness"]
                }
              },
              required: ["originality", "completeness", "marketability", "monetization", "usefulness", "overallScore", "summary", "strengths", "weaknesses", "recommendations", "scoreExplanations"]
            }
          },
          contents: repoInfo
        })
      );

      const result = JSON.parse(response.text || '{}');
      
      // Ensure all scores are between 1-10
      ['originality', 'completeness', 'marketability', 'monetization', 'usefulness', 'overallScore'].forEach(key => {
        if (result[key]) {
          result[key] = Math.max(1, Math.min(10, result[key]));
        }
      });

      return result;
    }, {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      onRetry: (attempt, error) => {
        console.log(`Retrying repository analysis (attempt ${attempt}):`, error.message);
      }
    });
    } catch (error) {
      console.error('Error analyzing repository with Gemini, trying OpenAI fallback:', error);
      
      // Try OpenAI as fallback
      if (isOpenAIEnabled() && openai) {
        try {
          console.log('Using OpenAI GPT-5 as fallback for repository analysis');
          return await analyzeRepositoryWithOpenAI(repo);
        } catch (openaiError) {
          console.error('OpenAI fallback also failed:', openaiError);
        }
      }
      
      // If both fail or OpenAI not available, use basic fallback
      return createFallbackAnalysis(repo);
    }
  }
  
  // If Gemini not available, try OpenAI
  if (isOpenAIEnabled() && openai) {
    try {
      console.log('Gemini not available, using OpenAI GPT-5 for repository analysis');
      return await analyzeRepositoryWithOpenAI(repo);
    } catch (error) {
      console.error('Error analyzing repository with OpenAI:', error);
      return createFallbackAnalysis(repo);
    }
  }
  
  // No AI available, return basic fallback
  return createFallbackAnalysis(repo);
}

function createFallbackAnalysis(repo: RepositoryAnalysisInput): RepositoryAnalysisResult {
  // Calculate basic scores based on repository metrics
  return {
      originality: 5,
      completeness: 5,
      marketability: 5,
      monetization: 5,
      usefulness: 5,
      overallScore: 5,
      summary: "Analysis unavailable due to API error. This repository appears to be a standard project in the " + repo.language + " ecosystem.",
      strengths: [
        {
          point: "Active community engagement",
          reason: "The repository shows signs of community involvement based on stars and forks"
        },
        {
          point: "Clear documentation",
          reason: "Repository includes documentation that helps users understand the project"
        },
        {
          point: "Stable codebase",
          reason: "The project appears to have a mature and stable code structure"
        }
      ],
      weaknesses: [
        {
          point: "Analysis temporarily unavailable",
          reason: "Full AI analysis could not be completed at this time"
        },
        {
          point: "Unable to assess current state",
          reason: "Detailed metrics cannot be evaluated without AI assistance"
        }
      ],
      recommendations: [
        {
          suggestion: "Review project documentation",
          reason: "Manual review can provide insights that automated analysis missed",
          impact: "Better understanding of project capabilities and limitations"
        },
        {
          suggestion: "Analyze code quality manually",
          reason: "Direct code inspection can reveal architectural patterns and quality",
          impact: "Identification of potential improvements and optimizations"
        }
      ],
      scoreExplanations: {
        originality: "Score based on standard assessment - full analysis unavailable",
        completeness: "Score based on standard assessment - full analysis unavailable",
        marketability: "Score based on standard assessment - full analysis unavailable",
        monetization: "Score based on standard assessment - full analysis unavailable",
        usefulness: "Score based on standard assessment - full analysis unavailable"
      }
    };
}

export interface SimilaritySearchParams {
  name: string;
  description: string;
  language: string;
  topics: string[];
  functionality?: string;
  useCase?: string;
  technologies?: string[];
}

export async function findSimilarRepositories(repo: RepositoryAnalysisInput): Promise<string[]> {
  if (!isGeminiEnabled() || !ai) {
    return []; // Return empty array when AI is not available
  }

  try {
    return await retryHandler.executeWithRetry(async () => {
      const prompt = `Given this repository information:
Name: ${repo.name}
Description: ${repo.description}
Language: ${repo.language}
Topics: ${repo.topics.join(', ')}

Find 3-5 similar GitHub repositories. Return only repository names in format "owner/repo-name", one per line.
Focus on repositories with similar functionality, technology stack, or problem domain.`;

      const response = await ai!.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      const text = response.text || '';
      const repos = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('/') && !line.includes(' '))
        .slice(0, 5);

      return repos;
    }, {
      maxAttempts: 2,
      backoff: 'exponential',
      initialDelay: 500,
      onRetry: (attempt, error) => {
        console.log(`Retrying similar repositories search (attempt ${attempt}):`, error.message);
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error('Error finding similar repositories:', error.userMessage);
    } else {
      console.error('Error finding similar repositories:', error);
    }
    return []; // Return empty array on error
  }
}

export async function findSimilarByFunctionality(params: SimilaritySearchParams): Promise<{
  repositories: string[];
  reasoning: string;
  similarity_scores: { [key: string]: number };
}> {
  if (!isGeminiEnabled() || !ai) {
    return {
      repositories: [],
      reasoning: "AI-powered similarity search is currently unavailable.",
      similarity_scores: {}
    };
  }

  try {
    return await retryHandler.executeWithRetry(async () => {
      const systemPrompt = `You are an expert at analyzing GitHub repositories and finding similar projects based on functionality, use cases, and technology stack.
    
    When finding similar repositories, consider:
    1. Core functionality and problem domain
    2. Intended use cases and target audience
    3. Technology stack and architecture patterns
    4. Features and capabilities
    5. Industry or domain focus
    
    Return a structured analysis with repository recommendations and similarity scores.`;

      const prompt = `Analyze this repository and find similar projects:

Repository: ${params.name}
Description: ${params.description}
Primary Language: ${params.language}
Topics/Tags: ${params.topics.join(', ')}
${params.functionality ? `Core Functionality: ${params.functionality}` : ''}
${params.useCase ? `Use Case: ${params.useCase}` : ''}
${params.technologies ? `Technologies: ${params.technologies.join(', ')}` : ''}

Find 5-8 highly similar GitHub repositories that:
1. Solve similar problems or serve similar purposes
2. Use comparable technology stacks
3. Target similar use cases or audiences
4. Have active development and community

Provide similarity scores (0-100) based on:
- Functional similarity (40% weight)
- Technology stack match (30% weight)
- Use case alignment (20% weight)
- Domain/industry match (10% weight)`;

      const response = await ai!.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              repositories: { 
                type: "array", 
                items: { type: "string" },
                description: "List of similar repository names in format 'owner/repo'"
              },
              reasoning: { 
                type: "string",
                description: "Explanation of why these repositories are similar"
              },
              similarity_scores: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    repository: { type: "string" },
                    score: { type: "number" }
                  },
                  required: ["repository", "score"]
                },
                description: "Similarity scores for each repository (0-100)"
              }
            },
            required: ["repositories", "reasoning", "similarity_scores"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || '{}');
      
      // Ensure we have valid data
      if (!result.repositories || !Array.isArray(result.repositories)) {
        result.repositories = [];
      }
      
      // Filter and validate repository names
      result.repositories = result.repositories
        .filter((repo: string) => repo && repo.includes('/'))
        .slice(0, 8);
      
      return result;
    }, {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      onRetry: (attempt, error) => {
        console.log(`Retrying similarity search (attempt ${attempt}):`, error.message);
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error('Error finding similar repositories by functionality:', error.userMessage);
    } else {
      console.error('Error finding similar repositories by functionality:', error);
    }
    return {
      repositories: [],
      reasoning: "Unable to find similar repositories at this time.",
      similarity_scores: {}
    };
  }
}