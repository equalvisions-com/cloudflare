// app/reset-password/page.tsx – *server file*
import type { Metadata } from "next";
import ResetPasswordWrapper from "./ResetPasswordWrapper";

/* ------------------------------------------------ */
/*  runtime / caching flags                         */
export const dynamic = "force-dynamic";
export const runtime = "edge";
/* ------------------------------------------------ */

/* ---------- a. Static meta ---------- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Reset Password – FocusFix',
    description: 'Reset your FocusFix account password securely.',
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

/* ---------- b. Page component ---------- */
export default function ResetPasswordPage() {
  return <ResetPasswordWrapper />;
}
