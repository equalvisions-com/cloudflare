import { useRef, useCallback, useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useProfileErrorHandler, withRetry, createErrorRecoveryStrategy } from '@/lib/utils/profileErrorHandler';
import { 
  BlobURLManager, 
  useFileValidation, 
  useImagePreview, 
  useOptimizedRetry,
  ResourceManager 
} from '@/lib/utils/profilePerformance';
import type { UseProfileImageUploadProps, UseProfileImageUploadReturn } from '@/lib/types';

export const useProfileImageUpload = ({
  onFileSelect,
  onUploadStart,
  onUploadSuccess,
  onUploadError,
}: UseProfileImageUploadProps): UseProfileImageUploadReturn => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getProfileImageUploadUrl = useAction(api.users.getProfileImageUploadUrl);
  const { handleError, classifyError } = useProfileErrorHandler();
  const [retryCount, setRetryCount] = useState(0);
  
  // Performance optimizations
  const validateFile = useFileValidation();
  const { createPreview, cleanupPreview } = useImagePreview();
  const { scheduleRetry, cancelAllRetries } = useOptimizedRetry();
  
  // Component ID for resource management
  const componentId = useRef(`profile-image-upload-${Date.now()}`);

  // Register cleanup on mount
  useEffect(() => {
    const id = componentId.current;
    ResourceManager.register(id, () => {
      cleanupPreview();
      cancelAllRetries();
      BlobURLManager.revokeAll();
    });

    return () => {
      ResourceManager.cleanup(id);
    };
  }, [cleanupPreview, cancelAllRetries]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Use optimized file validation
      const validation = validateFile(file);
      
      if (!validation.isValid) {
        const error = classifyError(
          new Error(validation.errors.join('. ')),
          { 
            fileSize: validation.size, 
            fileType: validation.type,
            fileName: file.name,
            operation: 'file_validation'
          }
        );
        handleError(error);
        return;
      }

      // Create optimized preview with memory management
      const imageUrl = createPreview(file);
      
      // Reset retry count on successful file selection
      setRetryCount(0);
      
      // Notify parent component
      onFileSelect(file, imageUrl);
    } catch (error) {
      const profileError = classifyError(error, { 
        operation: 'file_selection',
        fileName: file?.name 
      });
      handleError(profileError);
    }
  }, [onFileSelect, classifyError, handleError, validateFile, createPreview]);

  const uploadImageToR2 = useCallback(async (file: File): Promise<string> => {
    onUploadStart();
    
    try {
      // Cancel any pending retries before starting new upload
      cancelAllRetries();
      
      // Use optimized retry mechanism
      const uploadOperation = async () => {
        const uploadData = await getProfileImageUploadUrl();
        let uploadUrl = '';
        
        if (typeof uploadData.url === 'string') {
          uploadUrl = uploadData.url;
        } else if (uploadData.url && typeof uploadData.url === 'object') {
          uploadUrl = (uploadData.url as any).url || uploadData.url.toString();
        } else {
          throw new Error('Invalid URL format returned from server for image upload');
        }
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
            'Content-Length': String(file.size),
          },
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Image upload failed: ${uploadResponse.statusText || uploadResponse.status}`);
        }
        
        return uploadData.key;
      };

      // Get recovery strategy for upload errors
      const recoveryStrategy = createErrorRecoveryStrategy('UPLOAD_ERROR' as any);
      
      // Execute upload with optimized retry
      const uploadKey = await withRetry(
        uploadOperation,
        recoveryStrategy.maxRetries,
        recoveryStrategy.retryDelay
      );
      
      // Create optimized preview for success state
      const previewUrl = createPreview(file);
      onUploadSuccess(uploadKey, previewUrl);
      
      // Reset retry count on success
      setRetryCount(0);
      
      return uploadKey;
    } catch (error) {
      const profileError = classifyError(error, {
        operation: 'image_upload',
        fileName: file.name,
        fileSize: file.size,
        retryCount,
      });
      
      // Increment retry count
      setRetryCount(prev => prev + 1);
      
      // Use optimized retry scheduling if error is retryable
      if (profileError.retryable && retryCount < (profileError.maxRetries || 0)) {
        const retryFunction = () => {
          scheduleRetry(
            async () => {
              await uploadImageToR2(file);
            },
            createErrorRecoveryStrategy(profileError.type).retryDelay,
            (retryError) => {
              const retryProfileError = classifyError(retryError, {
                operation: 'image_upload_retry',
                fileName: file.name,
                retryCount: retryCount + 1,
              });
              handleError(retryProfileError);
            }
          );
        };
        
        handleError(profileError, retryFunction);
      } else {
        handleError(profileError);
      }
      
      onUploadError();
      throw error;
    }
  }, [
    getProfileImageUploadUrl,
    onUploadStart,
    onUploadSuccess,
    onUploadError,
    classifyError,
    handleError,
    retryCount,
    createPreview,
    cancelAllRetries,
    scheduleRetry,
  ]);

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Reset retry count and cleanup resources
    setRetryCount(0);
    cleanupPreview();
    cancelAllRetries();
  }, [cleanupPreview, cancelAllRetries]);

  const cleanupPreviewUrl = useCallback((url: string) => {
    try {
      // Use optimized blob URL management
      BlobURLManager.revoke(url);
    } catch (error) {
      // Silently handle cleanup errors - not critical
      
    }
  }, []);

  return {
    fileInputRef,
    handleFileChange,
    uploadImageToR2,
    resetFileInput,
    cleanupPreviewUrl,
  };
}; 