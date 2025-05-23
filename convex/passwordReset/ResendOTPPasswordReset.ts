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
          
          /* Dark mode support - more aggressive targeting */
          @media (prefers-color-scheme: dark) {
            body, .email-container, table[class="email-container"] {
              color: #ffffff !important;
            }
            h1, .email-title {
              color: #ffffff !important;
            }
            p, .email-paragraph {
              color: #ffffff !important;
            }
            .email-text, .email-secondary {
              color: #cccccc !important;
            }
            .email-button, 
            a[class="email-button"], 
            .email-button:visited, 
            .email-button:hover,
            .email-button:link,
            .email-button:active {
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 2px solid #ffffff !important;
            }
            /* Apple Mail specific fixes */
            [data-ogsc] .email-button, 
            [data-ogsc] a[class="email-button"],
            [data-ogsc] .email-button:visited,
            [data-ogsc] .email-button:hover {
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 2px solid #ffffff !important;
            }
            /* Force background for Apple Mail */
            u + .body .email-button {
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 2px solid #ffffff !important;
            }
            /* Additional Apple Mail targeting */
            .body .email-button {
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 2px solid #ffffff !important;
            }
            /* Meta refresh targeting for Apple Mail */
            meta[name="color-scheme"] ~ * .email-button {
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 2px solid #ffffff !important;
            }
          }
          
          /* Light mode (default) */
          .email-container {
            color: #000000;
          }
          .email-button, .email-button:visited, .email-button:hover {
            background-color: #000000 !important;
            color: #ffffff !important;
            border: 2px solid #000000 !important;
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
          
          /* Full width button */
          .email-button {
            width: 100% !important;
            display: block !important;
            box-sizing: border-box !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0;" class="body">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%; margin: 0 auto;">
                <tr>
                  <td style="padding: 0;">
                    <!-- Content -->
                    <p class="email-paragraph" style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #000000;">
                      Hi,
                    </p>
                    
                    <p class="email-paragraph" style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #000000;">
                      We received a request to reset your password for the account associated with ${email}.
                    </p>
                    
                    <p class="email-paragraph" style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #000000;">
                      To reset your password, click the button. This link will expire in 5 minutes.
                    </p>
                    
                    <!-- Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 32px 0;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url.toString()}" style="height:48px;v-text-anchor:middle;width:100%;" arcsize="12%" stroke="t" strokecolor="#000000" strokeweight="2px" fillcolor="#000000">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:600;">Reset password</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${url.toString()}" 
                             class="email-button"
                             style="display: block; width: 100%; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #000000; border: 2px solid #000000; text-align: center; box-sizing: border-box; -webkit-text-size-adjust: none;">
                            Reset password
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
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
