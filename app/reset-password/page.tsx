"use client";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  const debouncedConfirmPw = useDebounce(confirmPw, 500);

  useEffect(() => {
    if (confirmPw.length === 0 && pw.length === 0) {
      setPasswordError(null);
      return;
    }
    if (confirmPw.length > 0 && debouncedConfirmPw === confirmPw) {
      if (pw !== debouncedConfirmPw) {
        setPasswordError("Passwords do not match.");
      } else {
        setPasswordError(null);
      }
    } else if (confirmPw.length === 0 && pw.length > 0 && passwordError === "Passwords do not match.") {
      setPasswordError("Passwords do not match.");
    } else if (pw === confirmPw && passwordError === "Passwords do not match.") {
      setPasswordError(null);
    }
  }, [pw, confirmPw, debouncedConfirmPw, passwordError, setPasswordError]);

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
      setPasswordError("Passwords do not match.");
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
      console.error("Reset password error:", err);
      toast({
        title: "Reset Failed",
        description: err.data?.message || err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
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
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-card p-6 sm:p-8 rounded-lg shadow-md">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Reset Your Password</h1>
          <p className="text-muted-foreground">Enter a new password for {email}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="np">Choose a new password</Label>
          <Input
            id="np"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            required
            onFocus={() => setIsPasswordFocused(true)}
            onBlur={() => setIsPasswordFocused(false)}
          />
          {isPasswordFocused && (
            <p className="text-xs text-muted-foreground">
              Must be 8+ characters
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpw">Confirm new password</Label>
          <Input
            id="cpw"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
          />
          {passwordError && (
            <p className="text-xs text-destructive mt-1">
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
            passwordError === "Passwords do not match."
          }
        >
          {submitting ? "Saving…" : "Set New Password"}
        </Button>
      </form>
      <Toaster />
    </main>
  );
} 