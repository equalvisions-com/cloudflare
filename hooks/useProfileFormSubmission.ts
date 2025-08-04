import { useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useToast } from '@/components/ui/use-toast';
import { useProfileErrorHandler, withRetry, createErrorRecoveryStrategy } from '@/lib/utils/profileErrorHandler';
import { 
  useOptimizedRetry,
  ResourceManager,
  performanceUtils 
} from '@/lib/utils/profilePerformance';
import type { 
  UseProfileFormSubmissionProps, 
  UseProfileFormSubmissionReturn
} from '@/lib/types';

export const useProfileFormSubmission = ({
  onSubmitStart,
  onSubmitSuccess,
  onSubmitError,
  onClose,
  uploadImageToR2,
  resetFileInput,
}: UseProfileFormSubmissionProps): UseProfileFormSubmissionReturn => {
  const updateProfile = useMutation(api.users.updateProfile);
  const router = useRouter();
  const { toast } = useToast();
  const { handleError, classifyError } = useProfileErrorHandler();
  
  // Performance optimizations
  const { scheduleRetry, cancelAllRetries } = useOptimizedRetry();
  const submissionInProgressRef = useRef(false);
  
  // Component ID for resource management
  const componentId = useRef(`profile-form-submission-${Date.now()}`);

  // Register cleanup on mount
  useEffect(() => {
    const id = componentId.current;
    ResourceManager.register(id, () => {
      cancelAllRetries();
      submissionInProgressRef.current = false;
    });

    return () => {
      ResourceManager.cleanup(id);
    };
  }, [cancelAllRetries]);

  const handleSubmit = useCallback(async (formData: {
    name: string;
    bio: string;
    profileImageKey: string | null;
    selectedFile: File | null;
  }) => {
    // Prevent concurrent submissions
    if (submissionInProgressRef.current) {
      toast({
        title: 'Submission in Progress',
        description: 'Please wait for the current submission to complete.',
        variant: 'destructive',
      });
      return;
    }

    onSubmitStart();
    
    // Cancel any pending retries before starting new submission
    cancelAllRetries();
    
    try {
      let finalImageKey = formData.profileImageKey;
      
      // Handle image upload with performance optimization
      if (formData.selectedFile) {
        try {
          // Use optimized retry for image upload
          const uploadOperation = async () => {
            return await uploadImageToR2(formData.selectedFile!);
          };

          const recoveryStrategy = createErrorRecoveryStrategy('UPLOAD_ERROR' as any);
          finalImageKey = await withRetry(
            uploadOperation,
            recoveryStrategy.maxRetries,
            recoveryStrategy.retryDelay
          );
        } catch (uploadError) {
          const profileError = classifyError(uploadError, {
            operation: 'image_upload_during_submission',
            fileName: formData.selectedFile.name,
          });
          
          // Use optimized retry scheduling for upload errors
          if (profileError.retryable) {
            const retryFunction = () => {
              scheduleRetry(
                () => handleSubmit(formData),
                createErrorRecoveryStrategy(profileError.type).retryDelay,
                (retryError) => {
                  const retryProfileError = classifyError(retryError, {
                    operation: 'submission_retry_after_upload_error',
                  });
                  handleError(retryProfileError);
                }
              );
            };
            
            handleError(profileError, retryFunction);
          } else {
            handleError(profileError);
          }
          
          onSubmitError();
          return;
        }
      }

      // Prepare optimized update data for Convex mutation
      const updateData = performanceUtils.deepClone({
        name: formData.name.trim() === '' ? null : formData.name.trim(),
        bio: formData.bio.trim() === '' ? null : formData.bio.trim(),
        profileImage: null, // Deprecated, R2 key is used
        // Always include profileImageKey when there's a file upload to trigger old image deletion
        ...(formData.selectedFile ? { profileImageKey: finalImageKey } : {}),
      });

      // Prevent concurrent submissions
      submissionInProgressRef.current = true;
      
      try {
        // Direct profile update with proper error handling
        await updateProfile(updateData);
        
        // Success - refresh page immediately to show fresh data
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        });
        
        // Full page reload will reset all state including modal state
        window.location.reload();
      } finally {
        submissionInProgressRef.current = false;
      }
    } catch (error) {
      // Ensure submission flag is reset on any error
      submissionInProgressRef.current = false;
      
      const profileError = classifyError(error, {
        operation: 'profile_update',
        formData: {
          nameLength: formData.name.length,
          bioLength: formData.bio.length,
          hasImage: !!formData.selectedFile,
        },
      });
      
      // Check for rate limit error specifically
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Profile update limit exceeded') || errorMessage.includes('rate limit')) {
        toast({
          title: 'Update Limit Reached',
          description: 'You can only update your profile 3 times per day. Please try again later.',
        });
        onSubmitError();
        return;
      }
      
      // Use optimized retry scheduling for other profile update errors
      if (profileError.retryable) {
        const retryFunction = () => {
          scheduleRetry(
            () => handleSubmit(formData),
            createErrorRecoveryStrategy(profileError.type).retryDelay,
            (retryError) => {
              const retryProfileError = classifyError(retryError, {
                operation: 'submission_retry_after_profile_error',
              });
              handleError(retryProfileError);
            }
          );
        };
        
        handleError(profileError, retryFunction);
      } else {
        handleError(profileError);
      }
      
      onSubmitError();
    }
  }, [
    updateProfile,
    router,
    toast,
    onSubmitStart,
    onSubmitSuccess,
    onSubmitError,
    onClose,
    uploadImageToR2,
    resetFileInput,
    classifyError,
    handleError,
    cancelAllRetries,
    scheduleRetry,
  ]);

  return {
    handleSubmit,
  };
}; 