// app/(auth)/signin/page.tsx  –  *server file*
import type { Metadata } from "next";
import SignInShell from "./SignInShell";

/* ------------------------------------------------ */
/*  runtime / caching flags                         */
export const dynamic = "force-dynamic";
export const runtime = "edge";
/* ------------------------------------------------ */

/* ---------- a.  Static meta  ---------- */
export async function generateMetadata(): Promise<Metadata> {
  const site = process.env.SITE_URL;

  return {
    /* <title> & <meta name="description"> */
    title:       "Sign in or Sign up – FocusFix",
    description: "Access your FocusFix account or create one in seconds.",
    alternates:  { canonical: `${site}/signin` },

    openGraph: {
      title:       "Welcome to FocusFix",
      description: "Log in or create a free account and start following great creators.",
      url:         `${site}/signin`,
      type:        "website",
      images:      [`${site}/og-images/auth.png`]
    },

    twitter: {
      card:        "summary_large_image",
      title:       "Sign in – FocusFix",
      description: "Pick up where you left off or join thousands of newsletter fans."
    },

    robots: { index: true, follow: true },   // we *do* want Google to rank "focusfix login"
  };
}

/* ---------- b.  Page component  ---------- */
export default function SignInPage() {
  const site = process.env.SITE_URL;

  /* Minimal, fast JSON-LD */
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id":   `${site}/signin#breadcrumbs`,
        "itemListElement": [
          { "@type":"ListItem","position":1,"name":"Home","item":`${site}/` },
          { "@type":"ListItem","position":2,"name":"Sign in","item":`${site}/signin`}
        ]
      },

      {
        "@type": "WebPage",
        "@id":   `${site}/signin`,
        "url":   `${site}/signin`,
        "name":  "Sign in or Sign up – FocusFix",
        "inLanguage": "en",
        "isPartOf": { "@id": `${site}/#website` },
        "description":
          "Log in to FocusFix or create a new account to follow newsletters and podcasts."
      },

      /* two allowed high-level actions on the same URL */
      {
        "@type":  "LoginAction",
        "target": { "@type": "EntryPoint", "urlTemplate": `${site}/signin` },
        "name":   "Sign in"
      },
      {
        "@type":  "RegisterAction",
        "target": { "@type": "EntryPoint", "urlTemplate": `${site}/signin` },
        "name":   "Sign up"
      }
    ]
  });

  return (
    <>
      <script
        id="auth-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      {/* ---- client logic (your current big component) ---- */}
      <SignInShell />
    </>
  );
}
