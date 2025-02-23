"use client";

import { useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title?: string;
}

export function AudioPlayer({ src, title }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [seek, setSeek] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const howlerRef = useRef<Howl | null>(null);

  useEffect(() => {
    howlerRef.current = new Howl({
      src: [src],
      html5: true,
      onload: () => {
        setLoading(false);
        setDuration(howlerRef.current?.duration() || 0);
      },
      onplay: () => setPlaying(true),
      onpause: () => setPlaying(false),
      onstop: () => setPlaying(false),
    });

    return () => {
      howlerRef.current?.unload();
    };
  }, [src]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (howlerRef.current && playing) {
        setSeek(howlerRef.current.seek());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [playing]);

  const togglePlayPause = () => {
    if (!howlerRef.current) return;

    if (playing) {
      howlerRef.current.pause();
    } else {
      howlerRef.current.play();
    }
  };

  const handleSeek = (value: number[]) => {
    if (!howlerRef.current) return;
    const newPosition = value[0];
    howlerRef.current.seek(newPosition);
    setSeek(newPosition);
  };

  const handleVolume = (value: number[]) => {
    if (!howlerRef.current) return;
    const newVolume = value[0];
    howlerRef.current.volume(newVolume);
    setVolume(newVolume);
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

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-sm">
      {title && (
        <div className="mb-4 text-sm font-medium text-muted-foreground">
          {title}
        </div>
      )}
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlayPause}
            className="h-10 w-10"
          >
            {playing ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          
          <div className="flex-1">
            <Slider
              value={[seek]}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
          </div>
          
          <div className="min-w-[4rem] text-right text-sm text-muted-foreground">
            {formatTime(seek)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          
          <Slider
            value={[muted ? 0 : volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={handleVolume}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
} 