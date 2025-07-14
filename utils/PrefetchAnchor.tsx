'use client';

import { useRouter } from 'next/navigation';
import { ComponentProps } from 'react';

type AnchorProps = ComponentProps<'a'> & { 
  href: string;
  preserveAudio?: boolean; // New prop to control audio preservation
};

export function PrefetchAnchor({ href, children, preserveAudio = true, ...rest }: AnchorProps) {
  const router = useRouter();

  // No prefetching - removed useEffect

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // Check if this is an internal navigation (same origin)
    const isInternal = href.startsWith('/') || href.startsWith(window.location.origin);
    
    if (isInternal) {
      // For internal navigation, use Next.js router to preserve audio player
      router.push(href);
    } else {
      // For external links, use window.open
      window.open(href, '_self');
    }
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
} 