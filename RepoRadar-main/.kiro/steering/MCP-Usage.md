<!-----------------------------------------------------# MCP Server Usage Guidelines

## Available MCP Servers
You have access to these MCP servers and should use them proactively when relevant:

### Neon (ENABLED - 25+ tools)
- **When to use**: For database operations, migrations, schema management, and SQL queries
- **How**: Use Neon MCP tools for database management, running queries, creating branches, and migrations
- **Example scenarios**: 
  - "Create a new table in the database"
  - "Run a migration to add a column"
  - "Query the database for user records"
  - "Create a development branch for testing schema changes"
  - "Optimize slow queries"
- **Key capabilities**: 
  - Database schema management and migrations
  - SQL query execution and transactions
  - Branch management for safe testing
  - Query performance analysis and tuning
  - Connection string generation

### Context7 (ENABLED - 2 tools)
- **When to use**: For any coding questions, API references, or documentation needs
- **How**: Use the resolve-library-id and get-library-docs tools for up-to-date documentation
- **Example scenarios**: "How do I use React hooks?", "Show me Next.js routing examples", "What's the latest MongoDB syntax?"

### Fetch (ENABLED - 1 tool)
- **When to use**: For retrieving web content, scraping URLs, or fetching external data
- **How**: Use the fetch tool to get webpage content as markdown or raw HTML
- **Example scenarios**: 
  - "Fetch the content from this URL"
  - "Scrape data from this website"
  - "Get the documentation from this page"

### VibeCheck (ENABLED - 3-4 tools)
- **When to use**: For complex decisions, planning, or when the user seems uncertain
- **How**: Use vibe_check tool to identify assumptions and prevent tunnel vision
- **Example scenarios**: Architecture decisions, debugging complex issues, project planning

### Shadcn (ENABLED - 3-5 tools)
- **When to use**: For adding or managing shadcn/ui components in the project
- **How**: Use shadcn MCP tools to add components, check available components, or get component info
- **Example scenarios**: 
  - "Add a new dialog component"
  - "What shadcn components are available?"
  - "Install the data-table component"

### Toolbox (ENABLED - 1 tool)
- **When to use**: When the user needs functionality not covered by existing servers
- **How**: Search for relevant MCP servers and offer to install them
- **Example scenarios**: "I need database tools", "Help with AWS", "API testing tools"

### Chrome DevTools (ENABLED - 25+ tools)
- **When to use**: For web testing, browser automation, or performance analysis
- **Status**: Currently disabled to reduce token costs
- **How to enable**: Ask user to enable it when needed
- **Example scenarios**: Testing web apps, taking screenshots, performance audits, browser automation

## On-Demand MCP Server Protocol

**When you need a disabled MCP server:**
1. **Identify the need**: Recognize when a task requires a disabled server
2. **Ask the user**: "I'd like to use [Server Name] for [specific task]. It's currently disabled. Would you like me to help you enable it?"
3. **Wait for confirmation**: Don't proceed until the user agrees
4. **Provide instructions**: Tell them they can enable it via:
   - MCP Server view in Kiro (reconnects automatically)
   - Or you can update the config file for them

**Example:**
"To test this web interface properly, I'd like to use Chrome DevTools MCP server for browser automation and screenshots. It's currently disabled to save tokens. Would you like to enable it for this session?"

## Proactive Usage Rules
1. **Always use Neon** for database operations - don't write manual SQL files or suggest running migrations manually
2. **Always suggest Context7** when user asks coding questions - don't rely on potentially outdated training data
3. **Use Fetch** when user mentions URLs or needs to retrieve web content
4. **Use VibeCheck** when user seems stuck or making complex technical decisions
5. **Ask to enable Chrome DevTools** when web testing, performance analysis, or browser automation is needed
6. **Use Shadcn** when adding UI components to maintain consistency with the existing component library
7. **Search toolbox** when user mentions needing tools for specific platforms/services

## Default Behavior
- Mention which MCP server you're using and why
- If a disabled server would be helpful, ask to enable it before proceeding
- If multiple servers could help, explain the options
- Always prefer fresh documentation over training data for coding questions
- For database work, always use Neon MCP instead of manual file operations
- Respect token budgets by only requesting disabled servers when truly beneficial
------------------------------
-------------------------------------------------------------------------------------> 