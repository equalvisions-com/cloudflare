# Axiom Integration Setup

## Environment Variables Required

Add these environment variables to your Cloudflare Pages deployment:

```
NEXT_PUBLIC_AXIOM_TOKEN=your-axiom-token
NEXT_PUBLIC_AXIOM_DATASET=your-dataset-name
NEXT_PUBLIC_AXIOM_ORG_ID=your-org-id (optional)
```

### Optional: Configure Log Level

Set the minimum log level to control which logs are sent to Axiom:

```
NEXT_PUBLIC_AXIOM_LOG_LEVEL=info
```

Available log levels (from lowest to highest):
- `debug` (default) - sends all logs
- `info` - sends info, warn, and error logs
- `warn` - sends warn and error logs  
- `error` - sends only error logs
- `off` - sends no logs

## How to get these values:

1. Go to your [Axiom dashboard](https://axiom.co/settings/ingest)
2. Create or select a dataset
3. Get your API token from the settings
4. Get your organization ID from the URL or settings (optional)

## What's being logged:

- ✅ All edge requests (middleware with automatic request logging)
- ✅ User authentication status
- ✅ Route redirections
- ✅ Web vitals (LCP, CLS, TTFB, etc.)
- ✅ Client-side JavaScript errors
- ✅ Console errors
- ✅ Unhandled promise rejections
- ✅ React Error Boundary errors

## Implementation Details:

### Middleware
- Uses official `logger.middleware(request)` method for automatic request logging
- Includes `event.waitUntil(logger.flush())` for proper log delivery
- Adds custom authentication and routing context

### Client-Side Logging
- Uses `useLogger()` hook in client components
- Captures window errors, unhandled rejections, and console errors
- Includes React Error Boundary integration

### Web Vitals
- Automatically tracks Core Web Vitals (LCP, CLS, TTFB, etc.)
- Only sends data from production deployments

## Deployment:

The integration is fully edge-compatible and works with Cloudflare Pages without any additional configuration. 