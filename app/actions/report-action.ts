"use server";

import * as z from "zod";
// Note: Convex calls moved to the Edge API route to avoid typed API coupling here.

const reportSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  reason: z.enum(["spam/promo", "inappropriate/harmful", "intellectual", "other"]),
  description: z.string().min(1).max(2000),
  postSlug: z.string().min(1),
  turnstileToken: z.string().min(1),
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

export type ReportInput = z.infer<typeof reportSchema>;
export type ReportResult = { success: true } | { success: false; message: string };

export async function submitReport(input: ReportInput, headers?: Headers): Promise<ReportResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Invalid input" };
  }

  const ip = headers?.get("cf-connecting-ip") || "";
  const ok = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!ok) {
    return { success: false, message: "Verification failed" };
  }

  // The action no longer writes to Convex directly; kept for potential reuse.
  return { success: true };
}


