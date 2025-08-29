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
import { useTheme } from "next-themes";

interface MenuButtonProps {
  onClick?: () => void;
  className?: string;
}

export const MenuButton = React.memo(function MenuButton({ 
  onClick, 
  className
}: MenuButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pathname = usePathname();
  const postSlug = useMemo(() => {
    if (!pathname) return "";
    const parts = pathname.split("/").filter(Boolean);
    return parts[1] || ""; // e.g., /podcasts/[slug] or /newsletters/[slug]
  }, [pathname]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [widgetId, setWidgetId] = useState<any>(null);
  const { resolvedTheme } = useTheme();

  const handleReportClick = useCallback(() => {
    setOpen(true);
  }, []);

  // Render a fresh Turnstile widget whenever the dialog opens; remove on close
  useEffect(() => {
    const ts = (window as any).turnstile;
    if (open && ts && widgetRef.current) {
      try {
        if (widgetId) {
          ts.remove(widgetId);
          setWidgetId(null);
        }
        const id = ts.render(widgetRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          theme: resolvedTheme === "dark" ? "dark" : "light",
        });
        setWidgetId(id);
      } catch {}
    }
    if (!open && widgetId && ts) {
      try { ts.remove(widgetId); } catch {}
      setWidgetId(null);
      setTurnstileToken("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resolvedTheme]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !reason || !description || !turnstileToken) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, reason, description, postSlug, turnstileToken }),
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
  }, [name, email, reason, description, postSlug, turnstileToken, toast]);

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
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium">Reason</label>
              <select
                className="w-full border rounded-md h-9 px-3 bg-background"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                <option value="" disabled>Select…</option>
                <option value="spam/promo">Spam or promotional content</option>
                <option value="inappropriate/harmful">Inappropriate or harmful content</option>
                <option value="intellectual">Intellectual property</option>
                <option value="other">Other (explain)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Details</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" required />
            </div>

            <input type="hidden" value={turnstileToken} readOnly />
            <Button type="submit" size="sm" className="rounded-lg" disabled={submitting || !turnstileToken}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </form>

          {/* Turnstile explicit render container */}
          <div ref={widgetRef} />
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer />
        </DialogContent>
      </Dialog>
    </>
  );
}); 