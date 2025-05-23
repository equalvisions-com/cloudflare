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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>Reset Your Password</title>
        <!--[if mso]>
        <noscript>
          <xml>
            <o:OfficeDocumentSettings>
              <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
          </xml>
        </noscript>
        <![endif]-->
        <style>
          /* Reset styles */
          body, table, td, p, a, li, blockquote {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
          }
          img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
          }
          
          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            .email-container {
              background-color: #000000 !important;
              color: #ffffff !important;
            }
            .email-button {
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 2px solid #ffffff !important;
            }
            .email-text {
              color: #cccccc !important;
            }
          }
          
          /* Light mode (default) */
          .email-container {
            background-color: #ffffff;
            color: #000000;
          }
          .email-button {
            background-color: #000000;
            color: #ffffff;
            border: 2px solid #000000;
          }
          .email-text {
            color: #666666;
          }
          
          /* Mobile responsive */
          @media only screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
              padding: 10px !important;
            }
            .email-button {
              display: block !important;
              width: 100% !important;
              padding: 15px 20px !important;
              font-size: 16px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #ffffff; margin: 0 auto;">
                <tr>
                  <td style="padding: 0;">
                    <!-- Header -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding-bottom: 30px;">
                          <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #000000; line-height: 1.2;">Reset Your Password</h1>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Content -->
                    <p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #000000;">
                      Click the button below to reset your password.
                    </p>
                    
                    <!-- Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 32px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td align="center" style="border-radius: 6px; background-color: #000000;">
                                <a href="${url.toString()}" 
                                   class="email-button"
                                   style="display: inline-block; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #000000; border: 2px solid #000000;">
                                  Reset password
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #000000;">
                      This link expires ${expires?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "soon"}.
                    </p>
                    
                    <p class="email-text" style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #666666;">
                      If you didn't request this password reset, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
