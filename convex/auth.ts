import GitHub from "@auth/core/providers/github";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
 


export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google, 
    Resend({
      from: process.env.AUTH_EMAIL ?? "My App <noreply@socialnetworksandbox.com>",
    })
  ],
});
