import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SignInButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // Add any specific props if needed in the future
}

export const SignInButton = React.forwardRef<HTMLButtonElement, SignInButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Link href="/signin">
        <button
          ref={ref}
          className={cn(
            "bg-secondary text-muted-foreground hover:bg-secondary/80 rounded-full text-sm font-semibold px-3 py-2 border-none shadow-none",
            className // Allow overriding/extending styles
          )}
          {...props}
        >
          Sign in
        </button>
      </Link>
    );
  }
);

SignInButton.displayName = 'SignInButton'; 