"use client";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { SignInMethodDivider } from "@/components/ui/SignInMethodDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { EdgeAuthWrapper } from "@/components/auth/EdgeAuthWrapper";
import { useRouter } from "next/navigation";

type AuthStep = 
  | "signIn" 
  | "signUp" 
  | "verifyEmail"
  | "linkSent" 
  | "resetPassword" ;

export default function SignInPage() {
  return (
    <EdgeAuthWrapper>
      <SignInPageContent />
    </EdgeAuthWrapper>
  );
}

function SignInPageContent() {
  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  return (
    <div className="flex min-h-screen w-full px-4 md:px-0 my-auto mx-auto bg-background">
      {(step === "resetPassword" || step === "linkSent" || step === "verifyEmail") && (
        <div className="fixed top-6 left-6 z-50">
          <Button
            variant="link"
            className="h-4 p-0 flex items-center gap-1 no-underline hover:no-underline ml-[-5px]"
            onClick={() => setStep("signIn")}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>
      )}
      <div className="w-full max-w-[400px] mx-auto flex flex-col my-auto rounded-xl pb-[64px] md:pb-0">
            {(step === "resetPassword" || step === "verifyEmail") ? (
              <>
                {step === "verifyEmail" && (
                  <>
                                      <h2 className="text-2xl font-extrabold leading-none tracking-tight">
                      Check Email
                    </h2>
                    <p className="mt-2 mb-[22px] text-base text-muted-foreground">
                      Enter the 6-digit code sent to {email}
                    </p>
                    <SignUpVerification
                      email={email}
                      onSuccess={() => {
                        router.push("/onboarding");        
                        setStep("signIn");
                      }}
                    />
                  </>
                )}
            
                {step === "resetPassword" && (
                  <>
                    <h2 className="text-2xl font-extrabold leading-none tracking-tight">
                      Forgot Password
                    </h2>
                    <p className="mt-2 mb-[22px] text-base text-muted-foreground">Submit the email associated with your account and we&apos;ll send you a link to reset your password</p>
                    <ResetPasswordRequest 
                      onEmailSent={(emailValue) => {
                        setEmail(emailValue);
                        setStep("linkSent");
                      }}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {step === "signIn" && (
                  <>
                    <h2 className="text-2xl font-extrabold leading-none tracking-tight">
                      Sign In
                    </h2>
                    <div className="mt-2 mb-[22px] text-base text-muted-foreground">
                      Don&apos;t have an account?{" "}
                      <Button
                        variant="link"
                        type="button"
                        className="p-0 h-auto font-semibold text-base"
                        onClick={() => setStep("signUp")}
                      >
                        Sign up
                      </Button>
                    </div>
                    <SignInWithPassword 
                      onResetPassword={() => setStep("resetPassword")}
                      onVerificationNeeded={(emailFromSignin) => {
                        if (emailFromSignin) {
                          setEmail(emailFromSignin);
                          setStep("verifyEmail");
                        } else {
                          console.error("Email not provided to onVerificationNeeded from SignInWithPassword.");
                          toast({
                            title: "Navigation Error",
                            description: "Could not proceed to email verification.",
                            
                          });
                        }
                      }}
                    />
                  </>
                )}
                {step === "signUp" && (
                  <>
                    <h2 className="text-2xl font-extrabold leading-none tracking-tight">
                      Sign Up
                    </h2>
                    <div className="mt-2 mb-[22px] text-base text-muted-foreground">
                      Already have an account?{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto font-semibold text-base"
                        onClick={() => setStep("signIn")}
                      >
                        Sign in
                      </Button>
                    </div>                    <SignUpWithPassword 
                      onSignIn={() => {
                        setStep("signIn");
                      }} 
                      onVerificationNeeded={(emailFromSignup) => {
                        setEmail(emailFromSignup);
                        setStep("verifyEmail");
                      }}
                    />
                                     </>
                )}
              </>
            )}
            
            {step === "linkSent" && (
              <>
                <h2 className="text-2xl font-extrabold leading-none tracking-tight">
                  Check Email
                </h2>
                <p className="mt-2 text-base text-muted-foreground">A password reset link has been sent to {email}</p>
              </>
            )}
      </div>
      <Toaster />
    </div>
  );
}

function SignInWithGoogle() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  
  return (
    <Button
      className="w-full flex-1 shadow-none bg-secondary/50 border-text-muted-foreground/90 font-semibold text-muted-foreground"
      variant="outline"
      type="button"
      onClick={() => {
        void signIn("google", { redirectTo: "/onboarding" });
      }}
    >
      <svg viewBox="0 0 24 24" className="mr-0 h-4 w-4">
        <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"></path>
        <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"></path>
        <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"></path>
        <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"></path>
      </svg>
      Google
    </Button>
  );
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function SignInWithPassword({ 
  onResetPassword,
  onVerificationNeeded,
}: {
  onResetPassword: () => void;
  onVerificationNeeded: (email: string) => void;
}) {
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="flex w-full flex-col"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = formData.get("email") as string;
        formData.set("flow", "signIn");
        
        try {
          const result: any = await signIn("password", formData); // Capture and type result as any for now
          console.log("SignInWithPassword - signIn result:", result); // Log the result

          // Based on Convex patterns (like in SignUp), check if sign-in is pending verification
          // The exact properties might need adjustment after observing the log
          if (result && typeof result.signingIn === 'boolean' && result.signingIn === false && !result.redirect) {
            // User exists, is not fully signed in, and no immediate redirect means verification is likely needed.
            // The backend likely re-sent the OTP automatically (as per server logs)
            toast({
              title: "Verification Required",
              description: "Your email is not verified. A new code has been sent. Please check your email.",
            });
            if (email) {
              onVerificationNeeded(email); // Navigate to OTP input step
            } else {
              console.error("Email was null when trying to redirect to verification from sign in.");
              toast({
                title: "Error",
                description: "Could not retrieve email to proceed with verification.",
                
              });
            }
          } else if (result && (typeof result.signingIn === 'undefined' || result.signingIn === true )){
            // Assume successful sign-in if signingIn is true or not present (older auth behavior might not have this field on success)
            router.push("/onboarding");
          } else {
            // Unexpected result structure
            console.error("Unexpected sign-in result structure:", result);
            toast({
              title: "Sign-In Issue",
              description: "An unexpected issue occurred during sign-in. Please try again.",
              
            });
          }
        } catch (error: any) {
          // This catch block now handles other errors like wrong password, or if signIn truly fails
          console.error("SignInWithPassword - catch block error:", error); 
          const originalErrorMessage = (error.data?.message || error.message || "").toString();
          const lowerErrorMessage = originalErrorMessage.toLowerCase();
          
          // Fallback check for unverified, though ideally handled by the resolved promise above
          if (lowerErrorMessage.includes("unverified") || 
              lowerErrorMessage.includes("verify your email") || 
              lowerErrorMessage.includes("email verification needed") || 
              lowerErrorMessage.includes("verification required")) {
            
            toast({ 
              title: "Verification Still Required",
              description: "Please complete the verification. A new code may have been sent.",
            });
            // Attempt to resend OTP and navigate if this specific error is caught
            try {
              const verifyFormData = new FormData();
              // Assuming 'email' is accessible in this scope. If not, this part might need adjustment
              // or removal if resending OTP here is not desired/possible.
              const emailInputElement = (event.currentTarget.elements.namedItem("email") as HTMLInputElement);
              const currentEmail = emailInputElement ? emailInputElement.value : null;

              if (currentEmail) {
                verifyFormData.set("email", currentEmail);
                verifyFormData.set("flow", "email-verification");
                await signIn("password", verifyFormData); // Resend OTP
                onVerificationNeeded(currentEmail); // Navigate to OTP input step
              } else {
                 throw new Error("Email not available for OTP resend in catch block");
              }
            } catch (verifyError: any) {
              console.error("Error resending verification code from catch block:", verifyError);
              toast({
                title: "Verification Error",
                description: (verifyError.data?.message || verifyError.message || "Could not send verification code. Please try again."),
                
              });
            }
          } else if (lowerErrorMessage.includes("invalidsecret") || 
                     lowerErrorMessage.includes("invalid credential") || 
                     lowerErrorMessage.includes("cannot read properties of null (reading 'redirect')") ||
                     lowerErrorMessage.includes("null is not an object (evaluating \'o.redirect\')")) {
            // Specific handling for incorrect password / invalid credentials
            toast({
              title: "Sign-In Failed",
              description: "The email or password you entered is incorrect. Please try again.",
              
            });
          } else if (lowerErrorMessage.includes("invalidaccountid")) {
            // Specific handling for account not found
            toast({
              title: "Account Not Found",
              description: "No account found with that email address. Please check your email or sign up.",
              
            });
          } else {
            // Generic sign-in error for other cases
            toast({
              title: "Could not sign in",
              description: (originalErrorMessage || "An unexpected error occurred. Please try again."),
              
            });
          }
        }
      }}
    >
      <div className="space-y-2 mb-[20px] mt-[-1px]">
        <div className="flex justify-between items-center">
          <Label className="font-normal mb-[2px]" htmlFor="signin-email">Email</Label>
        </div>
        <Input 
          id="signin-email" 
          name="email" 
          type="email" 
          autoComplete="new-email" 
          required 
          placeholder="Email"
          className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      
      <div className="space-y-2 mb-[28px]">
        <div className="flex justify-between items-end mb-[10px]">
          <Label className="font-normal" htmlFor="signin-password">Password</Label>
          <Button 
            variant="link" 
            type="button" 
            className="p-0 h-auto text-sm text-muted-foreground font-normal" 
            onClick={onResetPassword}
          >
            Forgot password?
          </Button>
        </div>
        <Input 
          id="signin-password" 
          name="password" 
          type="password" 
          autoComplete="new-password" 
          required 
          placeholder="Password"
          className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      
      <Button type="submit" className="w-full font-semibold text-sm" disabled={!email.trim() || !password.trim()}>
        Sign in
      </Button>
      
      <OAuthOption />
    </form>
  );
}

