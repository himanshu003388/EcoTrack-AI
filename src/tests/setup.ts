import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long!!';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? false : false,
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
window.ResizeObserver = ResizeObserverMock as any;

// Extend Vitest matchers types with jest-axe matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
}

