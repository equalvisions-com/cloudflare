"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Ellipsis, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Script from "next/script";
import { usePathname } from "next/navigation";

interface UserReportMenuButtonProps {
  onClick?: () => void;
  className?: string;
  username?: string;
}

export const UserReportMenuButton = React.memo(function UserReportMenuButton({ 
  onClick, 
  className,
  username
}: UserReportMenuButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pathname = usePathname();
  const userSlug = useMemo(() => {
    if (username) return username;
    if (!pathname) return "";
    const parts = pathname.split("/").filter(Boolean);
    // For /@username URL structure: parts[0] = "@username"
    const extractedUsername = parts[0]?.replace("@", "") || "";
    return extractedUsername;
  }, [pathname, username]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const handleReportClick = useCallback(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    (window as any).onUserReportTurnstile = (token: string) => setTurnstileToken(token);
    return () => {
      delete (window as any).onUserReportTurnstile;
    };
  }, []);

  // Reset turnstile when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Dialog opened - render turnstile after a brief delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if ((window as any).turnstile && turnstileRef.current) {
          turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            callback: (token: string) => setTurnstileToken(token),
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Dialog closed - reset turnstile and form
      if ((window as any).turnstile && turnstileWidgetId.current) {
        (window as any).turnstile.reset(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
      setTurnstileToken("");
      setName("");
      setEmail("");
      setReason("");
      setDescription("");
    }
  }, [open]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !reason || !description || !turnstileToken || !userSlug) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/user-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, reason, description, username: userSlug, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Report submitted", description: "Thank you for helping keep our community safe." });
        setOpen(false);
        setName("");
        setEmail("");
        setReason("");
        setDescription("");
        setTurnstileToken("");
      } else {
        toast({ title: "Submission failed", description: data?.error || "Please try again later." });
      }
    } finally {
      setSubmitting(false);
    }
  }, [name, email, reason, description, userSlug, turnstileToken, toast]);



  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            onClick={onClick}
            size="icon"
            variant="ghost"
            className={cn(
              "rounded-full bg-[hsl(var(--background))] shadow-none !hover:bg-transparent !hover:bg-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 active:ring-0 w-4 p-0 flex justify-end",
              className
            )}
            style={{ 
              backgroundColor: "hsl(var(--background))" 
            }}
            aria-label="User options menu"
          >
            <Ellipsis 
              width={18} 
              height={18} 
              className="text-muted-foreground" 
              strokeWidth={2} 
              style={{ minWidth: "18px", minHeight: "18px" }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            className="text-red-500 hover:text-red-600"
            onClick={handleReportClick}
          >
            <Flag className="mr-2 h-4 w-4" />
            Report User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Report</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="focus-visible:ring-0 shadow-none" required />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="focus-visible:ring-0 shadow-none" required />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select a reason</label>
              <div className="relative">
                <select
                  className="w-full border rounded-md text-sm h-9 px-3 pr-8 bg-background focus:ring-0 focus:outline-none focus-visible:ring-0 appearance-none"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  <option value="" disabled></option>
                  <option value="harassment">Harassment or bullying</option>
                  <option value="inappropriate/harmful">Inappropriate or harmful content</option>
                  <option value="spam/fake">Spam or fake account</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="other">Other (explain)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Please provide more details about this issue</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none focus-visible:ring-0 shadow-none" required />
            </div>

            <input type="hidden" value={turnstileToken} readOnly />
            <Button type="submit" size="sm" className="rounded-lg text-sm font-medium" disabled={submitting || !turnstileToken}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </form>

          {/* Turnstile widget container */}
          <div ref={turnstileRef} />
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
        </DialogContent>
      </Dialog>
    </>
  );
}); 
