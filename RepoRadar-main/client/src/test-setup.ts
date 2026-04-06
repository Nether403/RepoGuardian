import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as axeMatchers from 'vitest-axe/matchers';

// Extend Vitest matchers with axe-core matchers
expect.extend(axeMatchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
