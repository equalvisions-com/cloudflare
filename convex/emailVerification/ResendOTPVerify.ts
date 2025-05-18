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
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? "Grasper <noreply@socialnetworksandbox.com>",
      to: [email],
      subject: "Verify your e-mail for Grasper",
      text: `Your verification code is ${token}\n\nThe code expires ${expires?.toLocaleString()}.`,
    });
    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Failed to send verification email: ${JSON.stringify(error)}`);
    }
  },
}); 