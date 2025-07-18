"use client";

import React, { useEffect, useReducer, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, Upload, AlertCircle } from "lucide-react";
import Image from 'next/image';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProfileImageUpload } from "@/hooks/useProfileImageUpload";
import { useProfileFormSubmission } from "@/hooks/useProfileFormSubmission";
import { useProfileFormManagement } from "@/hooks/useProfileFormManagement";
import { 
  useFormValidation, 
  useDebouncedCallback,
  ResourceManager,
  performanceUtils 
} from "@/lib/utils/profilePerformance";
import type { 
  ProfileFormState, 
  ProfileFormInitialData, 
  ProfileFormAction 
} from "@/lib/types";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: Id<"users">; // The user ID is passed from parent but used by Convex auth context internally
  initialData: ProfileFormInitialData;
}

// Create initial state from props with memoization
const createInitialState = (initialData: ProfileFormInitialData): ProfileFormState => ({
  name: initialData.name || "",
  bio: initialData.bio || "",
  previewImage: initialData.profileImage || null,
  isLoading: false,
  isUploading: false,
  profileImageKey: initialData.profileImageKey || null,
  selectedFile: null,
});

// Reducer for profile form state management with performance optimization
const profileFormReducer = (state: ProfileFormState, action: ProfileFormAction): ProfileFormState => {
  switch (action.type) {
    case 'SET_NAME':
      return state.name === action.payload ? state : { ...state, name: action.payload };
    
    case 'SET_BIO':
      return state.bio === action.payload ? state : { ...state, bio: action.payload };
    
    case 'SET_PREVIEW_IMAGE':
      return state.previewImage === action.payload ? state : { ...state, previewImage: action.payload };
    
    case 'SET_SELECTED_FILE':
      return { ...state, selectedFile: action.payload };
    
    case 'SET_PROFILE_IMAGE_KEY':
      return state.profileImageKey === action.payload ? state : { ...state, profileImageKey: action.payload };
    
    case 'START_LOADING':
      return state.isLoading ? state : { ...state, isLoading: true };
    
    case 'STOP_LOADING':
      return !state.isLoading ? state : { ...state, isLoading: false };
    
    case 'START_UPLOADING':
      return state.isUploading ? state : { ...state, isUploading: true };
    
    case 'STOP_UPLOADING':
      return !state.isUploading ? state : { ...state, isUploading: false };
    
    case 'UPLOAD_SUCCESS':
      return {
        ...state,
        profileImageKey: action.payload.key,
        previewImage: action.payload.previewUrl,
        isUploading: false,
      };
    
    case 'RESET_FORM':
      return createInitialState(action.payload);
    
    case 'CLEAR_FILE_SELECTION':
      return {
        ...state,
        selectedFile: null,
        profileImageKey: state.profileImageKey, // Keep existing key if no new file
      };
    
    default:
      return state;
  }
};

