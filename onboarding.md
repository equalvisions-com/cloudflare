
# Enhanced Onboarding Flow with Security-First Approach

## Initial Access (User Enters Onboarding URL)

1. **Layout Component Loads**
   - `OnboardingLayout` renders with `VerificationWithTimeout` wrapper
   - Sets a 15-second global timeout for the entire verification process
   - Shows loading UI during verification

2. **Server Component Verification**
   - `VerifyOnboardingStatus` (server component) executes
   - Attempts to verify user's authentication status with Convex database

## Authentication & Verification Flow

### Token Retrieval Step (10s timeout)
- **Success**: Proceeds to profile check
- **Failure/Timeout**: Redirects to signin page immediately
  - *Security improvement*: No longer falls back to cookie checks

### Profile Check Step (10s timeout)
- **Success + `isBoarded: true`**: 
  - User already completed onboarding
  - Updates cookie if needed
  - Redirects to home page
- **Success + `isBoarded: false` + has userId**: 
  - Only case where onboarding form is shown
  - Updates cookie if needed
  - Continues to onboarding process
- **Success + invalid state** (missing userId):
  - Redirects to signin page
- **Failure/Timeout**:
  - Redirects to signin page immediately
  - *Security improvement*: No longer falls back to cookies

## Redirection Handling

All redirections happen through `AutoRedirect` component with three possible destinations:

1. **Home Redirection** (for verified onboarded users)
   - Server action attempts to set cookie then redirect
   - 10-second safety timeout fallback using client-side redirect
   - Displays "Verifying your profile..." message during process

2. **Signin Redirection** (for all verification failures)
   - Server action for immediate redirect to signin
   - 10-second safety timeout fallback using client-side redirect
   - Displays "Redirecting to signin..." message during process

3. **Continue to Onboarding** (for verified, non-onboarded users)
   - No redirection, shows onboarding form
   - Sets appropriate cookie

## Security Mechanisms

1. **Single Source of Truth**
   - Convex database is the only authoritative source
   - Cookies are synchronized but never trusted for verification

2. **Multiple Timeouts**
   - 15s global verification timeout → redirects to signin
   - 10s token retrieval timeout → redirects to signin
   - 10s profile check timeout → redirects to signin
   - 10s redirection safety timeout → forces client-side redirect

3. **Server Actions for Cookie Management**
   - All cookie operations happen server-side
   - Prevents client-side tampering with cookies

4. **Fail-Secure Approach**
   - Any verification failure results in redirection to signin
   - No access to protected resources without proper verification

## User Experience

1. **Loading States**
   - Initial loading during verification with simple spinner
   - Context-specific messages during redirects:
     - "Verifying your profile..." (for onboarded users)
     - "Redirecting to signin..." (for verification failures)
     - "Preparing onboarding..." (for non-onboarded users)
   - Timeout message: "Verification timeout. Redirecting to signin..."

2. **Edge Case Handling**
   - Network issues → redirect to signin
   - Database connection problems → redirect to signin
   - Slow connections → timeouts with proper fallbacks
   - Token issues → redirect to signin


Requirements:
Must be server only
Must work on Cloudflare Pages in Edge Enviroment
Must be performant

Notes: Never show the external /onboarding url it should be internalize. Heres an example:

Yes, there is an easier way if you want a **server-side check** that **doesn't change the URL** and conditionally renders a component based on authentication.

---

### ✅ **Solution: `getServerSideProps` with Conditional Component Render**

This is the simplest and most idiomatic way in Next.js. You can conditionally render the page based on your auth logic in `getServerSideProps`:

```jsx
// pages/protected.js
import Dashboard from '@/components/Dashboard';
import HomePage from '@/components/HomePage';

export default function ProtectedPage({ isAuthenticated }) {
  return isAuthenticated ? <Dashboard /> : <HomePage />;
}

export async function getServerSideProps(context) {
  // Perform your server-side authentication check here
  const { req } = context;
  const isAuthenticated = req.cookies.auth_token ? true : false;

  // Pass the result to the component
  return {
    props: {
      isAuthenticated,
    },
  };
}
```

---

### 🔍 **Explanation:**

1. `getServerSideProps` runs **on the server** before rendering.
2. It checks if the user is authenticated based on a cookie.
3. If authenticated, it renders `<Dashboard />`, otherwise `<HomePage />`.
4. **URL does not change**, only the component displayed changes.

---

### 🚀 **Why This Works Well:**

* No `router` navigation required.
* No client-side logic.
* Component switch is handled **on the server**, faster and more secure.
* Simplest approach to conditionally render without changing the address bar.

