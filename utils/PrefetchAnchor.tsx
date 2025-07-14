'use client';

import { useRouter } from 'next/navigation';
import { ComponentProps } from 'react';
import { useAudioPlayerCurrentTrack, useAudioPlayerIsPlaying } from '@/lib/stores/audioPlayerStore';

type AnchorProps = ComponentProps<'a'> & { 
  href: string;
  preserveAudio?: boolean; // New prop to control audio preservation
};

export function PrefetchAnchor({ href, children, preserveAudio = true, ...rest }: AnchorProps) {
  const router = useRouter();
  const currentTrack = useAudioPlayerCurrentTrack();
  const isPlaying = useAudioPlayerIsPlaying();

  // No prefetching - removed useEffect

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // Check if this is an internal navigation (same origin)
    const isInternal = href.startsWith('/') || href.startsWith(window.location.origin);
    
    if (isInternal && preserveAudio && currentTrack && isPlaying) {
      // For internal navigation with audio playing, use Next.js router to preserve state
      router.push(href);
    } else {
      // For external links or when no audio is playing, use window.open to avoid bfcache issues
      window.open(href, '_self');
    }
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
} 