// Memoized component for performance
export const EditProfileModal = React.memo(({ 
  isOpen, 
  onClose, 
  userId,
  initialData 
}: EditProfileModalProps) => {
  // Use reducer for consolidated state management
  const [formState, dispatch] = useReducer(profileFormReducer, createInitialState(initialData));
  const { name, bio, previewImage, isLoading, isUploading, profileImageKey, selectedFile } = formState;
  
  // Memoized validation with performance optimization
  const validation = useFormValidation(name, bio);
  
  // Immediate input handlers for best user experience
  // Note: We use immediate updates rather than debouncing for form inputs
  // because users expect immediate visual feedback when typing
  const handleNameInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    dispatch({ type: 'SET_NAME', payload: value });
  }, [dispatch]);
  
  const handleBioInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    dispatch({ type: 'SET_BIO', payload: value });
  }, [dispatch]);
  
  // Initialize image upload hook
  const imageUpload = useProfileImageUpload({
    onFileSelect: (file, previewUrl) => {
      performanceUtils.batchUpdates([
        () => dispatch({ type: 'SET_SELECTED_FILE', payload: file }),
        () => dispatch({ type: 'SET_PREVIEW_IMAGE', payload: previewUrl }),
        () => dispatch({ type: 'SET_PROFILE_IMAGE_KEY', payload: null }),
      ]);
    },
    onUploadStart: () => dispatch({ type: 'START_UPLOADING' }),
    onUploadSuccess: (key, previewUrl) => dispatch({ type: 'UPLOAD_SUCCESS', payload: { key, previewUrl } }),
    onUploadError: () => dispatch({ type: 'STOP_UPLOADING' }),
  });

  // Initialize form submission hook
  const formSubmission = useProfileFormSubmission({
    onSubmitStart: () => dispatch({ type: 'START_LOADING' }),
    onSubmitSuccess: () => {
      performanceUtils.batchUpdates([
        () => dispatch({ type: 'CLEAR_FILE_SELECTION' }),
        () => dispatch({ type: 'STOP_LOADING' }),
      ]);
    },
    onSubmitError: () => dispatch({ type: 'STOP_LOADING' }),
    onClose,
    uploadImageToR2: imageUpload.uploadImageToR2,
    resetFileInput: imageUpload.resetFileInput,
  });

  // Initialize form management hook
  const formManagement = useProfileFormManagement({
    formState,
    initialData,
    dispatch,
    onClose,
    resetFileInput: imageUpload.resetFileInput,
    cleanupPreviewUrl: imageUpload.cleanupPreviewUrl,
  });

  // Component ID for resource management
  const componentId = useMemo(() => `edit-profile-modal-${userId}-${Date.now()}`, [userId]);

  // Register cleanup on mount
  useEffect(() => {
    ResourceManager.register(componentId, () => {
      imageUpload.cleanupPreviewUrl(previewImage || '');
    });

    return () => {
      ResourceManager.cleanup(componentId);
    };
  }, [componentId, imageUpload.cleanupPreviewUrl, previewImage]);

  // Reset form fields when initialData changes (e.g., modal is re-opened for a different user or data is refreshed)
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET_FORM', payload: initialData });
      imageUpload.resetFileInput();
    }
  }, [initialData, isOpen, imageUpload.resetFileInput]);

  // Handle form submission - prevent default immediately, then debounce the actual submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Always prevent default immediately
    debouncedSubmit();
  };

  // Debounced submission logic
  const debouncedSubmit = useDebouncedCallback(async () => {
    await formSubmission.handleSubmit({
      name,
      bio,
      profileImageKey,
      selectedFile,
    });
  }, 500);

  // Memoized validation state
  const validationState = useMemo(() => ({
    nameValidation: validation.name,
    bioValidation: validation.bio,
    hasValidationErrors: validation.hasErrors,
  }), [validation]);

  // Memoized button states
  const buttonStates = useMemo(() => ({
    isSubmitDisabled: isLoading || isUploading || validationState.hasValidationErrors,
    isCancelDisabled: isLoading,
    isFileSelectDisabled: isLoading || isUploading,
  }), [isLoading, isUploading, validationState.hasValidationErrors]);

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          formManagement.handleCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Validation Error Alert */}
            {validationState.hasValidationErrors && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please fix the validation errors below before submitting.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-4 items-start gap-4">
              <div className="text-right pt-2">Profile Image</div>
              <div className="col-span-3">
                <div className="flex items-center gap-4 mb-2">
                  <Input
                    type="file"
                    id="profileImageUpload"
                    ref={imageUpload.fileInputRef}
                    accept="image/*"
                    onChange={imageUpload.handleFileChange}
                    className="hidden"
                  />
                  {previewImage && (
                    <div className="w-16 h-16 rounded-full overflow-hidden border">
                      <Image 
                        src={previewImage} 
                        alt="Profile preview" 
                        width={64} 
                        height={64} 
                        className="w-full h-full object-cover"
                        priority
                      />
                    </div>
                  )}
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => imageUpload.fileInputRef.current?.click()}
                    disabled={buttonStates.isFileSelectDisabled}
                    className="flex gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isUploading ? 'Uploading...' : 'Select Image'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload an image for your profile. Max 5MB. Supported formats: JPEG, PNG, WebP, GIF.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right">Name</div>
              <div className="col-span-3">
                <Input
                  id="name"
                  value={name}
                  onChange={handleNameInputChange}
                  className={`${validationState.nameValidation.isError ? 'border-red-500' : ''}`}
                  placeholder="Your display name"
                  maxLength={60}
                  disabled={isLoading}
                />
                {validationState.nameValidation.isError && (
                  <p className="text-xs text-red-500 mt-1">{validationState.nameValidation.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {validationState.nameValidation.length}/60 characters
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <div className="text-right pt-2">Bio</div>
              <div className="col-span-3">
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={handleBioInputChange}
                  className={`${validationState.bioValidation.isError ? 'border-red-500' : ''}`}
                  placeholder="Tell others about yourself"
                  rows={3}
                  disabled={isLoading}
                  maxLength={250}
                />
                {validationState.bioValidation.isError && (
                  <p className="text-xs text-red-500 mt-1">{validationState.bioValidation.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {validationState.bioValidation.length}/250 characters
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={formManagement.handleCancel} 
              disabled={buttonStates.isCancelDisabled}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={buttonStates.isSubmitDisabled}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

EditProfileModal.displayName = 'EditProfileModal'; 