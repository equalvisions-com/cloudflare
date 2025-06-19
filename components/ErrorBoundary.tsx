'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Logger } from 'next-axiom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private log: Logger;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    // Initialize Axiom logger for client-side error boundary
    this.log = typeof window !== 'undefined' ? new Logger() : { error: () => {} } as any;
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
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

  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <p>Something went wrong. Please refresh.</p>;
    }

    return this.props.children;
  }
} 