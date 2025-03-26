import { useAudio } from '@/components/audio-player/AudioContext';
import { Podcast, Mail, MoreVertical, Loader2, Text } from "lucide-react";

              {mediaType && (
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-[6px]">
                  <span className="inline-flex items-center justify-center p-1 bg-secondary/60 rounded-md">
                    {mediaType.toLowerCase() === 'podcast' && <Podcast className="h-3 w-3" />}
                    {mediaType.toLowerCase() === 'newsletter' && <Text className="h-3 w-3" />}
                  </span>
                  <span className="font-medium">
                    {mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
                  </span>
                </div>
              )} 