function OAuthOption() {
  return (
    <div className="w-full mb-[21px]">
      <div className="relative mt-[20.5px] mb-[20.5px]">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
          Or
          </span>
        </div>
      </div>
      <SignInWithGoogle />
    </div>
  );
}

function SignUpWithPassword({ 
  onSignIn,
  onVerificationNeeded,
}: { 
  onSignIn: () => void;
  onVerificationNeeded: (email: string) => void; 
}) {
  const { signIn } = useAuthActions();
  const [isSubmitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const debouncedConfirmPassword = useDebounce(confirmPassword, 500); // Debounce confirmPassword
  const debouncedPassword = useDebounce(password, 500); // Debounce password for length check
  const [lengthValidationError, setLengthValidationError] = useState<string | null>(null);

  useEffect(() => {
    // If confirmPassword field is empty, don't show a mismatch error.
    // If a mismatch error was previously set, clear it.
    if (confirmPassword.length === 0) {
      setPasswordError((prevError) => prevError === "Passwords do not match" ? null : prevError);
      return;
    }

    // Only evaluate when the user has paused typing in the confirmPassword field
    if (debouncedConfirmPassword === confirmPassword) {
      if (password !== debouncedConfirmPassword) {
        setPasswordError("Passwords do not match");
      } else {
        // Passwords match
        setPasswordError((prevError) => prevError === "Passwords do not match" ? null : prevError);
      }
    }
    // No action if the user is still actively typing in confirmPassword
    // The error will either be set on the next debounce tick or caught by submit.
  }, [password, confirmPassword, debouncedConfirmPassword, setPasswordError]);

  useEffect(() => {
    // Password length validation
    if (!isPasswordFocused && password.length === 0) {
      setLengthValidationError(null);
      return;
    }
    if (isPasswordFocused || password.length > 0) { // Show/check when focused or if there's input
      if (debouncedPassword === password) { // Check only when user pauses
        if (password.length > 0 && password.length < 8) {
          setLengthValidationError("Password must be at least 8 characters");
        } else {
          setLengthValidationError(null);
        }
      }
    } else {
      setLengthValidationError(null); // Clear if not focused and no input
    }
  }, [password, debouncedPassword, isPasswordFocused, setLengthValidationError]);

  const validatePassword = (passwordToCheck: string) => {
    const hasMinLength = passwordToCheck.length >= 8;
    
    return hasMinLength;
  };

  const isValidEmail = (emailToTest: string) => {
    // More permissive email validation regex for modern TLDs
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToTest);
  };

  return (
    <form
      className="flex w-full flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        setPasswordError(null); // Clear previous password-related errors at the start of a new submission

        if (password !== confirmPassword) {
          setPasswordError("Passwords do not match");
          return;
        }

        if (!validatePassword(password)) {
          setPasswordError("Password must be at least 8 characters");
          return;
        }

        // If we reach here, passwords match and meet complexity requirements.
        const formData = new FormData(event.currentTarget);
        formData.set("flow", "signUp");
        setSubmitting(true);
        
        void signIn("password", formData)
          .then((result: { signingIn: boolean; redirect?: URL | string }) => {
            setSubmitting(false);
            if (result.signingIn === false && !result.redirect) {
              const emailFromForm = formData.get("email") as string;
              if (emailFromForm) {
                onVerificationNeeded(emailFromForm);
              } else {
                console.error("Email not found in signup form for verification step.");
                toast({
                  title: "Sign-Up Error",
                  description: "Could not retrieve email for verification. Please try signing up again or sign in if you have an account.",
                });
                onSignIn();
              }
            } else {
              router.push("/onboarding");
            }
          })
          .catch((error) => {
            setSubmitting(false);
            console.error("SignUp error:", error);
            
            // Check for both direct error message and nested error data
            const errorMessage = error instanceof Error ? error.message : "";
            const errorDataMessage = error?.data?.message || "";
            const fullErrorString = `${errorMessage} ${errorDataMessage}`.toLowerCase();
            
            // Check for "account already exists" error or null redirect error
            if (fullErrorString.includes("already exists") || 
                errorMessage.includes("Cannot read properties of null (reading 'redirect')") ||
                fullErrorString.includes("null is not an object (evaluating \'o.redirect\')")) {
              toast({
                title: "Email already registered",
                description: "This email address is already associated with an account. Please sign in instead.",
                
              });
              // Automatically switch to sign-in tab
              onSignIn();
            } else {
              toast({
                title: "Could not create account",
                description: error instanceof Error ? error.message : "Please try again",
                
              });
            }
          });
      }}
    >
      <div className="space-y-2 mb-[23px] mt-[-1px]">
        <div className="flex justify-between items-center mb-[10px]">
            <Label className="font-normal" htmlFor="signup-email">Email</Label>
        </div>
        <Input 
          id="signup-email" 
          name="email" 
          type="email" 
          autoComplete="email" 
          required 
          placeholder="Email"
          className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      
      <div className="space-y-2 mb-[26px]">
        <div className="flex justify-between items-center mb-[-1px]">
          <Label className="font-normal" htmlFor="signup-password">Password</Label>
          <span className="invisible text-sm underline h-[20px]">Forgot password?</span>
        </div>
        <Input 
          id="signup-password" 
          name="password" 
          type="password" 
          autoComplete="new-password" 
          required
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onFocus={() => setIsPasswordFocused(true)}
          onBlur={() => setIsPasswordFocused(false)}
        />
        {isPasswordFocused && !passwordError && !lengthValidationError && password.length < 8 && (
          <p className="text-xs text-muted-foreground p-0 m-0 h-3 leading-tight">
            Password must be at least 8 characters
          </p>
        )}
        {lengthValidationError && (
          <p className="text-xs text-red-500 p-0 m-0 h-3 leading-tight">
            {lengthValidationError}
          </p>
        )}
      </div>
      
      <div className="space-y-2 mb-[28px]">
        <div className="flex justify-between items-center mb-[10px]">
          <Label className="font-normal" htmlFor="signup-confirm-password">Confirm Password</Label>
        </div>
        <Input 
          id="signup-confirm-password" 
          name="confirmPassword" 
          type="password" 
          autoComplete="new-password" 
          required
          placeholder="Confirm Password"
          onChange={(e) => setConfirmPassword(e.target.value)}
          value={confirmPassword}
          className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {passwordError && (
          <p className="text-xs text-red-500">
            {passwordError}
          </p>
        )}
      </div>
      
      <Button 
        type="submit" 
        className="w-full font-semibold text-sm" 
        disabled={ 
          isSubmitting || 
          !email.trim() || 
          !password.trim() || 
          !confirmPassword.trim() || 
          password !== confirmPassword || 
          !validatePassword(password) ||
          lengthValidationError !== null ||
          !isValidEmail(email) // Add email format validation
        }
      >
