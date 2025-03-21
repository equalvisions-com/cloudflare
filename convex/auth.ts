import { Password } from "@convex-dev/auth/providers/Password";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { ResendOTPPasswordReset } from "./passwordReset/ResendOTPPasswordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password({ 
      reset: ResendOTPPasswordReset 
    }),
    Resend({
      id: "resend",
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL ?? "My App <noreply@socialnetworksandbox.com>",
    })
  ],
});
