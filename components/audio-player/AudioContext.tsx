'use client';

import React, { createContext, useContext, useState, useRef } from 'react';
import { Howl } from 'howler';

interface AudioContextType {
  currentTrack: {
    src: string;
    title: string;
    image?: string;
  } | null;
  playTrack: (src: string, title: string, image?: string) => void;
  stopTrack: () => void;
  isPlaying: boolean;
  togglePlayPause: () => void;
  seek: number;
  duration: number;
  handleSeek: (value: number) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<{ src: string; title: string; image?: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seek, setSeek] = useState(0);
  const [duration, setDuration] = useState(0);
  const howlerRef = useRef<Howl | null>(null);

  const playTrack = (src: string, title: string, image?: string) => {
    // If there's an existing track, unload it
    if (howlerRef.current) {
      howlerRef.current.unload();
    }

    // Create new Howl instance
    howlerRef.current = new Howl({
      src: [src],
      html5: true,
      onload: () => {
        setDuration(howlerRef.current?.duration() || 0);
        howlerRef.current?.play();
      },
      onplay: () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop: () => setIsPlaying(false),
      onend: () => setIsPlaying(false),
    });

    setCurrentTrack({ src, title, image });
  };

  const stopTrack = () => {
    if (howlerRef.current) {
      howlerRef.current.unload();
      setCurrentTrack(null);
      setIsPlaying(false);
      setSeek(0);
      setDuration(0);
    }
  };

  const togglePlayPause = () => {
    if (!howlerRef.current) return;
    if (isPlaying) {
      howlerRef.current.pause();
    } else {
      howlerRef.current.play();
    }
  };

  const handleSeek = (value: number) => {
    if (!howlerRef.current) return;
    howlerRef.current.seek(value);
    setSeek(value);
  };

  // Update seek position
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (howlerRef.current && isPlaying) {
        setSeek(howlerRef.current.seek());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (howlerRef.current) {
        howlerRef.current.unload();
      }
    };
  }, []);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        playTrack,
        stopTrack,
        isPlaying,
        togglePlayPause,
        seek,
        duration,
        handleSeek,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
} 