import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const healthStatus = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    environment: process.env.NODE_ENV || 'unknown',
    services: {
      convex: {
        configured: !!(process.env.NEXT_PUBLIC_CONVEX_URL),
        url: process.env.NEXT_PUBLIC_CONVEX_URL ? 'configured' : 'missing'
      },
      planetscale: {
        configured: !!(process.env.PLANETSCALE_HOST && process.env.PLANETSCALE_USERNAME && process.env.PLANETSCALE_PASSWORD),
        host: process.env.PLANETSCALE_HOST ? 'configured' : 'missing',
        username: process.env.PLANETSCALE_USERNAME ? 'configured' : 'missing',
        password: process.env.PLANETSCALE_PASSWORD ? 'configured' : 'missing'
      },
      hyperdrive: {
        configured: !!(process.env.HYPERDRIVE_WORKER_URL && process.env.HYPERDRIVE_WORKER_TOKEN),
        workerUrl: process.env.HYPERDRIVE_WORKER_URL ? 'configured' : 'missing',
        token: process.env.HYPERDRIVE_WORKER_TOKEN ? 'configured' : 'missing'
      },
      axiom: {
        configured: !!(process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET),
        token: process.env.AXIOM_TOKEN ? 'configured' : 'missing',
        dataset: process.env.AXIOM_DATASET ? 'configured' : 'missing',
        endpoint: process.env.NEXT_PUBLIC_AXIOM_INGEST_ENDPOINT || process.env.AXIOM_INGEST_ENDPOINT || 'default'
      },
      email: {
        configured: !!(process.env.AUTH_RESEND_KEY),
        resendKey: process.env.AUTH_RESEND_KEY ? 'configured' : 'missing',
        fromEmail: process.env.AUTH_EMAIL ? 'configured' : 'missing'
      },
      site: {
        siteUrl: process.env.SITE_URL ? 'configured' : 'missing',
        publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL ? 'configured' : 'missing',
        convexSiteUrl: process.env.CONVEX_SITE_URL ? 'configured' : 'missing'
      },
      analytics: {
        googleVerification: process.env.GOOGLE_SITE_VERIFICATION ? 'configured' : 'missing',
        pirsch: process.env.NEXT_PUBLIC_PIRSCH_CODE ? 'configured' : 'missing'
      },
      storage: {
        r2Bucket: process.env.R2_BUCKET ? 'configured' : 'missing',
        r2Endpoint: process.env.R2_ENDPOINT ? 'configured' : 'missing',
        r2AccessKey: process.env.R2_ACCESS_KEY_ID ? 'configured' : 'missing',
        r2SecretKey: process.env.R2_SECRET_ACCESS_KEY ? 'configured' : 'missing'
      },
      external: {
        rapidApi: process.env.RAPIDAPI_KEY ? 'configured' : 'missing',
        appUrl: process.env.NEXT_PUBLIC_APP_URL ? 'configured' : 'missing'
      }
    }
  };

  // Determine overall health
  const criticalServices = [
    healthStatus.services.convex.configured,
    healthStatus.services.planetscale.configured,
    healthStatus.services.site.siteUrl !== 'missing'
  ];

  const criticalCount = criticalServices.filter(Boolean).length;
  const totalCritical = criticalServices.length;

  if (criticalCount === totalCritical) {
    healthStatus.status = 'healthy';
  } else if (criticalCount > 0) {
    healthStatus.status = 'degraded';
  } else {
    healthStatus.status = 'unhealthy';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 
                    healthStatus.status === 'degraded' ? 206 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
} 