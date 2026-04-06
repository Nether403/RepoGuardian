/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { RepoFileTree } from '../types';

export async function fetchRepoFileTree(owner: string, repo: string): Promise<RepoFileTree[]> {
  // Common default branch names to try
  const branches = ['main', 'master'];

  for (const branch of branches) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

      if (response.ok) {
        const data = await response.json();
        
        if (data.truncated) {
          console.warn('Warning: Repository tree is too large and was truncated by GitHub API.');
        }

        // Filter for relevant code and config files to reduce noise for the AI
        return (data.tree || []).filter((item: any) => 
          item.type === 'blob' && 
          item.path.match(/\.(js|jsx|ts|tsx|py|go|rs|java|c|cpp|h|hpp|cs|php|rb|swift|kt|dart|json|yaml|yml|toml|xml|html|css)$/i) &&
          !item.path.includes('node_modules') &&
          !item.path.includes('dist/') &&
          !item.path.includes('build/') &&
          !item.path.startsWith('.')
        );
      }

      // Handle specific GitHub API error codes
      if (response.status === 403 || response.status === 429) {
        throw new Error('GitHub API rate limit exceeded. Please try again later (usually resets in an hour).');
      }

      // If it's a 404, we just continue to the next loop iteration to try the next branch.
      
    } catch (error: any) {
      // If we explicitly threw a rate limit error above, rethrow it immediately to stop trying other branches.
      if (error.message.includes('rate limit')) {
        throw error;
      }
      // Network errors or other issues might also justify stopping, but we'll let them fall through for now 
      // unless it's the last branch.
      if (branch === branches[branches.length - 1]) {
         console.error('Error fetching repo tree:', error);
      }
    }
  }

  // If we exit the loop without returning, none of the branches worked.
  throw new Error(`Failed to fetch repository. It might be private, non-existent, or using a non-standard default branch (checked: ${branches.join(', ')}).`);
}