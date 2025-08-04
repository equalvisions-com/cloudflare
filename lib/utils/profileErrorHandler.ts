import { useToast } from '@/components/ui/use-toast';

// Error types for profile operations
export enum ProfileErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',       // User can continue, show subtle notification
  MEDIUM = 'MEDIUM', // Show toast, but allow retry
  HIGH = 'HIGH',     // Block operation, show prominent error
  CRITICAL = 'CRITICAL', // System-level error, may need page refresh
}

// Profile error interface
export interface ProfileError {
  type: ProfileErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  context?: Record<string, unknown>;
}

// Error classification function
export const classifyError = (error: unknown, context?: Record<string, unknown>): ProfileError => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Rate limit errors
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return {
      type: ProfileErrorType.RATE_LIMIT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: 'You can only change your profile 3 times per day. Try again later.',
      originalError: error instanceof Error ? error : undefined,
      retryable: false,
      context,
    };
  }

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
    return {
      type: ProfileErrorType.NETWORK_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: 'Network connection issue. Please check your internet and try again.',
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
      maxRetries: 3,
      context,
    };
  }

  // Upload specific errors
  if (lowerMessage.includes('upload') || lowerMessage.includes('image') || lowerMessage.includes('file')) {
    return {
      type: ProfileErrorType.UPLOAD_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: 'Failed to upload image. Please try a different image or try again.',
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
      maxRetries: 2,
      context,
    };
  }

  // Validation errors
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || lowerMessage.includes('required')) {
    return {
      type: ProfileErrorType.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      message: 'Please check your input and try again.',
      originalError: error instanceof Error ? error : undefined,
      retryable: false,
      context,
    };
  }

  // Server errors (5xx)
  if (lowerMessage.includes('server error') || lowerMessage.includes('internal error') || lowerMessage.includes('500')) {
    return {
      type: ProfileErrorType.SERVER_ERROR,
      severity: ErrorSeverity.HIGH,
      message: 'Server is experiencing issues. Please try again in a few minutes.',
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
      maxRetries: 2,
      context,
    };
  }

  // Default unknown error
  return {
    type: ProfileErrorType.UNKNOWN_ERROR,
    severity: ErrorSeverity.MEDIUM,
    message: 'An unexpected error occurred. Please try again or contact support.',
    originalError: error instanceof Error ? error : undefined,
    retryable: true,
    maxRetries: 1,
    context,
  };
};

// Error handler hook
export const useProfileErrorHandler = () => {
  const { toast } = useToast();

  const handleError = (error: ProfileError, onRetry?: () => void) => {
    // Profile error handling - removed console logging

    // Show appropriate toast based on severity
    switch (error.severity) {
      case ErrorSeverity.LOW:
        toast({
          title: 'Notice',
          description: error.message,
        });
        break;

      case ErrorSeverity.MEDIUM:
        toast({
          title: getErrorTitle(error.type),
          description: error.message,
          variant: 'destructive',
        });
        break;

      case ErrorSeverity.HIGH:
        toast({
          title: getErrorTitle(error.type),
          description: error.message,
          variant: 'destructive',
          duration: 10000, // Longer duration for high severity
        });
        break;

      case ErrorSeverity.CRITICAL:
        toast({
          title: 'Critical Error',
          description: `${error.message} Please refresh the page.`,
          variant: 'destructive',
          duration: Infinity, // Persistent until dismissed
        });
        break;
    }
  };

  const getErrorTitle = (type: ProfileErrorType): string => {
    switch (type) {
      case ProfileErrorType.NETWORK_ERROR:
        return 'Connection Error';
      case ProfileErrorType.UPLOAD_ERROR:
        return 'Upload Failed';
      case ProfileErrorType.VALIDATION_ERROR:
        return 'Invalid Input';
      case ProfileErrorType.RATE_LIMIT_ERROR:
        return 'Rate Limit Exceeded';
      case ProfileErrorType.SERVER_ERROR:
        return 'Server Error';
      default:
        return 'Error';
    }
  };

  return {
    handleError,
    classifyError,
  };
};

// Retry utility with exponential backoff
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

// Error recovery strategies
export const createErrorRecoveryStrategy = (errorType: ProfileErrorType) => {
  switch (errorType) {
    case ProfileErrorType.NETWORK_ERROR:
      return {
        shouldRetry: true,
        retryDelay: 2000,
        maxRetries: 3,
        recoveryAction: 'Check your internet connection and try again.',
      };

    case ProfileErrorType.UPLOAD_ERROR:
      return {
        shouldRetry: true,
        retryDelay: 1000,
        maxRetries: 2,
        recoveryAction: 'Try selecting a different image or reducing the file size.',
      };

    case ProfileErrorType.RATE_LIMIT_ERROR:
      return {
        shouldRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        recoveryAction: 'Wait before making more changes to your profile.',
      };

    case ProfileErrorType.SERVER_ERROR:
      return {
        shouldRetry: true,
        retryDelay: 5000,
        maxRetries: 2,
        recoveryAction: 'The server is experiencing issues. Please wait a moment.',
      };

    default:
      return {
        shouldRetry: true,
        retryDelay: 1000,
        maxRetries: 1,
        recoveryAction: 'Please try again or contact support if the problem persists.',
      };
  }
}; 