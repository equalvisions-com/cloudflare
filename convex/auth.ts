import GitHub from "@auth/core/providers/github";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
 


export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google, 
    Resend({
      from: "noreply@socialnetworksandbox.com", // Use your verified email since you don't have a verified domain yet
      sendVerificationRequest: async ({ identifier: email, url, provider }) => {
        const { host } = new URL(url);
        const resendApiKey = provider.apiKey;
        
        if (!resendApiKey) {
          throw new Error("Missing RESEND_API_KEY");
        }

        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Grasper <noreply@socialnetworksandbox.com>", // Use your verified email as the sender
              to: email,
              subject: `Sign in to ${host}`,
              html: `<p>Click <a href="${url}">here</a> to sign in to Grasper.</p>`,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Resend error: ${JSON.stringify(error)}`);
          }

          await response.json();
        } catch (error) {
          throw new Error(`Resend error: ${error}`);
        }
      },
    }),
  ],
});
