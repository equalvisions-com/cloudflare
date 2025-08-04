import React from 'react';
import Link, { LinkProps } from 'next/link';

// For wrapping link elements
export function NoFocusLinkWrapper({
  onClick,
  className,
  children,
  onTouchStart,
}: {
  onClick?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className}
      onMouseDown={(e) => e.preventDefault()}  // kill focus
      onClick={onClick}
      onTouchStart={onTouchStart}
    >
      {children} 
    </div>
  );
}

// Direct Link replacement that prevents focus on click
type NoFocusLinkProps = LinkProps & {
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
};

export const NoFocusLink = ({ children, className, onClick, onTouchStart, ...props }: NoFocusLinkProps) => (
  <Link
    {...props}
    tabIndex={-1}                 // keyboard skips it
    onMouseDown={(e) => e.preventDefault()}  // prevents click-focus
    onClick={onClick}
    onTouchStart={onTouchStart}
    className={className}
  >
    {children}
  </Link>
);

// For regular anchor elements, not Next.js Links
export const NoFocusAnchor = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<'a'>
>((props, ref) => (
  <a
    {...props}
    ref={ref}
    tabIndex={-1}                 // keyboard skips it
    /* Prevent focus on mousedown */
    onMouseDown={(e) => {
      e.preventDefault();
      props.onMouseDown?.(e);
    }}
    className={props.className}
  />
));

NoFocusAnchor.displayName = 'NoFocusAnchor'; 