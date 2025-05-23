import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";
import { Resend } from "resend";

export const ResendOTPPasswordReset = Email({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 5 * 60, // 5 minutes in seconds
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
    url.searchParams.set("token", token);
    url.searchParams.set("email", email);

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4f46e5; font-size: 24px; margin-bottom: 10px;">Reset Your Password</h1>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            Click the button below to reset your password.
          </p>
          <p style="text-align:center;margin:32px 0">
            <a href="${url.toString()}" 
               style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Reset password
            </a>
          </p>
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            This link expires ${expires?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "soon"}.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
            If you didn't request this password reset, you can safely ignore this
            email.
          </p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? "My App <noreply@socialnetworksandbox.com>",
      to: [email],
      subject: "Reset your password",
      html,
    });
    
    if (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
