// convex/emailVerification/ResendOTPVerify.ts
import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";
import { Resend as ResendAPI } from "resend";

export const ResendOTPVerify = Email({
  id: "resend-otp-verify",
  apiKey: process.env.AUTH_RESEND_KEY!, // Added non-null assertion as it's required
  // OTP duration
  maxAge: 5 * 60, // 5 minutes in seconds
  async generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token, expires }) {
    if (!provider.apiKey) {
      throw new Error("Resend API key is not configured for email verification.");
    }
    const resend = new ResendAPI(provider.apiKey);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      </head>
      <body style="margin:0;padding:0;font-family:Arial,sans-serif;">
        <div class="email-content" style="max-width:600px;margin:0 auto;padding:0px 20px;">
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">Hi,</p>
          
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">
            Please verify your email address. This code will expire in 5 minutes.
          </p>
          
           <p style="margin:0 0 20px;font-size:36px;font-weight:bold;text-align:center;letter-spacing:4px;font-family:monospace,Arial,sans-serif;">
            ${token}
          </p>
                </div>
      </body>
      </html>
    `;

    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? "Grasper <noreply@socialnetworksandbox.com>",
      to: [email],
      subject: "Verify your account",
      html,
    });
    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Failed to send verification email: ${JSON.stringify(error)}`);
    }
  },
}); 