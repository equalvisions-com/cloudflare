import { NextRequest } from 'next/server';

/**
 * Validates request headers to prevent basic automation abuse and CSRF attacks
 * Edge runtime compatible - uses hostname detection instead of NODE_ENV
 */
export function validateHeaders(request: NextRequest): boolean {
  const hostname = request.nextUrl.hostname;
  
  // Development environments - skip validation (edge runtime safe)
  const isDev = hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname.endsWith('.pages.dev');
  
  if (isDev) {
    return true;
  }
  
  // Production validation (socialnetworksandbox.com only)
  const userAgent = request.headers.get('user-agent') || '';
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  
  // Block obvious automation
  const isValidUserAgent = userAgent.length > 0 && 
                          !userAgent.startsWith('curl') && 
                          !userAgent.startsWith('python') &&
                          !userAgent.includes('bot') &&
                          !userAgent.includes('scraper');
  
  // CSRF Protection: Require requests to come from our domain
  // Allow requests with proper origin/referer or direct navigation (empty origin/referer)
  const isValidOrigin = !origin || 
                       origin.includes('socialnetworksandbox.com') ||
                       origin === 'null'; // Direct navigation
  
  const isValidReferer = !referer || 
                        referer.includes('socialnetworksandbox.com');
  
  return isValidUserAgent && isValidOrigin && isValidReferer;
} 