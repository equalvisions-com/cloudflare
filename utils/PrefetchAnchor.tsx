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
    
    // Only use Next.js router if ALL conditions are met:
    // 1. Internal navigation
    // 2. Audio preservation is enabled
    // 3. There's a current track
    // 4. Audio is currently playing
    const shouldPreserveAudio = isInternal && preserveAudio && currentTrack && isPlaying;
    
    if (shouldPreserveAudio) {
      // Use Next.js router to preserve audio state during internal navigation
      router.push(href);
    } else {
      // Use window.open for ALL other cases to avoid bfcache issues:
      // - External links
      // - Internal links when audio is not playing
      // - Internal links when no current track
      // - Internal links when preserveAudio is false
      window.open(href, '_self');
    }
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
} 