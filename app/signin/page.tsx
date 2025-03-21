"use client";

import { SignInMethodDivider } from "@/components/ui/SignInMethodDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthStep = 
  | "signIn" 
  | "signUp" 
  | "linkSent" 
  | "resetPassword" 
  | "resetSent" 
  | "resetVerification";

export default function SignInPage() {
  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-screen w-full container my-auto mx-auto">
      <div className="w-full max-w-[384px] mx-auto flex flex-col my-auto gap-4 pb-8">
        {step === "signIn" && (
          <>
            <div className="space-y-1 mb-2">
              <h2 className="font-semibold text-2xl tracking-tight">
                Sign in to your account
              </h2>
              <div className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Button 
                  variant="link" 
                  type="button" 
                  className="p-0 h-auto" 
                  onClick={() => setStep("signUp")}
                >
                  Sign up
                </Button>
              </div>
            </div>
            <SignInWithPassword 
              onResetPassword={() => setStep("resetPassword")}
            />
          </>
        )}

        {step === "signUp" && (
          <>
            <div className="space-y-1 mb-2">
              <h2 className="font-semibold text-2xl tracking-tight">
                Create an account
              </h2>
            </div>
            <SignUpWithPassword onSignIn={() => setStep("signIn")} />
          </>
        )}

        {step === "resetPassword" && (
          <>
            <h2 className="font-semibold text-2xl tracking-tight">
              Reset your password
            </h2>
            <ResetPasswordRequest 
              onEmailSent={(emailValue) => {
                setEmail(emailValue);
                setStep("resetSent");
              }}
              onCancel={() => setStep("signIn")}
            />
          </>
        )}

        {step === "resetSent" && (
          <>
            <h2 className="font-semibold text-2xl tracking-tight">
              Check your email
            </h2>
            <p>We&apos;ve sent a password reset code to your email address.</p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => setStep("resetVerification")}
            >
              I have a code
            </Button>
            <Button
              className="p-0 self-start"
              variant="link"
              onClick={() => setStep("signIn")}
            >
              Back to sign in
            </Button>
          </>
        )}

        {step === "resetVerification" && (
          <>
            <h2 className="font-semibold text-2xl tracking-tight">
              Reset your password
            </h2>
            <ResetPasswordVerification 
              email={email}
              onSuccess={() => setStep("signIn")}
              onCancel={() => setStep("signIn")}
            />
          </>
        )}

        {step === "linkSent" && (
          <>
            <h2 className="font-semibold text-2xl tracking-tight">
              Check your email
            </h2>
            <p>A sign-in link has been sent to your email address.</p>
            <Button
              className="p-0 self-start"
              variant="link"
              onClick={() => setStep("signIn")}
            >
              Back to sign in
            </Button>
          </>
        )}
      </div>
      <Toaster />
    </div>
  );
}

function SignInWithGoogle() {
  const { signIn } = useAuthActions();
  return (
    <Button
      className="w-full flex-1"
      variant="outline"
      type="button"
      onClick={() => void signIn("google", { redirectTo: "/" })}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
        <path fill="none" d="M1 1h22v22H1z" />
      </svg>
      Google
    </Button>
  );
}

function SignInWithPassword({ 
  onResetPassword 
}: {
  onResetPassword: () => void;
}) {
  const { signIn } = useAuthActions();
  const { toast } = useToast();

  return (
    <form
      className="flex w-full flex-col space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("flow", "signIn");
        formData.set("redirectTo", "/");
        
        void signIn("password", formData)
          .catch((error) => {
            console.error(error);
            toast({
              title: "Could not sign in",
              description: "Please check your email and password",
              variant: "destructive",
            });
          });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input 
          id="signin-email" 
          name="email" 
          type="email" 
          autoComplete="email" 
          required 
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="signin-password">Password</Label>
          <Button 
            variant="link" 
            type="button" 
            className="p-0 font-normal text-sm h-auto" 
            onClick={onResetPassword}
          >
            Forgot password?
          </Button>
        </div>
        <Input 
          id="signin-password" 
          name="password" 
          type="password" 
          autoComplete="current-password" 
          required 
        />
      </div>
      
      <Button type="submit" className="w-full">
        Sign in
      </Button>

      <OAuthOption />
    </form>
  );
}

