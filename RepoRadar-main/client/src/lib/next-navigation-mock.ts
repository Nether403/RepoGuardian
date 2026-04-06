// Mock for next/navigation to make Stack Auth work with Vite/React
import { useLocation } from 'wouter';

export enum RedirectType {
  push = 'push',
  replace = 'replace',
}

export function redirect(url: string, type?: RedirectType): never {
  if (typeof window !== 'undefined') {
    if (type === RedirectType.replace) {
      window.location.replace(url);
    } else {
      window.location.href = url;
    }
  }
  throw new Error('NEXT_REDIRECT'); // Stack Auth expects this
}

export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND');
}

export function useRouter() {
  const [, setLocation] = useLocation();
  
  return {
    push: (url: string) => setLocation(url),
    replace: (url: string) => setLocation(url, { replace: true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: () => Promise.resolve(),
  };
}

export function usePathname() {
  const [location] = useLocation();
  return location;
}

export function useSearchParams() {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams;
}

export function useParams() {
  return {};
}
