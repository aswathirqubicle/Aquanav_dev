
// Global test setup
import { jest } from '@jest/globals';

// Mock console methods to reduce noise during testing
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
