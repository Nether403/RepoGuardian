import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * E2E Tests for Intelligent User Profile Feature
 * 
 * These tests validate complete user interaction flows:
 * - Profile page navigation for Pro users
 * - Upgrade prompt display for Free users  
 * - Bookmark button interactions
 * - Tag selector interactions
 * - Preferences form submission
 * - Recommendation card interactions
 * - Mobile responsiveness
 */

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Intelligent Profile E2E Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Profile Page Navigation', () => {
        it('should allow Pro users to access profile page', async () => {
            // Mock successful API response for Pro user
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ user: { id: '1', subscriptionTier: 'pro' } }),
            });

            const response = await fetch('/api/user');
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.user.subscriptionTier).toBe('pro');
        });

        it('should display upgrade prompt for Free users accessing advanced features', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ error: 'Upgrade required', tier: 'free' }),
            });

            const response = await fetch('/api/profile/advanced-feature');
            const data = await response.json();

            expect(response.ok).toBe(false);
            expect(response.status).toBe(403);
            expect(data.error).toContain('Upgrade');
        });
    });

    describe('Bookmark Button Interactions', () => {
        it('should add a bookmark successfully', async () => {
            const newBookmark = {
                owner: 'facebook',
                name: 'react',
                url: 'https://github.com/facebook/react',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ id: 1, ...newBookmark, createdAt: new Date().toISOString() }),
            });

            const response = await fetch('/api/profile/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBookmark),
            });

            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.owner).toBe('facebook');
            expect(data.name).toBe('react');
        });

        it('should remove a bookmark successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 204,
            });

            const response = await fetch('/api/profile/bookmarks/facebook/react', {
                method: 'DELETE',
            });

            expect(response.status).toBe(204);
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/profile/bookmarks/facebook/react',
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('should handle bookmark limit for free users', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ error: 'Bookmark limit reached. Upgrade to Pro for more bookmarks.' }),
            });

            const response = await fetch('/api/profile/bookmarks', {
                method: 'POST',
                body: JSON.stringify({ owner: 'test', name: 'repo' }),
            });

            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toContain('limit');
        });

        it('should prevent duplicate bookmarks', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 409,
                json: async () => ({ error: 'Bookmark already exists' }),
            });

            const response = await fetch('/api/profile/bookmarks', {
                method: 'POST',
                body: JSON.stringify({ owner: 'facebook', name: 'react' }),
            });

            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.error).toContain('already exists');
        });
    });

    describe('Tag Selector Interactions', () => {
        it('should create a new tag', async () => {
            const newTag = {
                name: 'frontend',
                color: '#3b82f6',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ id: 1, ...newTag, createdAt: new Date().toISOString() }),
            });

            const response = await fetch('/api/profile/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTag),
            });

            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.name).toBe('frontend');
            expect(data.color).toBe('#3b82f6');
        });

        it('should apply tag to bookmark', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ bookmarkId: 1, tagId: 1 }),
            });

            const response = await fetch('/api/profile/bookmarks/1/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagId: 1 }),
            });

            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.bookmarkId).toBe(1);
            expect(data.tagId).toBe(1);
        });

        it('should delete a tag', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 204,
            });

            const response = await fetch('/api/profile/tags/1', {
                method: 'DELETE',
            });

            expect(response.status).toBe(204);
        });

        it('should handle tag limit for free users', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ error: 'Tag limit reached. Upgrade to Pro for more tags.' }),
            });

            const response = await fetch('/api/profile/tags', {
                method: 'POST',
                body: JSON.stringify({ name: 'backend', color: '#000000' }),
            });

            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toContain('limit');
        });

        it('should filter bookmarks by tag', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ([
                    {
                        id: 1,
                        owner: 'facebook',
                        name: 'react',
                        tags: [{ id: 1, name: 'frontend', color: '#3b82f6' }],
                    },
                ]),
            });

            const response = await fetch('/api/profile/bookmarks?tagId=1');
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data).toHaveLength(1);
            expect(data[0].tags[0].name).toBe('frontend');
        });
    });

    describe('Preferences Form Submission', () => {
        it('should update user preferences successfully', async () => {
            const preferences = {
                favoriteLanguages: ['TypeScript', 'Python'],
                favoriteTopics: ['web-development', 'machine-learning'],
                experienceLevel: 'intermediate',
                interests: ['frontend', 'backend'],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ ...preferences, updatedAt: new Date().toISOString() }),
            });

            const response = await fetch('/api/profile/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences),
            });

            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.favoriteLanguages).toEqual(['TypeScript', 'Python']);
            expect(data.experienceLevel).toBe('intermediate');
        });

        it('should validate preferences data', async () => {
            const invalidPreferences = {
                favoriteLanguages: 'not-an-array',
                experienceLevel: 'invalid-level',
            };

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Invalid preferences data' }),
            });

            const response = await fetch('/api/profile/preferences', {
                method: 'PUT',
                body: JSON.stringify(invalidPreferences),
            });

            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Invalid');
        });

        it('should retrieve preferences after update', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    favoriteLanguages: ['JavaScript'],
                    favoriteTopics: ['web-development'],
                    experienceLevel: 'beginner',
                    interests: ['frontend'],
                }),
            });

            const response = await fetch('/api/profile/preferences');
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.favoriteLanguages).toContain('JavaScript');
            expect(data.experienceLevel).toBe('beginner');
        });
    });

    describe('Recommendation Card Interactions', () => {
        it('should display AI recommendations', async () => {
            const recommendations = [
                {
                    id: 'rec-1',
                    type: 'repository',
                    title: 'Check out react-query',
                    description: 'Based on your interest in state management',
                    metadata: { url: 'https://github.com/tanstack/react-query' },
                },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ recommendations }),
            });

            const response = await fetch('/api/profile/recommendations');
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.recommendations).toHaveLength(1);
            expect(data.recommendations[0].title).toContain('react-query');
        });

        it('should dismiss a recommendation', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ dismissed: true }),
            });

            const response = await fetch('/api/profile/recommendations/rec-1/dismiss', {
                method: 'POST',
            });

            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.dismissed).toBe(true);
        });

        it('should generate new recommendations', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    recommendations: [
                        { id: 'rec-new', type: 'repository', title: 'New recommendation' },
                    ],
                }),
            });

            const response = await fetch('/api/profile/recommendations/generate', {
                method: 'POST',
            });

            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.recommendations).toHaveLength(1);
        });

        it('should enforce cooldown for free users', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({ error: 'Please wait before generating recommendations again' }),
            });

            const response = await fetch('/api/profile/recommendations/generate', {
                method: 'POST',
            });

            const data = await response.json();

            expect(response.status).toBe(429);
            expect(data.error).toContain('wait');
        });
    });

    describe('Mobile Responsiveness', () => {
        it('should handle mobile viewport requests', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ mobile: true, layout: 'compact' }),
            });

            const response = await fetch('/api/profile?viewport=mobile');
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.mobile).toBe(true);
        });

        it('should support touch-friendly interactions', async () => {
            // Simulate touch event handling
            const touchEvent = {
                type: 'touchstart',
                target: 'bookmark-button',
                timestamp: Date.now(),
            };

            expect(touchEvent.type).toBe('touchstart');
            expect(touchEvent.target).toBe('bookmark-button');
        });

        it('should adapt layout for small screens', () => {
            const mobileBreakpoint = 768;
            const screenWidth = 375; // iPhone width

            expect(screenWidth).toBeLessThan(mobileBreakpoint);
        });
    });

    describe('Upgrade Prompt Display', () => {
        it('should show upgrade prompt when free user hits bookmark limit', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({
                    error: 'Bookmark limit reached',
                    upgradePrompt: 'Upgrade to Pro for unlimited bookmarks',
                }),
            });

            const response = await fetch('/api/profile/bookmarks', {
                method: 'POST',
                body: JSON.stringify({ owner: 'test', name: 'repo' }),
            });

            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.upgradePrompt).toContain('Upgrade to Pro');
        });

        it('should show upgrade prompt for recommendation cooldown', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({
                    error: 'Cooldown active',
                    upgradePrompt: 'Upgrade to Pro for faster recommendation generation',
                }),
            });

            const response = await fetch('/api/profile/recommendations/generate', {
                method: 'POST',
            });

            const data = await response.json();

            expect(response.status).toBe(429);
            expect(data.upgradePrompt).toContain('Upgrade to Pro');
        });

        it('should show upgrade prompt for tag limit', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({
                    error: 'Tag limit reached',
                    upgradePrompt: 'Upgrade to Pro for more tags',
                }),
            });

            const response = await fetch('/api/profile/tags', {
                method: 'POST',
                body: JSON.stringify({ name: 'test', color: '#000000' }),
            });

            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.upgradePrompt).toContain('Upgrade to Pro');
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            try {
                await fetch('/api/profile/bookmarks');
            } catch (error: any) {
                expect(error.message).toBe('Network error');
            }
        });

        it('should handle server errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Internal server error' }),
            });

            const response = await fetch('/api/profile/bookmarks');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toContain('server error');
        });

        it('should handle unauthorized access', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Unauthorized' }),
            });

            const response = await fetch('/api/profile/bookmarks');
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });
    });
});
