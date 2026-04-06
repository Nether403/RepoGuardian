import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

/**
 * HTTPS Enforcement and Security Headers Middleware
 * 
 * Provides comprehensive security configuration including:
 * - HTTPS enforcement in production
 * - Security headers via Helmet.js
 * - Content Security Policy (CSP)
 * - HSTS headers
 */

/**
 * Middleware to enforce HTTPS connections in production
 * Requirement 12.1: HTTPS enforcement
 */
export function enforceHTTPS(req: Request, res: Response, next: NextFunction): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceHttps = process.env.FORCE_HTTPS === 'true';
  
  // Skip HTTPS enforcement in development unless explicitly enabled
  if (!isProduction && !forceHttps) {
    return next();
  }

  // Check if request is already HTTPS
  const isSecure = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.protocol === 'https';

  if (!isSecure) {
    // Construct HTTPS URL
    const httpsUrl = `https://${req.hostname}${req.url}`;
    
    // Log the redirect for monitoring
    console.log(`HTTPS Redirect: ${req.method} ${req.url} -> ${httpsUrl}`);
    
    // 301 Permanent Redirect to HTTPS
    return res.redirect(301, httpsUrl);
  }

  next();
}

/**
 * Configure Helmet.js with appropriate security headers
 * Requirements 12.2, 12.3: Security headers and HSTS
 */
export function setSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const securityHeadersEnabled = process.env.SECURITY_HEADERS_ENABLED !== 'false';
  const cspEnabled = process.env.CSP_ENABLED !== 'false';
  const hstsMaxAge = parseInt(process.env.HSTS_MAX_AGE || '31536000', 10);

  // Skip security headers if explicitly disabled
  if (!securityHeadersEnabled) {
    return next();
  }

  // Configure Content Security Policy directives
  const cspDirectives: helmet.ContentSecurityPolicyOptions['directives'] = {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Required for inline scripts
      "'unsafe-eval'", // Required for some libraries
      'https://cdn.jsdelivr.net',
      'https://accounts.google.com',
      'https://apis.google.com',
      'https://js.stripe.com',
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for styled-components and inline styles
      'https://fonts.googleapis.com',
    ],
    fontSrc: [
      "'self'",
      'https://fonts.gstatic.com',
      'data:',
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https:',
      'blob:',
    ],
    connectSrc: [
      "'self'",
      'https://api.github.com',
      'https://accounts.google.com',
      'https://oauth2.googleapis.com',
      'https://api.stripe.com',
    ],
    frameSrc: [
      "'self'",
      'https://accounts.google.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
    ],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };

  // In development, allow WebSocket connections and more permissive CSP
  if (!isProduction) {
    cspDirectives.connectSrc = [
      "'self'",
      'ws:',
      'wss:',
      'https://api.github.com',
      'https://accounts.google.com',
      'https://oauth2.googleapis.com',
      'https://api.stripe.com',
    ];
  } else {
    // In production, upgrade insecure requests
    cspDirectives.upgradeInsecureRequests = [];
  }

  // Apply Helmet middleware with configuration
  const helmetMiddleware = helmet({
    // Content Security Policy
    contentSecurityPolicy: cspEnabled ? {
      directives: cspDirectives,
    } : false,

    // Strict-Transport-Security (HSTS)
    // Requirement 12.3: HSTS headers
    hsts: isProduction ? {
      maxAge: hstsMaxAge, // Default: 1 year
      includeSubDomains: true,
      preload: true,
    } : false,

    // X-Content-Type-Options: nosniff
    noSniff: true,

    // X-Frame-Options: DENY
    frameguard: {
      action: 'deny',
    },

    // X-XSS-Protection: 1; mode=block (for legacy browsers)
    xssFilter: true,

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false,
    },

    // X-Download-Options: noopen
    ieNoOpen: true,

    // X-Permitted-Cross-Domain-Policies: none
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
  });

  // Apply Helmet middleware
  helmetMiddleware(req, res, (err) => {
    if (err) {
      console.error('Helmet middleware error:', err);
      return next(err);
    }

    // Add additional custom headers not covered by Helmet
    // Permissions-Policy (formerly Feature-Policy)
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()'
    );

    next();
  });
}
