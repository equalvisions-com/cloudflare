import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { submitReport } from "@/app/actions/report-action";
import { validateHeaders } from "@/lib/headers";

export const runtime = 'edge';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  reason: z.enum(["spam/promo", "inappropriate/harmful", "intellectual", "other"]),
  description: z.string().min(1).max(2000),
  postSlug: z.string().min(1),
  turnstileToken: z.string().min(1),
});

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

    const result = await submitReport(parsed.data, request.headers);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}


