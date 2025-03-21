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
import Image from "next/image";

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
      <Image
        src="/google.svg"
        alt="Google logo"
        width={16}
        height={16}
        className="mr-2"
      />
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
