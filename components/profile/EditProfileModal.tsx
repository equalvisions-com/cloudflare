"use client";

import { useState, useRef, useEffect } from "react";
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
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, Upload } from "lucide-react";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: Id<"users">; // The user ID is passed from parent but used by Convex auth context internally
  initialData: {
    name?: string | null;
    bio?: string | null;
    profileImage?: string | null;
    username?: string;
  };
}

export function EditProfileModal({ 
  isOpen, 
  onClose, 
  userId,
  initialData 
}: EditProfileModalProps) {
  // Form state
  const [name, setName] = useState(initialData.name || "");
  const [bio, setBio] = useState(initialData.bio || "");
  const [previewImage, setPreviewImage] = useState<string | null>(initialData.profileImage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [profileImageKey, setProfileImageKey] = useState<string | null>(null);
  
  // Hold the selected file for upload on save
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the update profile mutation
  const updateProfile = useMutation(api.profiles.updateProfile);
  
  // Get R2 upload action
  const getProfileImageUploadUrl = useAction(api.profiles.getProfileImageUploadUrl);
  
  // Reset preview image when initialData changes
  useEffect(() => {
    setPreviewImage(initialData.profileImage || null);
  }, [initialData.profileImage]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check if we need to upload a file
      let finalProfileImageKey = profileImageKey;
      
      if (selectedFile) {
        setIsUploading(true);
        
        // Now upload the file to R2
        try {
          // Get a presigned URL to upload the file
          const uploadData = await getProfileImageUploadUrl();
          
          // Extract the URL properly from the response
          let uploadUrl = '';
          if (typeof uploadData.url === 'string') {
            uploadUrl = uploadData.url;
          } else if (uploadData.url && typeof uploadData.url === 'object') {
            // Try to get the url property from the object
            uploadUrl = uploadData.url.url || uploadData.url.toString();
          } else {
            throw new Error('Invalid URL format returned from server');
          }
          
          // Upload the file directly to R2
          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            body: selectedFile,
            headers: {
              "Content-Type": selectedFile.type,
              "Content-Length": String(selectedFile.size)
            },
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }
          
          // Use the new key for the profile update
          finalProfileImageKey = uploadData.key;
        } catch (error) {
          console.error("Failed to upload image:", error);
          alert("Failed to upload image: " + (error instanceof Error ? error.message : String(error)));
          setIsLoading(false);
          setIsUploading(false);
          return; // Stop the submission if upload failed
        } finally {
          setIsUploading(false);
        }
      }
      
      // Now update the profile with the new details and possibly new image key
      await updateProfile({
        name: name || null,
        bio: bio || null,
        profileImage: null, // We're only using R2 now
        profileImageKey: finalProfileImageKey,
      });
      
      // Clear the file selection
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      onClose();
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle file selection (only preview, don't upload yet)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Store the file for later upload
    setSelectedFile(file);
    
    // Create a local preview URL
    const imageUrl = URL.createObjectURL(file);
    setPreviewImage(imageUrl);
    
    // Clear any previous R2 key since we'll get a new one when we upload
    setProfileImageKey(null);
  };

  // Handle cancel with cleanup
  const handleCancel = () => {
    // Clean up any object URLs we created to avoid memory leaks
    if (selectedFile && previewImage && previewImage.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Reset to initial state
    setPreviewImage(initialData.profileImage || null);
    setSelectedFile(null);
    setProfileImageKey(null);
    
    // Close the modal
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-start gap-4">
              <div className="text-right pt-2">Profile Image</div>
              <div className="col-span-3">
                <div className="flex items-center gap-4 mb-2">
                  <Input
                    type="file"
                    id="profileImageUpload"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {previewImage && (
                    <div className="w-16 h-16 rounded-full overflow-hidden border">
                      <img 
                        src={previewImage} 
                        alt="Profile preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="flex gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Select Image
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload an image for your profile. Files will be uploaded when you save.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right">Name</div>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="Your display name"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <div className="text-right pt-2">Bio</div>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="col-span-3"
                placeholder="Tell others about yourself"
                rows={3}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
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
}

// Default export for dynamic import
export default EditProfileModal; 