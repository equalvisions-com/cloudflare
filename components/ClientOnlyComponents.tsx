'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Dynamically import audio components with ssr disabled
const AudioProvider = dynamic(
  () => import("@/components/audio-player/AudioContext").then(mod => mod.AudioProvider),
  { ssr: false }
) as React.ComponentType<{ children: React.ReactNode }>;

const PersistentPlayer = dynamic(
  () => import("@/components/audio-player/PersistentPlayer").then(mod => mod.PersistentPlayer),
  { ssr: false }
);

// Dynamically import floating chat button with ssr disabled
const FloatingChatButton = dynamic(
  () => import("@/components/FloatingChatButton"),
  { ssr: false }
);

interface ClientOnlyComponentsProps {
  children: ReactNode;
}

export function ClientOnlyComponents({ children }: ClientOnlyComponentsProps) {
  return (
    <AudioProvider>
      {children}
      <PersistentPlayer />
      <FloatingChatButton />
    </AudioProvider>
  );
} 