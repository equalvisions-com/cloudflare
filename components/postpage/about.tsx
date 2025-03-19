'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

interface AboutProps {
  postTitle: string;
}

export function About({ postTitle }: AboutProps) {
  // In a real implementation, you might fetch podcast details from an API
  // This is a placeholder with static content
  const podcastInfo = {
    description: 'This is a podcast about exploring interesting topics and interviewing fascinating people.',
    host: 'Jane Smith',
    website: 'https://example.com/podcast',
    schedule: 'New episodes every Wednesday',
    contact: 'podcast@example.com'
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">About {postTitle}</h2>
      </div>
      
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{podcastInfo.description}</p>
        </CardContent>
      </Card>
      
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-medium">Host:</span> {podcastInfo.host}
          </div>
          <div>
            <span className="font-medium">Website:</span> {podcastInfo.website}
          </div>
          <div>
            <span className="font-medium">Release Schedule:</span> {podcastInfo.schedule}
          </div>
          <div>
            <span className="font-medium">Contact:</span> {podcastInfo.contact}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 