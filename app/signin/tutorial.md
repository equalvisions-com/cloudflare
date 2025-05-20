Here’s a step-by-step tutorial for implementing a magic link password reset with Convex Auth, Resend, and Next.js (or any React SPA) outside of Chef (i.e., in your own Convex Cloud project or self-hosted Convex):

1. Customize Your Convex Auth Provider
In your Convex project, edit (or create) convex/passwordReset/ResendOTPPasswordReset.ts:

import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";
import { Resend } from "resend";

export const ResendOTPPasswordReset = Email({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 5 * 60, // 5 minutes
  async generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({
    identifier: email,
    provider,
    token,
    expires,
  }) {
    const resend = new Resend(provider.apiKey);
    const siteUrl = process.env.SITE_URL; // e.g. https://your-app.com
    if (!siteUrl) throw new Error("SITE_URL not set");

    // Build the magic link
    const url = new URL(`${siteUrl.replace(/\/$/, "")}/reset-password`);
    url.searchParams.set("code", token);
    url.searchParams.set("email", email);

    const html = `
      <p>Click the button below to reset your password.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${url}" 
           style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Reset password
        </a>
      </p>
      <p>This link expires ${expires?.toLocaleTimeString() || "soon"}.</p>
    `;

    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? "No-Reply <noreply@example.com>",
      to: [email],
      subject: "Reset your password",
      html,
    });
    if (error) throw new Error(JSON.stringify(error));
  },
});
Make sure to:

Set SITE_URL and AUTH_RESEND_KEY in your Convex project’s environment variables.
2. Register the Provider in convex/auth.ts
import { defineAuthConfig } from "@convex-dev/auth/server";
import { ResendOTPPasswordReset } from "./passwordReset/ResendOTPPasswordReset";

export default defineAuthConfig({
  providers: [
    // ...other providers
    ResendOTPPasswordReset,
  ],
});
3. Create the /reset-password Page in Your App
Next.js Example:

// app/reset-password/page.tsx
"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button, Input, Label } from "@/components/ui"; // adjust imports

export default function ResetPasswordPage() {
  const search = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuthActions();

  const email = search.get("email") ?? "";
  const code = search.get("code") ?? "";
  const [pw, setPw] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validPw = (s: string) =>
    s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validPw(pw)) {
      alert("Password must be 8+ chars with upper, lower, number");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("flow", "reset-verification");
      form.set("email", email);
      form.set("code", code);
      form.set("newPassword", pw);

      await signIn("password", form);
      alert("Password changed — you're signed in");
      router.push("/");
    } catch (err: any) {
      alert("Reset failed: " + err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="np">Choose a new password</Label>
          <Input
            id="np"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
        </div>
        <Button className="w-full" disabled={submitting}>
          {submitting ? "Saving…" : "Set password"}
        </Button>
      </form>
    </main>
  );
}
You can do the same in any React SPA—just read code and email from the URL.

4. How the Flow Works
User requests a password reset.
They receive an email with a link:
https://your-app.com/reset-password?code=123456&email=user@example.com
User clicks the link, lands on /reset-password.
The page reads code and email from the URL, shows only the password field.
On submit, you call:
await signIn("password", {
  flow: "reset-verification",
  email,
  code,
  newPassword,
});
User is signed in and password is changed!
5. Security Note
The code in the URL is a one-time token, expires quickly, and is safe to use for this flow.
The user never needs to see or type the code.
6. References
Convex Auth Passwords Docs
Convex Auth API Reference
That’s it! You now have a magic link password reset with Convex Auth and Resend.

Let me know if you want a full working repo example or have any questions!

Response Generated

Token usage
