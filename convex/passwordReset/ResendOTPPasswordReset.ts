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

    // Build the reset link
    const url = new URL(`${siteUrl.replace(/\/$/, "")}/reset-password`);
    url.searchParams.set("code", token);
    url.searchParams.set("email", email);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <style>
    /* Prevent dark‑mode inversion */
    html, body, .email-container {
      background-color: #ffffff !important;
      color: #000000    !important;
    }
    @media (prefers-color-scheme: dark) {
      html, body, .email-container {
        background-color: #ffffff !important;
        color: #000000    !important;
      }
    }
  </style>
  <title>Password Reset</title>
</head>
<body
  bgcolor="#ffffff"
  style="font-family: Arial, sans-serif; background-color: #ffffff !important; color: #000000 !important; margin: 0; padding: 20px;"
>
  <!--[if mso]>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff">
      <tr><td align="center">
  <![endif]-->
  <div class="email-container" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <div style="padding:20px;border-radius:8px;background-color:#ffffff;">
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px;">Hi,</p>
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px;">
        We received a request to reset your password for the account associated with ${email}.
      </p>
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px;">
        To reset your password, click the button. This link will expire in 5 minutes.
      </p>
      <!-- table‑based full‑width button -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#000000" style="border-radius:6px; text-align:center;">
                  <a
                    href="${url.toString()}"
                    target="_blank"
                    style="
                      display:inline-block;
                      width:100%;
                      padding:12px 0;
                      font-weight:600;
                      color:#ffffff;
                      text-decoration:none;
                      font-size:16px;
                      line-height:1.5;
                    "
                  >
                    Reset Password
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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

