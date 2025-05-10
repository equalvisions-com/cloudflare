import React from 'react';

// Non-interactive wrapper for buttons/controls
export function NoFocusWrapper({
  onClick,
  className,
  children,
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={className}
      onMouseDown={(e) => e.preventDefault()}   // kill focus
      onClick={onClick}
    >
      {children}                               
    </div>
  );
}

// Direct button replacement that prevents focus on click
export const NoFocusButton = (props: React.ComponentProps<'button'>) => (
  <button
    {...props}
    tabIndex={-1}                 // keyboard skips it 
    onMouseDown={(e) => {         // prevents click-focus
      if (e.detail) e.preventDefault();
      props.onMouseDown?.(e);
    }}
  />
); 