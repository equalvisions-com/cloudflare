import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
  convexAuthNextjsToken,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse, NextRequest, NextFetchEvent } from 'next/server';
import { cookies } from 'next/headers';
import { Logger } from 'next-axiom';

const isSignInPage = createRouteMatcher(["/signin"]);
const isOnboardingPage = createRouteMatcher(["/onboarding"]);
const isProtectedRoute = createRouteMatcher(["/settings", "/alerts", "/bookmarks"]);
const isDynamicContentRoute = createRouteMatcher([
  "/newsletters/:postSlug*", 
  "/podcasts/:postSlug*"
]);

// Lightweight onboarding status check that doesn't make Convex queries
async function getBasicUserStatus(request: NextRequest) {
  let isAuthenticated = false;
  let isBoarded = false;
  let skipOnboardingCheck = false;

  try {
    // Get token validation without making Convex API calls
    const token = await convexAuthNextjsToken().catch(() => null);
    isAuthenticated = !!token;

    if (isAuthenticated) {
      // During cold starts, use cookie as a hint but don't rely on it exclusively
      const onboardedCookie = request.cookies.get('user_onboarded');
      
      if (onboardedCookie?.value === 'true') {
        // If cookie says user is onboarded, trust it for now to prevent cold start errors
        isBoarded = true;
      } else if (onboardedCookie?.value === 'false') {
        // If cookie explicitly says not onboarded, trust it for now
        isBoarded = false;
      } else {
        // If no cookie or invalid value, we'll mark with a special flag
        // This tells the layout to verify onboarding status from Convex
        // but allows middleware to proceed without blocking during cold starts
        skipOnboardingCheck = true;
        
        // CRITICAL FOR COLD STARTS: For new users (no cookie), assume they are NOT onboarded
        // This ensures they'll be redirected to onboarding flow where Convex will verify the truth
        // Better to have a false positive (send onboarded user to onboarding briefly) 
        // than false negative (let unonboarded user access the app)
        isBoarded = false;
      }
    }
  } catch (error) {
    console.error("Error in basic user status check:", error);
    // COLD START SAFETY: Default to safe state in case of errors
    // On Cloudflare Pages edge runtime, token validation might fail during cold starts
    isAuthenticated = false;
    skipOnboardingCheck = true; // Skip onboarding checks on errors
    isBoarded = false; // Default to not onboarded for safety
  }

  return { isAuthenticated, isBoarded, skipOnboardingCheck };
}

export default convexAuthNextjsMiddleware(
  async (request: NextRequest, { convexAuth, event }: { convexAuth: any, event: NextFetchEvent }) => {
    // Initialize Axiom logger for edge runtime with source identifier
    const logger = new Logger({ source: 'middleware' });
    
    // Use official Axiom middleware method for automatic request logging
    logger.middleware(request);
    
    // Log additional authentication and routing context
    const { isAuthenticated, isBoarded, skipOnboardingCheck } = await getBasicUserStatus(request);
    
    logger.info('User status', {
      isAuthenticated,
      isBoarded,
      skipOnboardingCheck,
      pathname: request.nextUrl.pathname,
    });
    
    // For all routes, ensure specific cache-control header for dynamic content
    const response = NextResponse.next();
    if (isDynamicContentRoute(request) || isSignInPage(request) || isOnboardingPage(request)) {
      response.headers.set('Cache-Control', 'no-store, must-revalidate');
    }

    // Add status flags as headers for client-side awareness during cold starts
    response.headers.set('x-user-authenticated', isAuthenticated ? '1' : '0');
    response.headers.set('x-user-onboarded', isBoarded ? '1' : '0');
    response.headers.set('x-skip-onboarding-check', skipOnboardingCheck ? '1' : '0');

    // Handle existing auth logic with additional logging
    // Note: We now allow authenticated users to stay on signin briefly
    // because all sign-in flows redirect to /onboarding for fresh verification
    if (isSignInPage(request) && isAuthenticated && isBoarded) {
      logger.info('Redirecting fully authenticated and onboarded user from signin', { to: '/' });
      // Ensure logs are flushed before redirect
      event.waitUntil(logger.flush());
      return nextjsMiddlewareRedirect(request, "/");
    }
    
    // Updated onboarding page protection logic
    if (isOnboardingPage(request)) {
      // Always redirect non-authenticated users
      if (!isAuthenticated) {
        logger.info('Redirecting unauthenticated user from onboarding', { to: '/signin' });
        event.waitUntil(logger.flush());
        return nextjsMiddlewareRedirect(request, "/signin");
      }
      
      // Only redirect if we have a confident "true" for onboarded
      if (isBoarded && !skipOnboardingCheck) {
        logger.info('Redirecting onboarded user from onboarding', { to: '/' });
        event.waitUntil(logger.flush());
        return nextjsMiddlewareRedirect(request, "/");
      }
      
      // For uncertain states (cold starts), we'll set a header for the page to perform a secondary check
      response.headers.set('x-check-onboarding', '1');
      event.waitUntil(logger.flush());
      return response;
    }
    
    if (isProtectedRoute(request) && !isAuthenticated) {
      logger.info('Redirecting unauthenticated user from protected route', { 
        from: request.nextUrl.pathname,
        to: '/signin' 
      });
      event.waitUntil(logger.flush());
      return nextjsMiddlewareRedirect(request, "/signin");
    }

    // Handle onboarding redirect - check this before profile routes
    // Don't redirect if already on onboarding page
    if (!isOnboardingPage(request) && isAuthenticated && isBoarded === false) {
      logger.info('Redirecting unauthenticated user to onboarding', { 
        from: request.nextUrl.pathname,
        to: '/onboarding' 
      });
      event.waitUntil(logger.flush());
      return nextjsMiddlewareRedirect(request, "/onboarding");
    }
    
    // Ensure logs are flushed for successful requests
    event.waitUntil(logger.flush());
    return response;
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } }, // 30 days
);

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets and includes specific API routes
  matcher: [
    // Include all pages that require dynamic rendering
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/',
    '/api/featured-feed',
    '/api/rss/:path*',
    '/signin',
    '/onboarding',
    '/newsletters/:path*',
    '/podcasts/:path*'
  ],
};
