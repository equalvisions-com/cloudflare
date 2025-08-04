import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { ResendOTPPasswordReset } from "./passwordReset/ResendOTPPasswordReset";
import { ResendOTPVerify } from "./emailVerification/ResendOTPVerify";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    Password({
      verify: ResendOTPVerify,
      reset: ResendOTPPasswordReset,
    }),
    Resend({
      id: "resend",
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL ?? "My App <noreply@socialnetworksandbox.com>",
    }),
    ResendOTPPasswordReset,
  ],
});
