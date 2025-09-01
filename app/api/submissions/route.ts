import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { validateHeaders } from "@/lib/headers";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

export const runtime = 'edge';

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  type: z.enum(["podcast", "newsletter"], {
    errorMap: () => ({ message: "Please select a valid type" }),
  }),
  publicationName: z.string().min(1, "Publication name is required").max(100, "Publication name too long"),
  rssFeed: z.string().url("Invalid RSS feed URL").min(1, "RSS feed is required"),
  turnstileToken: z.string().min(1, "Turnstile verification is required"),
});

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY || "",
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return Boolean((data as any).success);
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Verify auth (user must be logged in)
    const token = await convexAuthNextjsToken().catch(() => null);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Turnstile
    const ip = request.headers.get("cf-connecting-ip") || "";
    const ok = await verifyTurnstile(parsed.data.turnstileToken, ip);
    if (!ok) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    // Write to Convex
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);
    
    try {
      await (convex as any).mutation("submissions:create", {
        name: parsed.data.name,
        email: parsed.data.email,
        type: parsed.data.type,
        publicationName: parsed.data.publicationName,
        rssFeed: parsed.data.rssFeed,
        ip,
      });
    } catch (err: any) {
      const message = (err && typeof err.message === 'string') ? err.message : '';
      if (message.toLowerCase().includes('daily submission limit')) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': '86400' } });
      }
      return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
