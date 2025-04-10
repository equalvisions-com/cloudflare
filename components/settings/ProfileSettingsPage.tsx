"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, Upload, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useToast } from "@/components/ui/use-toast";

export function ProfileSettingsPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { toast } = useToast();
  // Get the current user's profile
  const userProfile = useQuery(api.users.getProfile, {});
  
  // Form state
  const [name, setName] = useState(userProfile?.name || "");
  const [bio, setBio] = useState(userProfile?.bio || "");
  const [previewImage, setPreviewImage] = useState<string | null>(userProfile?.profileImage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [profileImageKey, setProfileImageKey] = useState<string | null>(null);
  
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Hold the selected file for upload on save
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the update profile mutation
  const updateProfile = useMutation(api.users.updateProfile);
  
  // Get the delete account mutation
  const deleteAccount = useMutation(api.users.deleteAccount);
  
  // Get R2 upload action
  const getProfileImageUploadUrl = useAction(api.users.getProfileImageUploadUrl);
  
  // Update form state when user profile data changes
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || "");
      setBio(userProfile.bio || "");
      setPreviewImage(userProfile.profileImage || null);
    }
  }, [userProfile]);

  // Handle account deletion
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // First delete the account from the database
      await deleteAccount();
      
      // Then sign out to clear auth cookies/JWT tokens
      await signOut();
      
      // Show success toast
      toast({
        title: "Account deleted",
        description: "Your account has been successfully deleted. You will be redirected to the home page.",
        duration: 5000
      });
      
      // After successful deletion, redirect to home page
      router.push("/");
    } catch (error) {
      console.error("Failed to delete account:", error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      
      // Show error toast
      toast({
        title: "Error",
        description: "Failed to delete your account. Please try again later.",
        variant: "destructive",
        duration: 5000
      });
    }
  };

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

  // Handle reset
  const handleReset = () => {
    // Clean up any object URLs we created to avoid memory leaks
    if (selectedFile && previewImage && previewImage.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Reset to initial state from user profile
    if (userProfile) {
      setName(userProfile.name || "");
      setBio(userProfile.bio || "");
      setPreviewImage(userProfile.profileImage || null);
    }
    setSelectedFile(null);
    setProfileImageKey(null);
  };

  // Show loading state while fetching initial profile data
  if (userProfile === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Profile Settings</CardTitle>
          <CardDescription>Please wait while we load your profile information.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your personal profile information.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid grid-cols-4 items-start gap-4">
                <div className="text-sm font-medium pt-2">Profile Image</div>
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
                <div className="text-sm font-medium">Name</div>
                <div className="col-span-3">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <div className="text-sm font-medium pt-2">Bio</div>
                <div className="col-span-3">
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell others about yourself"
                    rows={4}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleReset} 
              disabled={isLoading}
            >
              Reset
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
          </CardFooter>
        </form>
      </Card>

      {/* Delete Account Section */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This action is irreversible. Once you delete your account, all of your data will be permanently removed from our servers. This includes your profile, activity history, bookmarks, and any other associated data.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="flex gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting Account...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Delete Account
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-3">
                This action cannot be undone. This will permanently delete your account and remove all of your data from our servers.
              </p>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md mb-3">
                <strong>The following data will be deleted:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Your profile information (name, bio, profile picture)</li>
                  <li>Your bookmarks and likes</li>
                  <li>Your comments</li>
                  <li>Your friend connections</li>
                  <li>Your following data</li>
                </ul>
              </div>
              <p>After deletion, you will be signed out and redirected to the home page.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Yes, delete my account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 