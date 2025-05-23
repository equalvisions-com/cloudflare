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
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          /* In dark mode: white p text & white button bg with black link text */
          @media (prefers-color-scheme: dark) {
            .email-content p {
              color: #ffffff !important;
            }
            .button-cell {
              background-color: #ffffff !important;
              opacity: 1 !important;
            }
            .button-cell a {
              color: #000000 !important;
              opacity: 1 !important;
            }
            /* Additional Apple Mail targeting */
            [data-ogsc] .button-cell {
              background-color: #ffffff !important;
              opacity: 1 !important;
            }
            [data-ogsc] .button-cell a {
              color: #000000 !important;
              opacity: 1 !important;
            }
            /* Force full opacity and contrast */
            td.button-cell {
              background-color: #ffffff !important;
              opacity: 1 !important;
              filter: none !important;
            }
            td.button-cell a {
              color: #000000 !important;
              opacity: 1 !important;
              filter: none !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:20px;font-family:Arial,sans-serif;">
        <div class="email-content" style="max-width:600px;margin:0 auto;padding:20px;">
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">Hi,</p>
          
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">
            We received a request to reset your password for the account associated with ${email}.
          </p>
          
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">
            To reset your password, click the button. This link will expire in 5 minutes.
          </p>
          
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
            <tr>
              <td class="button-cell" align="center" style="background-color:#000000;border-radius:6px;">
                <a href="${url.toString()}" 
                   target="_blank" 
                   style="display:inline-block;width:100%;padding:12px 0;font-size:16px;line-height:1.5;font-weight:600;color:#ffffff;text-decoration:none;">
                  Reset Password
                </a>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
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
