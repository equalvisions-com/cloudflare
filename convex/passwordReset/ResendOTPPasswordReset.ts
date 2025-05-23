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

    // Build the magic link with code & email
    const url = new URL(`${siteUrl.replace(/\/$/, "")}/reset-password`);
    url.searchParams.set("code", token);
    url.searchParams.set("email", email);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset</title>
  <style>
    /* In dark mode, invert only your button & paragraph text */
    @media (prefers-color-scheme: dark) {
      .email-container p {
        color: #ffffff !important;
      }
      .button-cell {
        background-color: #ffffff !important;
      }
      .button-cell a {
        color: #000000 !important;
      }
    }
  </style>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
  <!--[if mso]>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
  <![endif]-->
  <div
    class="email-container"
    style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;"
  >
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
      <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
        Click the button below to reset your password.
      </p>

      <!-- full-width, table‑based button -->
      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="margin: 0 0 20px;"
      >
        <tr>
          <td
            align="center"
            class="button-cell"
            style="background-color: #4f46e5; border-radius: 6px; padding: 0;"
          >
            <a
              href="${url.toString()}"
              style="
                display: inline-block;
                width: 100%;
                padding: 12px 0;
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                text-decoration: none;
                line-height: 1.5;
              "
              >Reset password</a
            >
          </td>
        </tr>
      </table>

      <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
        This link expires ${expires?.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }) ?? "soon"}.
      </p>
      <p style="font-size: 16px; line-height: 1.5; color: #666; margin: 0;">
        If you didn't request this password reset, you can safely ignore this
        email.
      </p>
    </div>
  </div>
  <!--[if mso]>
      </td></tr></table>
  <![endif]-->
</body>
</html>
    `;

    const { error } = await resend.emails.send({
      from:
        process.env.AUTH_EMAIL ?? "My App <noreply@socialnetworksandbox.com>",
      to: [email],
      subject: "Reset your password",
      html,
    });

    if (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