function OAuthOption() {
  return (
    <div className="w-full">
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <SignInWithGoogle />
    </div>
  );
}

function SignUpWithPassword({ onSignIn }: { onSignIn: () => void }) {
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return hasMinLength && hasUppercase && hasLowercase && hasNumber;
  };

  return (
    <form
      className="flex w-full flex-col space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("flow", "signUp");
        
        const password = formData.get("password") as string;
        if (!validatePassword(password)) {
          toast({
            title: "Invalid password",
            description: "Password must be at least 8 characters with uppercase, lowercase, and numbers",
            variant: "destructive",
          });
          return;
        }
        
        setSubmitting(true);
        
        void signIn("password", formData)
          .then(() => {
            setSubmitting(false);
          })
          .catch((error) => {
            console.error(error);
            toast({
              title: "Could not create account",
              description: error instanceof Error ? error.message : "Please try again",
              variant: "destructive",
            });
            setSubmitting(false);
          });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input 
          id="signup-email" 
          name="email" 
          type="email" 
          autoComplete="email" 
          required 
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input 
          id="signup-password" 
          name="password" 
          type="password" 
          autoComplete="new-password" 
          required 
        />
        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters with uppercase, lowercase, and numbers
        </p>
      </div>
      
      <Button type="submit" className="w-full" disabled={submitting}>
        Create account
      </Button>
      
      <OAuthOption />
      
      <Button 
        variant="outline" 
        type="button" 
        className="w-full"
        onClick={onSignIn}
      >
        Sign in with existing account
      </Button>
    </form>
  );
}

function ResetPasswordRequest({ 
  onEmailSent, 
  onCancel 
}: { 
  onEmailSent: (email: string) => void; 
  onCancel: () => void;
}) {
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="flex w-full flex-col space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = formData.get("email") as string;
        formData.set("flow", "reset");
        formData.set("redirectTo", window.location.origin);
        
        setSubmitting(true);
        
        void signIn("password", formData)
          .then(() => {
            setSubmitting(false);
            onEmailSent(email);
          })
          .catch((error) => {
            console.error(error);
            toast({
              title: "Could not send reset code",
              description: "Please check your email address",
              variant: "destructive",
            });
            setSubmitting(false);
          });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input 
          id="reset-email" 
          name="email" 
          type="email" 
          autoComplete="email" 
          required 
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={submitting}>
        Send reset code
      </Button>
      
      <Button 
        variant="outline" 
        type="button" 
        className="w-full" 
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </Button>
    </form>
  );
}

function ResetPasswordVerification({ 
  email, 
  onSuccess, 
  onCancel 
}: { 
  email: string; 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return hasMinLength && hasUppercase && hasLowercase && hasNumber;
  };

  return (
    <form
      className="flex w-full flex-col space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("flow", "reset-verification");
        formData.set("email", email);
        formData.set("code", code);
        formData.set("redirectTo", window.location.origin);
        
        const newPassword = formData.get("newPassword") as string;
        if (!validatePassword(newPassword)) {
          toast({
            title: "Invalid password",
            description: "Password must be at least 8 characters with uppercase, lowercase, and numbers",
            variant: "destructive",
          });
          return;
        }
        
        setSubmitting(true);
        
        void signIn("password", formData)
          .then(() => {
            setSubmitting(false);
            onSuccess();
          })
          .catch((error) => {
            console.error(error);
            toast({
              title: "Could not reset password",
              description: error instanceof Error ? error.message : "Invalid or expired code",
              variant: "destructive",
            });
            setSubmitting(false);
          });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="verification-code">Verification code</Label>
        <InputOTP
          maxLength={8}
          value={code}
          onChange={(value) => setCode(value)}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
            <InputOTPSlot index={6} />
            <InputOTPSlot index={7} />
          </InputOTPGroup>
        </InputOTP>
        <p className="text-xs text-muted-foreground mt-1">
          Enter the 8-digit code sent to your email
        </p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input 
          id="new-password" 
          name="newPassword" 
          type="password" 
          autoComplete="new-password" 
          required 
        />
        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters with uppercase, lowercase, and numbers
        </p>
      </div>
      
      <Button type="submit" className="w-full" disabled={submitting || code.length < 8}>
        Reset password
      </Button>
      
      <Button 
        variant="outline" 
        type="button" 
        className="w-full" 
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </Button>
    </form>
  );
}
