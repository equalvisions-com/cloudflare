'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * AudioErrorBoundary - Production-ready error boundary for audio components
 * 
 * Catches React errors in audio player and provides fallback UI
 * Follows React error boundary best practices
 */
export class AudioErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send to your monitoring (Axiom in your case)
    console.error('Audio player error:', error, errorInfo);
    
    // Since you have Axiom, you could add logging here
    // window.axiom?.log('audio-error', { error: error.message, stack: error.stack, ...errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-center p-4 text-destructive">
            <div className="text-center space-y-3">
              <AlertTriangle className="h-8 w-8 mx-auto" />
              <div>
                <p className="text-sm font-medium">Audio Player Error</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Something went wrong with the audio player
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={this.handleReset}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 