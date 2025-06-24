'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Logger } from 'next-axiom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; retry: () => void }) => ReactNode);
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private log: Logger;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    // Initialize Axiom logger for client-side error boundary
    this.log = typeof window !== 'undefined' ? new Logger() : { error: () => {} } as any;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to Axiom with comprehensive error details
    this.log.error('React ErrorBoundary caught error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      errorName: error.name,
    });

    // Also log to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({ error: this.state.error, retry: this.retry });
      }
      return this.props.fallback || <p>Something went wrong. Please refresh.</p>;
    }

    return this.props.children;
  }
} 