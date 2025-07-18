import { NextRequest } from 'next/server';

/**
 * Validates request headers to prevent basic automation abuse
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
  
  // Block obvious automation
  return userAgent.length > 0 && 
         !userAgent.startsWith('curl') && 
         !userAgent.startsWith('python');
} 