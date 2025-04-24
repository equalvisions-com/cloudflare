import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from 'next/server';
import { getUserProfile } from '@/components/user-menu/UserMenuServer';

const isSignInPage = createRouteMatcher(["/signin"]);
const isOnboardingPage = createRouteMatcher(["/onboarding"]);
const isProtectedRoute = createRouteMatcher(["/settings", "/alerts", "/bookmarks"]);
const isProfileRoute = createRouteMatcher(["/@:username"]);
const isLegacyProfileRoute = createRouteMatcher(["/profile/@:username"]);
const isDynamicContentRoute = createRouteMatcher([
  "/newsletters/:postSlug*", 
  "/podcasts/:postSlug*"
]);

// Helper to normalize username for internal routing
const normalizeUsername = (username: string) => {
  // Remove @ if it exists, then add it back for consistency
  // Store and look up usernames in lowercase
  return '@' + username.replace(/^@/, '').toLowerCase();
};

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // Get user profile with authentication and onboarding status first
    const { isAuthenticated, isBoarded } = await getUserProfile();
    
    // For all routes, ensure a specific cache-control header for dynamic content
    // This helps prevent static generation issues during build
    const response = NextResponse.next();
    if (isDynamicContentRoute(request) || isSignInPage(request) || isOnboardingPage(request)) {
      response.headers.set('Cache-Control', 'no-store, must-revalidate');
    }

    // Handle existing auth logic
    if (isSignInPage(request) && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    
    // Redirect from onboarding page if user is already onboarded or not authenticated
    if (isOnboardingPage(request) && (!isAuthenticated || isBoarded)) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    
    if (isProtectedRoute(request) && !isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }

    // Handle onboarding redirect - check this before profile routes
    // Don't redirect if already on onboarding page
    if (!isOnboardingPage(request) && isAuthenticated && isBoarded === false) {
      return nextjsMiddlewareRedirect(request, "/onboarding");
    }

    // Handle profile routes after onboarding check
    if (isProfileRoute(request)) {
      // First check if user needs onboarding
      if (isAuthenticated && !isBoarded) {
        return nextjsMiddlewareRedirect(request, "/onboarding");
      }

      // If onboarded, proceed with profile routing
      const url = request.nextUrl.clone();
      const username = url.pathname.substring(1); // remove leading slash
      url.pathname = `/profile/${normalizeUsername(username)}`;
      return NextResponse.rewrite(url);
    }

    // Handle legacy profile routes
    if (isLegacyProfileRoute(request)) {
      // First check if user needs onboarding
      if (isAuthenticated && !isBoarded) {
        return nextjsMiddlewareRedirect(request, "/onboarding");
      }

      const url = request.nextUrl.clone();
      const username = url.pathname.replace('/profile/', '');
      url.pathname = normalizeUsername(username);
      return NextResponse.redirect(new URL(url.pathname, request.url), 301);
    }
    
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
