'use client'

import { useEffect } from 'react'
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Connection Lost</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider attribute="class">
          <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-8">
              {/* Large WiFi icon */}
              <Wifi className="h-32 w-32 text-muted-foreground" aria-hidden="true" />

              <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tight">Connection Lost</h1>

                <p className="text-muted-foreground text-lg">
                  It seems you're offline or having connection issues. Please check your internet connection and try again.
                </p>
              </div>

              {/* Refresh button */}
              <Button onClick={() => reset()} size="lg" className="px-8 py-6 h-auto text-lg">
                Refresh Connection
              </Button>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
} 