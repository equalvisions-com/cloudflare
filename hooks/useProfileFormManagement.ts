import { useCallback, useRef, useEffect } from 'react';
import { 
  useDebouncedCallback,
  ResourceManager,
  performanceUtils 
} from '@/lib/utils/profilePerformance';
import type { 
  UseProfileFormManagementProps, 
  UseProfileFormManagementReturn 
} from '@/lib/types';

export const useProfileFormManagement = ({
  formState,
  initialData,
  dispatch,
  onClose,
  resetFileInput,
  cleanupPreviewUrl,
}: UseProfileFormManagementProps): UseProfileFormManagementReturn => {
  
  // Component ID for resource management
  const componentId = useRef(`profile-form-management-${Date.now()}`);
  
  // Register cleanup on mount
  useEffect(() => {
    const id = componentId.current;
    ResourceManager.register(id, () => {
      // Cleanup any preview URLs
      if (formState.previewImage) {
        cleanupPreviewUrl(formState.previewImage);
      }
    });

    return () => {
      ResourceManager.cleanup(id);
    };
  }, [formState.previewImage, cleanupPreviewUrl]);

  // Memoized cancel handler with performance optimization
  const handleCancel = useCallback(() => {
    if (formState.isLoading) {
      return; // Prevent cancel during loading
    }

    // Batch cleanup operations for better performance
    performanceUtils.batchUpdates([
      () => {
        // Clean up preview URL if it exists
        if (formState.previewImage) {
          cleanupPreviewUrl(formState.previewImage);
        }
      },
      () => {
        // Reset file input
        resetFileInput();
      },
      () => {
        // Reset form to initial state
        dispatch({ type: 'RESET_FORM', payload: initialData });
      },
      () => {
        // Close modal
        onClose();
      },
    ]);
  }, [
    formState.isLoading,
    formState.previewImage,
    cleanupPreviewUrl,
    resetFileInput,
    dispatch,
    initialData,
    onClose,
  ]);

  // Memoized form reset handler
  const handleFormReset = useCallback(() => {
    // Batch reset operations for better performance
    performanceUtils.batchUpdates([
      () => {
        // Clean up preview URL if it exists
        if (formState.previewImage) {
          cleanupPreviewUrl(formState.previewImage);
        }
      },
      () => {
        // Reset file input
        resetFileInput();
      },
      () => {
        // Reset form to initial state
        dispatch({ type: 'RESET_FORM', payload: initialData });
      },
    ]);
  }, [
    formState.previewImage,
    cleanupPreviewUrl,
    resetFileInput,
    dispatch,
    initialData,
  ]);

  // Memoized file select handler with performance optimization
  const handleFileSelect = useCallback((file: File, previewUrl: string) => {
    // Batch file selection operations for better performance
    performanceUtils.batchUpdates([
      () => dispatch({ type: 'SET_SELECTED_FILE', payload: file }),
      () => dispatch({ type: 'SET_PREVIEW_IMAGE', payload: previewUrl }),
      () => dispatch({ type: 'SET_PROFILE_IMAGE_KEY', payload: null }),
    ]);
  }, [dispatch]);

  // Debounced name change handler for better performance
  const handleNameChange = useDebouncedCallback((value: string) => {
    // Only dispatch if value actually changed
    if (value !== formState.name) {
      dispatch({ type: 'SET_NAME', payload: value });
    }
  }, 300);

  // Debounced bio change handler for better performance
  const handleBioChange = useDebouncedCallback((value: string) => {
    // Only dispatch if value actually changed
    if (value !== formState.bio) {
      dispatch({ type: 'SET_BIO', payload: value });
    }
  }, 300);

  return {
    handleCancel,
    handleFormReset,
    handleFileSelect,
    handleNameChange,
    handleBioChange,
  };
}; 