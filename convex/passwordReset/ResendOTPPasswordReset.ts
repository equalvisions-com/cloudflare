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
    const expiresText = expires
      ? `This code will expire on ${expires.toLocaleString()}.`
      : "This code will expire soon.";

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4f46e5; font-size: 24px; margin-bottom: 10px;">Reset Your Password</h1>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 15px;">
            We received a request to reset your password. Use the code below to set
            a new password for your account:
          </p>
          <div style="background-color: #eef2ff; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0; border-left: 4px solid #4f46e5;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">
              ${token}
            </span>
          </div>
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            ${expiresText}
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #666;">
            If you didn't request this password reset, you can safely ignore this
            email.
          </p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? "Chef <noreply@example.com>",
      to: [email],
      subject: "Reset your password",
      html,
    });
    
    if (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
