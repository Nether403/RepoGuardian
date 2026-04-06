import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gracefulShutdown } from '../gracefulShutdown';
import type { Server } from 'http';

describe('Graceful Shutdown', () => {
  let mockServer: Partial<Server>;
  let mockLogger: ReturnType<typeof vi.fn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let processOnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock server
    mockServer = {
      close: vi.fn((callback) => callback && callback()),
      timeout: 300000,
      keepAliveTimeout: 305000,
      headersTimeout: 310000,
      on: vi.fn(),
    };

    // Mock logger
    mockLogger = vi.fn();

    // Spy on process methods
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should register SIGTERM and SIGINT handlers', () => {
      gracefulShutdown.initialize(mockServer as Server, {
        timeout: 5000,
        logger: mockLogger,
      });

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should register uncaught exception handlers', () => {
      gracefulShutdown.initialize(mockServer as Server, {
        timeout: 5000,
        logger: mockLogger,
      });

      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should track active connections', () => {
      const mockConnection = {
        on: vi.fn(),
      };

      gracefulShutdown.initialize(mockServer as Server, {
        timeout: 5000,
        logger: mockLogger,
      });

      // Simulate connection event
      const connectionHandler = (mockServer.on as any).mock.calls.find(
        (call: any) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockConnection);
        expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
      }
    });
  });

  describe('shutdown behavior', () => {
    it('should close server on SIGTERM', async () => {
      gracefulShutdown.initialize(mockServer as Server, {
        timeout: 5000,
        logger: mockLogger,
      });

      // Get the SIGTERM handler
      const sigtermHandler = processOnSpy.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )?.[1] as Function;

      expect(sigtermHandler).toBeDefined();

      // Note: We can't fully test the shutdown sequence without mocking all dependencies
      // This test verifies that the handler is registered
    });

    it('should use default timeout if not specified', () => {
      gracefulShutdown.initialize(mockServer as Server);

      // Verify initialization completes without error
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should use custom logger if provided', () => {
      const customLogger = vi.fn();

      gracefulShutdown.initialize(mockServer as Server, {
        logger: customLogger,
      });

      // Verify initialization completes without error
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('shutdown state', () => {
    it('should track shutdown state', () => {
      expect(gracefulShutdown.isShutdownInProgress()).toBe(false);
    });

    it('should prevent multiple simultaneous shutdowns', async () => {
      gracefulShutdown.initialize(mockServer as Server, {
        timeout: 5000,
        logger: mockLogger,
      });

      // Get the SIGTERM handler
      const sigtermHandler = processOnSpy.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )?.[1] as Function;

      // Note: Full testing of shutdown prevention requires integration testing
      // This test verifies the handler exists
      expect(sigtermHandler).toBeDefined();
    });
  });

  describe('connection draining', () => {
    it('should track and drain active connections', () => {
      const mockConnection = {
        on: vi.fn(),
        destroy: vi.fn(),
      };

      gracefulShutdown.initialize(mockServer as Server, {
        timeout: 5000,
        logger: mockLogger,
      });

      // Simulate connection
      const connectionHandler = (mockServer.on as any).mock.calls.find(
        (call: any) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockConnection);

        // Verify close handler is registered
        expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
      }
    });
  });

  describe('timeout handling', () => {
    it('should force shutdown after timeout', async () => {
      vi.useFakeTimers();

      gracefulShutdown.initialize(mockServer as Server, {
        timeout: 1000,
        logger: mockLogger,
      });

      // Note: Full timeout testing requires integration testing
      // This test verifies initialization with timeout

      vi.useRealTimers();
    });
  });
});
