/// <reference types="react" />

// Fix React 19 compatibility for shadcn/ui components
// This extends ReactNode to include bigint which is required by React 19
declare global {
  namespace React {
    type ReactNode =
      | ReactElement
      | string
      | number
      | bigint
      | Iterable<ReactNode>
      | ReactPortal
      | boolean
      | null
      | undefined;
  }
}

export {};
