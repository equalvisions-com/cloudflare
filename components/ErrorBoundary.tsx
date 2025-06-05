'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console (existing functionality)
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Log to Axiom if available
    try {
      // Check if Axiom logger is available globally
      if (typeof window !== 'undefined' && (window as any).__axiom_logger) {
        (window as any).__axiom_logger.error('React crash', {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (axiomError) {
      // Fail silently to avoid breaking the error boundary
      console.warn('Failed to log to Axiom:', axiomError);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
} 