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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

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
  const [activeTab, setActiveTab] = useState("sign-in");

  return (
    <div className="flex min-h-screen w-full container my-auto mx-auto">
      <div className="w-full max-w-[384px] mx-auto flex flex-col my-auto gap-4 pb-8 min-h-[500px]">
        <Card className="shadow-none">
          <CardContent className="pt-4">
            <Tabs 
              defaultValue="sign-in" 
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value);
                if (value === "sign-in") {
                  setStep("signIn");
                } else if (value === "create-account") {
                  setStep("signUp");
                }
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                <TabsTrigger value="create-account">Create account</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sign-in" className="space-y-0">
                {step === "signIn" && (
                  <>
                    <h2 className="text-lg font-extrabold tracking-tight">
                      Welcome back
                    </h2>
                    <p className="text-sm text-muted-foreground pb-4 pt-[1px]">Sign in to your account</p>
                    <SignInWithPassword 
                      onResetPassword={() => setStep("resetPassword")}
                    />
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
                    <p className="text-sm text-muted-foreground">We&apos;ve sent a password reset code to your email address.</p>
                    <Button
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => setStep("resetVerification")}
                    >
                      I have a code
                    </Button>
                    <Button
                      className="p-0 self-start mt-2"
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
                      onSuccess={() => {
                        setStep("signIn");
                        setActiveTab("sign-in");
                      }}
                      onCancel={() => setStep("signIn")}
                    />
                  </>
                )}
                
                {step === "linkSent" && (
                  <>
                    <h2 className="font-semibold text-2xl tracking-tight">
                      Check your email
                    </h2>
                    <p className="text-sm text-muted-foreground">A sign-in link has been sent to your email address.</p>
                    <Button
                      className="p-0 self-start mt-2"
                      variant="link"
                      onClick={() => setStep("signIn")}
                    >
                      Back to sign in
                    </Button>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="create-account" className="space-y-0">
                <h2 className="text-lg font-extrabold tracking-tight">
                  Create an account
                </h2>
                <p className="text-sm text-muted-foreground pb-4 pt-[1px]">Enter your details to continue</p>
                <SignUpWithPassword onSignIn={() => {
                  setStep("signIn");
                  setActiveTab("sign-in");
                }} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}

function SignInWithGoogle() {
  const { signIn } = useAuthActions();
  return (
    <Button
      className="w-full flex-1 shadow-none font-semibold"
      variant="outline"
      type="button"
      onClick={() => void signIn("google", { redirectTo: "/" })}
    >
      <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4">
        <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"></path>
        <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"></path>
        <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"></path>
        <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"></path>
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
        <div className="flex justify-between items-center">
          <Label className="font-semibold" htmlFor="signin-email">Email</Label>
        </div>
        <Input 
          id="signin-email" 
          name="email" 
          type="email" 
          autoComplete="email" 
          required 
          className="shadow-none"
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="font-semibold" htmlFor="signin-password">Password</Label>
          <Button 
            variant="link" 
            type="button" 
            className="p-0 h-auto text-sm font-normal" 
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
          className="shadow-none"
        />
      </div>
      
      <Button type="submit" className="w-full font-medium text-sm">
        Sign in
      </Button>

      <OAuthOption />
    </form>
  );
}

function OAuthOption() {
  return (
    <div className="w-full">
      <div className="relative mb-3">
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
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return hasMinLength && hasUppercase && hasLowercase && hasNumber;
  };

  const showPasswordRequirements = passwordFocused || passwordValue.length > 0;

  return (
    <form
      className="flex w-full flex-col space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("flow", "signUp");
        formData.set("redirectTo", "/");
        
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
        <div className="flex justify-between items-center">
          <Label className="font-semibold" htmlFor="signup-email">Email</Label>
        </div>
        <Input 
          id="signup-email" 
          name="email" 
          type="email" 
          autoComplete="email" 
          required 
          className="shadow-none"
        />
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <Label className="font-semibold" htmlFor="signup-password">Password</Label>
          <span className="invisible text-sm h-[20px]">Forgot password?</span>
        </div>
        <Input 
          id="signup-password" 
          name="password" 
          type="password" 
          autoComplete="new-password" 
          required 
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          onChange={(e) => setPasswordValue(e.target.value)}
          value={passwordValue}
          className="shadow-none"
        />
        {showPasswordRequirements && (
          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters with uppercase, lowercase, and numbers
          </p>
        )}
      </div>
      
      <Button type="submit" className="w-full font-medium text-sm" disabled={submitting}>
        Create account
      </Button>
      
      <OAuthOption />
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
        <div className="flex justify-between items-center">
          <Label htmlFor="reset-email">Email</Label>
        </div>
        <Input 
          id="reset-email" 
          name="email" 
          type="email" 
          autoComplete="email" 
          required 
          className="shadow-none"
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={submitting}>
        Send reset code
      </Button>
      
      <Button 
        variant="outline" 
        type="button" 
        className="w-full mt-4" 
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
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return hasMinLength && hasUppercase && hasLowercase && hasNumber;
  };

  const showPasswordRequirements = passwordFocused || passwordValue.length > 0;

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
        <div className="flex justify-between items-center">
          <Label htmlFor="verification-code">Verification code</Label>
        </div>
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
        <p className="text-xs text-muted-foreground">
          Enter the 8-digit code sent to your email
        </p>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="new-password">New password</Label>
          <span className="invisible text-sm h-[20px]">Forgot password?</span>
        </div>
        <Input 
          id="new-password" 
          name="newPassword" 
          type="password" 
          autoComplete="new-password" 
          required
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          onChange={(e) => setPasswordValue(e.target.value)}
          value={passwordValue}
          className="shadow-none"
        />
        {showPasswordRequirements && (
          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters with uppercase, lowercase, and numbers
          </p>
        )}
      </div>
      
      <Button type="submit" className="w-full" disabled={submitting || code.length < 8}>
        Reset password
      </Button>
      
      <Button 
        variant="outline" 
        type="button" 
        className="w-full mt-4" 
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </Button>
    </form>
  );
}
