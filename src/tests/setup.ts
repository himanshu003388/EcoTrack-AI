import '@testing-library/jest-dom/vitest';
import { vi, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Use a unique database file per test suite to prevent parallel test suites from stomping on each other's data
const uniqueDbName = `ecotrack.test.${Math.random().toString(36).substring(2, 9)}.db`;
const uniqueDbPath = path.resolve(process.cwd(), uniqueDbName);
process.env.SQLITE_DB_PATH = uniqueDbPath;

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long!!';

// Clean up the unique database file after the test suite completes
afterAll(() => {
  if (fs.existsSync(uniqueDbPath)) {
    try {
      fs.unlinkSync(uniqueDbPath);
    } catch {
      // Ignored if file is locked or already deleted
    }
  }
});

// Safeguard cleanup on process exit
process.on('exit', () => {
  if (fs.existsSync(uniqueDbPath)) {
    try {
      fs.unlinkSync(uniqueDbPath);
    } catch {
      // Ignored
    }
  }
});

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

// Extend Vitest matchers types with jest-axe matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveNoViolations: () => void;
  }
}
