/* eslint-disable no-console */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: number;
  details?: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const envLogLevel = process.env.LOG_LEVEL;
const currentLevel: LogLevel =
  envLogLevel === 'debug' || envLogLevel === 'info' || envLogLevel === 'warn' || envLogLevel === 'error'
    ? envLogLevel
    : process.env.NODE_ENV === 'production'
      ? 'info'
      : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function sanitizeForProduction(details: unknown): unknown {
  if (process.env.NODE_ENV !== 'production') return details;
  if (typeof details === 'object' && details !== null) {
    const safe = { ...(details as Record<string, unknown>) };
    const sensitiveKeys = ['password', 'secret', 'token', 'authorization', 'cookie', 'set-cookie', 'password_hash'];
    for (const key of Object.keys(safe)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        safe[key] = '[REDACTED]';
      }
    }
    return safe;
  }
  return details;
}

function emit(level: LogLevel, message: string, details?: unknown): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    details: sanitizeForProduction(details),
  };

  const prefix = `[EcoTrack AI] [${entry.timestamp}] [${level.toUpperCase()}]`;

  const hasDetails = details !== undefined;
  const fullMsg = `${prefix} ${message}`;

  switch (level) {
    case 'error':
      if (hasDetails) {
        console.error(fullMsg, details);
      } else {
        console.error(fullMsg);
      }
      break;
    case 'warn':
      if (hasDetails) {
        console.warn(fullMsg, details);
      } else {
        console.warn(fullMsg);
      }
      break;
    case 'info':
      if (hasDetails) {
        console.info(fullMsg, details);
      } else {
        console.info(fullMsg);
      }
      break;
    case 'debug':
      if (hasDetails) {
        console.debug(fullMsg, details);
      } else {
        console.debug(fullMsg);
      }
      break;
  }
}

export const logger = {
  debug: (message: string, details?: unknown): void => emit('debug', message, details),
  info: (message: string, details?: unknown): void => emit('info', message, details),
  warn: (message: string, details?: unknown): void => emit('warn', message, details),
  error: (message: string, details?: unknown): void => emit('error', message, details),
};
