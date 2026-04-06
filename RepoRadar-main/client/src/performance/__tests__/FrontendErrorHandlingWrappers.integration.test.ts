/**
 * Integration tests for frontend error handling wrappers
 * Tests error handling and logging integration with frontend performance components
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import {
  ErrorHandledCodeSplitter,
  ErrorHandledLazyLoader,
  E