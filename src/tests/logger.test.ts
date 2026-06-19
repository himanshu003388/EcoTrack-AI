import { logger } from '../infrastructure/logger';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe.sequential('Logger utility', () => {
  let consoleDebugSpy: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should log debug, info, warn, and error messages', () => {
    const oldLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';

    logger.debug('test debug');
    logger.info('test info');
    logger.warn('test warn');
    logger.error('test error');

    // Also test with details
    logger.debug('test debug details', { foo: 'bar' });
    logger.info('test info details', { foo: 'bar' });
    logger.warn('test warn details', { foo: 'bar' });
    logger.error('test error details', { foo: 'bar' });

    expect(consoleDebugSpy).toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    process.env.LOG_LEVEL = oldLevel;
  });

  it('should sanitize sensitive keys in production mode', () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    logger.info('sanitization check', {
      password: 'secret123',
      safeField: 'hello',
      password_hash: 'somehash',
    });

    const call = consoleInfoSpy.mock.calls.find((c: any) => c[0].includes('sanitization check'));
    expect(call).toBeDefined();
    const loggedDetails = call[1];
    expect(loggedDetails).toBeDefined();
    expect(loggedDetails.password).toBe('[REDACTED]');
    expect(loggedDetails.password_hash).toBe('[REDACTED]');
    expect(loggedDetails.safeField).toBe('hello');

    process.env.NODE_ENV = oldEnv;
  });

  it('should return raw details if details are not an object', () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    logger.info('primitive details check', 'simple string details');

    const call = consoleInfoSpy.mock.calls.find((c: any) => c[0].includes('primitive details check'));
    expect(call).toBeDefined();
    const loggedDetails = call[1];
    expect(loggedDetails).toBe('simple string details');

    process.env.NODE_ENV = oldEnv;
  });

  it('should filter log messages below the current level', () => {
    const oldLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';

    logger.debug('should not log debug');
    logger.info('should not log info');
    logger.warn('should log warn');
    logger.error('should log error');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    process.env.LOG_LEVEL = oldLevel;
  });

  it('should fall back to correct defaults when LOG_LEVEL is undefined', () => {
    const oldLevel = process.env.LOG_LEVEL;
    const oldEnv = process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;

    // Production environment fallback
    process.env.NODE_ENV = 'production';
    logger.debug('debug in prod');
    logger.info('info in prod');
    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalled();

    consoleInfoSpy.mockClear();

    // Non-production environment fallback
    process.env.NODE_ENV = 'development';
    logger.debug('debug in dev');
    expect(consoleDebugSpy).toHaveBeenCalled();

    process.env.LOG_LEVEL = oldLevel;
    process.env.NODE_ENV = oldEnv;
  });
});
