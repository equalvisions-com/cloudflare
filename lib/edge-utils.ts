/**
 * Edge-compatible utility functions
 * 
 * This file contains utility functions that are compatible with Edge runtime
 * and avoid using Node.js-specific APIs.
 */

/**
 * Safe fetch function that works in Edge runtime
 * Adds cache control headers to prevent static generation issues
 */
export async function edgeFetch(url: string, options: RequestInit = {}) {
  // Note: cache option removed for Edge Runtime compatibility
  // Add appropriate headers instead
  const headers = new Headers(options.headers);
  headers.set('Cache-Control', 'no-store, must-revalidate');
  
  // Use the augmented options
  const augmentedOptions: RequestInit = {
    ...options,
    headers
  };
  
  return fetch(url, augmentedOptions);
}

/**
 * Gets request headers in a way that works in both Edge and Node.js environments
 */
export function getRequestHeaders(request: Request): Headers {
  return request.headers;
}

/**
 * Safely parses URL parameters in Edge runtime
 */
export function getUrlParams(url: string | URL): URLSearchParams {
  const urlObject = typeof url === 'string' ? new URL(url) : url;
  return urlObject.searchParams;
} 