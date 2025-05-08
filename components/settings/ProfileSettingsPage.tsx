"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, Upload, AlertTriangle } from "lucide-react";
import { ThemeToggleWithErrorBoundary } from "@/components/user-menu/ThemeToggle";
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
import { Doc } from "@/convex/_generated/dataModel";
import { Id } from "@/convex/_generated/dataModel";
import Image from 'next/image';

// Define props type for ProfileSettingsPage
type ProfileSettingsPageProps = {
  userProfile: {
    userId: Id<"users">;
    username: string;
    name: string | undefined;
    bio: string | undefined;
    profileImage: string | undefined;
    rssKeys: string[];
    isBoarded: boolean;
  } | null;
};

export function ProfileSettingsPage({ userProfile }: ProfileSettingsPageProps) {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { toast } = useToast();
  
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

  // No need for loading check here - handled by wrapper component

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-bold">Profile Settings</CardTitle>
          <CardDescription>
            Update your personal profile information
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-4">
            <div className="grid gap-4">
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
                      className="hidden shadow-none"
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
                      className="flex gap-2 shadow-none"
                    >
                      <Upload className="h-4 w-4" />
                      Select Image
                    </Button>
                  </div>
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
                    className="shadow-none"
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
                    className="shadow-none"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading} className="shadow-none">
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

      {/* Theme Settings */}
      <Card className="shadow-none">
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-bold">Theme Settings</CardTitle>
          <CardDescription>
            Customize the appearance of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="text-sm font-medium">Color Mode</div>
            <div className="col-span-3 flex items-start">
              <ThemeToggleWithErrorBoundary />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Section */}
      <Card className="shadow-none">
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-bold">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            This action is irreversible. Once you delete your account, all of your data will be permanently removed from our servers. This includes your profile, activity history, bookmarks, and any other associated data.
          </p>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="flex gap-2 shadow-none"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting Account...
              </>
            ) : (
              "Delete Account"
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
            <AlertDialogCancel disabled={isDeleting} className="shadow-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-none"
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