import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from 'next/server';
import { getUserProfile } from '@/components/user-menu/UserMenuServer';

const isSignInPage = createRouteMatcher(["/signin"]);
const isOnboardingPage = createRouteMatcher(["/onboarding"]);
const isProtectedRoute = createRouteMatcher(["/notifications"]);
const isProfileRoute = createRouteMatcher(["/@:username"]);
const isLegacyProfileRoute = createRouteMatcher(["/profile/@:username"]);

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

    // Handle existing auth logic
    if (isSignInPage(request) && isAuthenticated) {
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
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } }, // 30 days
);

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
