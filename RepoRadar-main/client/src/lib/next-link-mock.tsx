// Mock for next/link to make Stack Auth work with Vite/React
import React from 'react';
import { Link as WouterLink } from 'wouter';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  [key: string]: any;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, children, replace, ...props }, ref) => {
    return (
      <WouterLink href={href} {...props}>
        {(linkProps) => (
          <a ref={ref} {...linkProps} {...props}>
            {children}
          </a>
        )}
      </WouterLink>
    );
  }
);

Link.displayName = 'Link';

export default Link;
