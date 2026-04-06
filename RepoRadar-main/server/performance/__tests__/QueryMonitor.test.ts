import { describe, it, expect } from 'vitest';
import { QueryMonitor } from '../QueryMonitor';

describe('QueryMonitor', () => {
  it('should create an instance', () => {
    const queryMonitor = new QueryMonitor();
    expect(queryMonitor).toBeDefined();
  });
});