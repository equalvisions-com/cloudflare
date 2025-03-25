import { ReactNode, useEffect, useState, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SafeAreaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  className?: string;
}

export function SafeArea({ 
  children, 
  top = true, 
  bottom = true,
  left = true,
  right = true,
  className,
  ...props
}: SafeAreaProps) {
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      // Update safe area insets when CSS environment variables are supported
      const updateSafeAreaInsets = () => {
        const computedStyle = getComputedStyle(document.documentElement);
        
        setSafeAreaInsets({
          top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
          right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10),
          bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10),
          left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10),
        });
      };

      // Add CSS variables for safe area insets
      const style = document.createElement('style');
      style.innerHTML = `
        :root {
          --sat: env(safe-area-inset-top, 0px);
          --sar: env(safe-area-inset-right, 0px);
          --sab: env(safe-area-inset-bottom, 0px);
          --sal: env(safe-area-inset-left, 0px);
        }
      `;
      document.head.appendChild(style);

      // Update insets initially and on resize
      updateSafeAreaInsets();
      window.addEventListener('resize', updateSafeAreaInsets);

      return () => {
        window.removeEventListener('resize', updateSafeAreaInsets);
        document.head.removeChild(style);
      };
    }
  }, []);

  // Apply padding based on safe area insets and props
  const style = {
    paddingTop: top ? `${safeAreaInsets.top}px` : undefined,
    paddingRight: right ? `${safeAreaInsets.right}px` : undefined, 
    paddingBottom: bottom ? `${safeAreaInsets.bottom}px` : undefined,
    paddingLeft: left ? `${safeAreaInsets.left}px` : undefined,
  };

  return (
    <div 
      className={cn('safe-area', className)} 
      style={style}
      {...props}
    >
      {children}
    </div>
  );
} 