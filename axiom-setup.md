# Axiom Integration Setup

## Environment Variables Required

Add these environment variables to your Cloudflare Pages deployment:

```
NEXT_PUBLIC_AXIOM_TOKEN=your-axiom-token
NEXT_PUBLIC_AXIOM_DATASET=your-dataset-name
NEXT_PUBLIC_AXIOM_ORG_ID=your-org-id
```

## How to get these values:

1. Go to your [Axiom dashboard](https://axiom.co/settings/ingest)
2. Create or select a dataset
3. Get your API token from the settings
4. Get your organization ID from the URL or settings

## What's being logged:

- ✅ All edge requests (middleware)
- ✅ User authentication status
- ✅ Route redirections
- ✅ Web vitals (LCP, CLS, TTFB, etc.)
- ✅ Client-side JavaScript errors
- ✅ Console errors
- ✅ Unhandled promise rejections

## Deployment:

The integration is fully edge-compatible and works with Cloudflare Pages without any additional configuration. 