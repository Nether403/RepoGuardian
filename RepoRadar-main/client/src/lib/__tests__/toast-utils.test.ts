import { describe, it, expect } from 'vitest';
import { toastMessages, createToast } from '../toast-utils';

describe('toast-utils', () => {
  describe('toastMessages.success', () => {
    it('should create saved message', () => {
      const result = toastMessages.success.saved('Repository');
      expect(result.title).toBe('Repository Saved');
      expect(result.description).toContain('saved successfully');
    });

    it('should create created message', () => {
      const result = toastMessages.success.created('Team');
      expect(result.title).toBe('Team Created');
      expect(result.description).toContain('created successfully');
    });

    it('should create found message with count', () => {
      const result = toastMessages.success.found(5, 'repositories');
      expect(result.title).toBe('repositories Found');
      expect(result.description).toContain('Found 5');
    });
  });

  describe('toastMessages.error', () => {
    it('should create generic error message', () => {
      const result = toastMessages.error.generic('save the file');
      expect(result.title).toBe('Error');
      expect(result.description).toContain('Failed to save the file');
      expect(result.variant).toBe('destructive');
    });

    it('should create unauthorized message', () => {
      const result = toastMessages.error.unauthorized();
      expect(result.title).toBe('Unauthorized');
      expect(result.variant).toBe('destructive');
    });

    it('should create validation error', () => {
      const result = toastMessages.error.validation('Email is required');
      expect(result.title).toBe('Validation Error');
      expect(result.description).toBe('Email is required');
    });
  });

  describe('createToast', () => {
    it('should create custom toast', () => {
      const result = createToast('Custom Title', 'Custom description', 'destructive');
      expect(result.title).toBe('Custom Title');
      expect(result.description).toBe('Custom description');
      expect(result.variant).toBe('destructive');
    });
  });
});
