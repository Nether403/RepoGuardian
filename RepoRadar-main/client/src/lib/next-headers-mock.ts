// Mock for next/headers to make Stack Auth work with Vite/React
// These are server-side Next.js functions, so we provide no-op implementations

export function headers() {
  return new Headers();
}

export function cookies() {
  return {
    get: () => undefined,
    set: () => {},
    delete: () => {},
    has: () => false,
    getAll: () => [],
  };
}

export function draftMode() {
  return {
    isEnabled: false,
    enable: () => {},
    disable: () => {},
  };
}
