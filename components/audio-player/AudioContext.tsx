'use client';

import React, { createContext, useContext, useState, useRef } from 'react';
import { Howl } from 'howler';

interface AudioContextType {
  currentTrack: {
    src: string;
    title: string;
  } | null;
  playTrack: (src: string, title: string) => void;
  isPlaying: boolean;
  togglePlayPause: () => void;
  seek: number;
  duration: number;
  volume: number;
  setVolume: (value: number) => void;
  muted: boolean;
  toggleMute: () => void;
  handleSeek: (value: number) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<{ src: string; title: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seek, setSeek] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const howlerRef = useRef<Howl | null>(null);

  const playTrack = (src: string, title: string) => {
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

    setCurrentTrack({ src, title });
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

  const toggleMute = () => {
    if (!howlerRef.current) return;
    if (muted) {
      howlerRef.current.volume(volume);
      setMuted(false);
    } else {
      howlerRef.current.volume(0);
      setMuted(true);
    }
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
        isPlaying,
        togglePlayPause,
        seek,
        duration,
        volume,
        setVolume,
        muted,
        toggleMute,
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