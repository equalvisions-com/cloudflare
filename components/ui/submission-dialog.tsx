"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import Script from "next/script";

interface SubmissionDialogProps {
  children: React.ReactNode;
}

export const SubmissionDialog = React.memo(function SubmissionDialog({ 
  children 
}: SubmissionDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("");
  const [publicationName, setPublicationName] = useState("");
  const [rssFeed, setRssFeed] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // Turnstile lifecycle management
  useEffect(() => {
    if (open) {
      // Render Turnstile widget when dialog opens
      setTimeout(() => {
        if (turnstileRef.current && typeof window !== "undefined" && (window as any).turnstile) {
          try {
            turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
              sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
              callback: (token: string) => setTurnstileToken(token),
            });
          } catch (error) {
            console.error("Turnstile render error:", error);
          }
        }
      }, 100);
    } else {
      // Reset widget when dialog closes
      if (turnstileWidgetId.current && typeof window !== "undefined" && (window as any).turnstile) {
        try {
          (window as any).turnstile.reset(turnstileWidgetId.current);
        } catch (error) {
          console.error("Turnstile reset error:", error);
        }
      }
      setTurnstileToken("");
      setName("");
      setEmail("");
      setType("");
      setPublicationName("");
      setRssFeed("");
    }
  }, [open]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !type || !publicationName || !rssFeed || !turnstileToken) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, type, publicationName, rssFeed, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Submission received", description: "Thank you! We'll review your submission and get back to you soon." });
        setOpen(false);
        setName("");
        setEmail("");
        setType("");
        setPublicationName("");
        setRssFeed("");
        setTurnstileToken("");
      } else {
        toast({ title: "Submission failed", description: data?.error || "Please try again later." });
      }
    } finally {
      setSubmitting(false);
    }
  }, [name, email, type, publicationName, rssFeed, turnstileToken, toast]);

  return (
    <>
      <Script 
        src="https://challenges.cloudflare.com/turnstile/v0/api.js" 
        strategy="lazyOnload" 
      />
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Submit</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="focus-visible:ring-0 shadow-none" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="focus-visible:ring-0 shadow-none" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:ring-0 focus:outline-none focus-visible:ring-0 appearance-none"
                  required
                >
                  <option value="" disabled></option>
                  <option value="newsletter">Newsletter</option>
                  <option value="podcast">Podcast</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Publication Name</label>
              <Input 
                value={publicationName} 
                onChange={(e) => setPublicationName(e.target.value)} 
                className="focus-visible:ring-0 shadow-none" 
                placeholder=""
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">RSS Feed URL</label>
              <Input 
                type="url" 
                value={rssFeed} 
                onChange={(e) => setRssFeed(e.target.value)} 
                className="focus-visible:ring-0 shadow-none" 
                placeholder=""
                required 
              />
            </div>
            
            <input type="hidden" value={turnstileToken} readOnly />
            <Button 
              type="submit" 
              size="sm" 
              className="rounded-lg text-sm font-medium" 
              disabled={submitting || !turnstileToken}
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </form>

          {/* Turnstile widget container */}
          <div ref={turnstileRef} />
        </DialogContent>
      </Dialog>
    </>
  );
});