Sign up      </Button>
      <OAuthOption />
    </form>
  );
}

function ResetPasswordRequest({ 
  onEmailSent, 
}: { 
  onEmailSent: (email: string) => void; 
}) {
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");

  const isValidEmail = (emailToTest: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToTest);
  };

  return (
    <form
      className="flex w-full flex-col space-y-[28px]"
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
              
            });
            setSubmitting(false);
          });
      }}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-center mb-[10px]">
          <Label className="font-normal" htmlFor="reset-email">Email</Label>
        </div>
        <Input 
          id="reset-email" 
          name="email" 
          type="email" 
          autoComplete="email"
          placeholder="Email"
          required 
          className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      
      <Button 
        type="submit" 
        className="w-full font-semibold" 
        disabled={submitting || !email.trim() || !isValidEmail(email)}
      >
        Submit
      </Button>
    </form>
  );
}

function SignUpVerification({
  email,
  onSuccess,
}: {
  email: string;
  onSuccess: () => void;
}) {
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResendOtpButton, setShowResendOtpButton] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setOtpError("Please enter the 6-digit code.");
      return;
    }
    setIsLoading(true);
    setShowResendOtpButton(false);
    setOtpError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("code", otp);
    formData.set("flow", "email-verification");

    try {
      // Use "password" as the provider key, as per original implementation and Convex docs for this flow
      await signIn("password", formData);
      toast({ title: "Success", description: "Email verified successfully!" });
      
      // Add delay before navigation to prevent auth flash
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onSuccess();
    } catch (error: any) {
      const clientErrorMessage = (error.data?.message || error.message || "An unknown error occurred during verification.").toString();
      console.log("Full client-side error object:", error); // For debugging
      console.log("Derived client-side errorMessage string:", clientErrorMessage); // For debugging

      const lowerClientErrorMessage = clientErrorMessage.toLowerCase();

      // Check for typical OTP failure messages (case-insensitive) OR the specific TypeError
      if (lowerClientErrorMessage.includes("could not verify code") || 
          lowerClientErrorMessage.includes("expired verification code") || 
          lowerClientErrorMessage.includes("invalid code") || 
          lowerClientErrorMessage.includes("incorrect code") ||
          (error instanceof TypeError && lowerClientErrorMessage.includes("cannot read properties of null (reading 'redirect')")) ||
          lowerClientErrorMessage.includes("null is not an object (evaluating \'o.redirect\')")
         ) {
        console.log("OTP Error: Entered specific failure block (expired/invalid or specific TypeError)."); // For debugging
        setOtpError("Invalid or expired code. Please try again or request a new one");
        setShowResendOtpButton(true);
        toast({
          title: "Verification Failed",
          description: "The code is invalid or has expired. Click 'Resend Code' to get a new one.",
          
        });
      } else {
        console.log("OTP Error: Entered generic failure block."); // For debugging
        // Handle other potential errors
        setOtpError(clientErrorMessage);
        toast({
          title: "Verification Error",
          description: clientErrorMessage,
          
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setOtpError(null);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("flow", "email-verification"); // No 'code' field for resend

    try {
      // Use "password" as the provider key, as per Convex docs for resending OTP
      await signIn("password", formData);
      toast({
        title: "Code Sent",
        description: "A new verification code has been sent to your email.",
      });
      setShowResendOtpButton(false);
      setOtp(""); // Clear the OTP input field
    } catch (error: any) {
      console.error("Resend OTP error:", error);
      const resendErrorMessage = error.data?.message || error.message || "Failed to resend code. Please try again.";
      toast({
        title: "Resend Failed",
        description: resendErrorMessage,
        
      });
      setShowResendOtpButton(true); // Keep resend button visible if it fails
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-[28px]">
      <div>
        <Label htmlFor="otp-code-input" className="sr-only">Verification Code</Label>
        <InputOTP 
          id="otp-code-input" 
          maxLength={6} 
          value={otp} 
          onChange={(value) => { setOtp(value); setOtpError(null); }}
        >
          <InputOTPGroup className="w-full flex font-semibold justify-center">
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      {otpError && <p className="text-sm text-red-500 text-center px-1">{otpError}</p>}
      <Button type="submit" className="w-full font-semibold" disabled={isLoading || otp.length < 6}>
        {isLoading && !showResendOtpButton ? "Verifying..." : "Verify"}
      </Button>
      {showResendOtpButton && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleResendOtp}
          disabled={isLoading}
        >
          {isLoading ? "Sending..." : "Resend Code"}
        </Button>
      )}
    </form>
  );
}
