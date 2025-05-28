"use client";

import { useRouter } from 'next/navigation';
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
import Image from 'next/image';
import { useToast } from "@/components/ui/use-toast";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: Id<"users">; // The user ID is passed from parent but used by Convex auth context internally
  initialData: {
    name?: string | null;
    bio?: string | null;
    profileImage?: string | null;
    username?: string;
    profileImageKey?: string | null; // Ensure this is part of initialData if needed for deletion logic
  };
}

export function EditProfileModal({ 
  isOpen, 
  onClose, 
  userId,
  initialData 
}: EditProfileModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  // Form state
  const [name, setName] = useState(initialData.name || "");
  const [bio, setBio] = useState(initialData.bio || "");
  const [previewImage, setPreviewImage] = useState<string | null>(initialData.profileImage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [profileImageKey, setProfileImageKey] = useState<string | null>(initialData.profileImageKey || null);
  
  // Hold the selected file for upload on save
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the update profile mutation
  const updateProfile = useMutation(api.users.updateProfile);
  
  // Get R2 upload action
  const getProfileImageUploadUrl = useAction(api.users.getProfileImageUploadUrl);
  
  // Reset form fields when initialData changes (e.g., modal is re-opened for a different user or data is refreshed)
  useEffect(() => {
    setName(initialData.name || "");
    setBio(initialData.bio || "");
    setPreviewImage(initialData.profileImage || null);
    setProfileImageKey(initialData.profileImageKey || null);
    setSelectedFile(null); // Clear any selected file from previous interaction
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
    }
  }, [initialData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let finalProfileImageKey = profileImageKey; // Start with current key (could be existing or null)

    try {
      if (selectedFile) {
        setIsUploading(true);
        try {
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
            method: "PUT",
            body: selectedFile,
            headers: {
              "Content-Type": selectedFile.type,
              "Content-Length": String(selectedFile.size)
            },
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`Image upload failed: ${uploadResponse.statusText || uploadResponse.status}`);
          }
          
          finalProfileImageKey = uploadData.key; // Use the new key from successful upload
        } catch (error) {
          console.error("Failed to upload image:", error);
          toast({
            title: "Image Upload Error",
            description: "Failed to upload image. Please try again later or contact support.",
            variant: "destructive"
          });
          setIsLoading(false); // Stop loading if upload fails
          setIsUploading(false);
          return; 
        } finally {
          setIsUploading(false);
        }
      }
      
      const updateData: {
        name: string | null;
        bio: string | null;
        profileImage: null;
        profileImageKey?: string;
      } = {
        name: name.trim() === "" ? null : name.trim(), // Send null if name is empty after trim
        bio: bio.trim() === "" ? null : bio.trim(),   // Send null if bio is empty after trim
        profileImage: null, // Deprecated, R2 key is used
      };
      
      // Only include profileImageKey if we actually have a new image
      if (finalProfileImageKey) {
        updateData.profileImageKey = finalProfileImageKey;
      }
      
      await updateProfile(updateData);
      
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      onClose();
      router.refresh(); // Refresh data on the current page
    } catch (error) {
      console.error("Failed to update profile:", error);
      
      // Handle specific error types with appropriate toast messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("Profile update limit exceeded")) {
        // Rate limit error - show specific toast
        toast({
          title: "Rate Limit Exceeded",
          description: "You can only change your profile 3 times per day. Try again later.",
        });
      } else {
        // Generic error - show general toast
        toast({
          title: "Profile Update Error", 
          description: "Failed to update profile. Please try again later or contact support.",
          variant: "destructive"
        });
      }
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
    // Don't allow cancel if currently loading/uploading
    if (isLoading) return;
    
    // Clean up any object URLs we created to avoid memory leaks
    if (selectedFile && previewImage && previewImage.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Reset to initial state
    setName(initialData.name || "");
    setBio(initialData.bio || "");
    setPreviewImage(initialData.profileImage || null);
    setSelectedFile(null);
    setProfileImageKey(initialData.profileImageKey || null);
    
    // Close the modal
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          handleCancel();
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
                      <Image 
                        src={previewImage} 
                        alt="Profile preview" 
                        width={64} 
                        height={64} 
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
                maxLength={60}
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
                maxLength={250}
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