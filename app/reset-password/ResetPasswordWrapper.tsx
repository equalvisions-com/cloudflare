"use client";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, type JSX } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { EdgeAuthWrapper } from "@/components/auth/EdgeAuthWrapper";

export default function ResetPasswordPage() {
  return (
    <EdgeAuthWrapper>
      <ResetPasswordPageContent />
    </EdgeAuthWrapper>
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

function ResetPasswordPageContent(): JSX.Element {
  const search = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { toast } = useToast();

  const emailFromUrl = search.get("email");
  const tokenFromUrl = search.get("token");

  const email = emailFromUrl ? decodeURIComponent(emailFromUrl) : "";
  const token = tokenFromUrl ? decodeURIComponent(tokenFromUrl) : "";

  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const debouncedConfirmPw = useDebounce(confirmPw, 1000);
  const debouncedPw = useDebounce(pw, 1000);
  const [lengthValidationError, setLengthValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (confirmPw.length === 0 && pw.length === 0) {
      setPasswordError(null);
      return;
    }
    if (confirmPw.length > 0 && debouncedConfirmPw === confirmPw) {
      if (pw !== debouncedConfirmPw) {
        setPasswordError("Passwords do not match");
      } else {
        setPasswordError(null);
      }
    } else if (confirmPw.length === 0 && pw.length > 0 && passwordError === "Passwords do not match") {
      setPasswordError("Passwords do not match");
    } else if (pw === confirmPw && passwordError === "Passwords do not match") {
      setPasswordError(null);
    }
  }, [pw, confirmPw, debouncedConfirmPw, passwordError, setPasswordError]);

  useEffect(() => {
    if (pw.length === 0 || validPw(pw)) {
      setLengthValidationError(null);
      return;
    }
    if (debouncedPw === pw && pw.length > 0 && !validPw(pw)) {
      setLengthValidationError("Password must be at least 8 characters");
    }
  }, [pw, debouncedPw]);

  const validPw = (s: string) =>
    s.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !token) {
      toast({
        title: "Invalid Link",
        description: "The password reset link is missing necessary information. Please request a new link.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    if (pw !== confirmPw) {
      toast({
        title: "Password Mismatch",
        description: "The entered passwords do not match. Please re-enter.",
        variant: "destructive",
      });
      setPasswordError("Passwords do not match");
      setSubmitting(false);
      return;
    }

    if (!validPw(pw)) {
      toast({
        title: "Invalid Password",
        description: "Password must be 8+ characters.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("flow", "reset-verification");
      formData.set("email", email);
      formData.set("code", token);
      formData.set("newPassword", pw);

      await signIn("password", formData);

      toast({
        title: "Success!",
        description: "Password changed successfully. You are now signed in.",
      });
      router.push("/");
    } catch (err: any) {
      const errorMessage = err.data?.message || err.message || "";
      if (
        errorMessage.includes("Invalid verification code") || 
        errorMessage.includes("Could not verify code") ||
        errorMessage.includes("Cannot read properties of null (reading 'redirect')")
      ) {
        toast({
          title: "Link Expired or Invalid",
          description: "This password reset link has expired or is invalid. Please request a new link.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset Failed",
          description: errorMessage || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
      setSubmitting(false);
    }
  }

  if (!email || !token) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4 text-center p-4">
          <h1 className="text-2xl font-bold">Invalid Link</h1>
          <p className="text-muted-foreground">This password reset link is invalid or has expired. Please try requesting a new link.</p>
          <Button onClick={() => router.push("/signin")}>Go to Sign In</Button>
        </div>
        <Toaster />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full container my-auto mx-auto bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-[400px] mx-auto flex flex-col my-auto rounded-xl pb-[64px] md:pb-0">
          <h2 className="text-2xl font-extrabold leading-none tracking-tight">Reset Password</h2>
          <p className="mt-2 mb-[22px] text-base text-muted-foreground">Enter a new password for {email}</p>
        <div className="space-y-[6px] mb-[20px]">
          <Label className="font-normal" htmlFor="np">Password</Label>
          <Input
            id="np"
            autoComplete="new-password"
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            onFocus={() => setIsPasswordFocused(true)}
            onBlur={() => setIsPasswordFocused(false)}
          />
          {isPasswordFocused && !validPw(pw) && !lengthValidationError && (
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
        <div className="space-y-[6px] mb-[28px]">
          <Label className="font-normal" htmlFor="cpw">Confirm Password</Label>
          <Input
            id="cpw"
            autoComplete="new-password"
            type="password"
            placeholder="Confirm Password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {passwordError && (
            <p className="text-xs text-red-500 p-0 m-0 h-3 leading-tight">
              {passwordError}
            </p>
          )}
        </div>
        <Button 
          className="w-full" 
          disabled={
            submitting || 
            !validPw(pw) || 
            pw !== confirmPw || 
            !confirmPw.trim() ||
            passwordError === "Passwords do not match"
          }
        >
          {submitting ? "Saving…" : "Submit"}
        </Button>
      </form>
      <Toaster />
    </main>
  );
} 