'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'

export default function FloatingChatButton() {
  const pathname = usePathname()

  // Hide on chat page and signin page
  if (pathname === '/chat' || pathname === '/signin') return null

  return (
    <div className="hidden md:fixed md:bottom-6 md:right-6 md:block z-50">
      <Link href="/chat" prefetch={false}>
        <button
          className="bg-primary text-primary-foreground p-3 rounded-full hover:bg-primary/90 transition shadow-none"
          aria-label="Ask AI Chat"
        >
          <MessageCircle size={24} />
        </button>
      </Link>
    </div>
  )
}
