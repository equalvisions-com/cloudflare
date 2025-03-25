'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { Id } from '@/convex/_generated/dataModel';
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRSSKey } from '@/lib/rss';

// Define step types for onboarding
type OnboardingStep = 'profile' | 'follow';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('profile');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profileImageKey, setProfileImageKey] = useState<string | null>(null);
  const [followedPosts, setFollowedPosts] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch featured posts for the follow step
  const featuredPosts = useQuery(api.featured.getFeaturedPosts);
  
  // Mutations
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const getProfileImageUploadUrl = useAction(api.users.getProfileImageUploadUrl);
  const followPost = useMutation(api.following.follow);
  const unfollowPost = useMutation(api.following.unfollow);

  // Number of posts required to follow
  const REQUIRED_FOLLOWS = 3;
  
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

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (username.trim().length < 1) {
      toast({
        title: "Invalid username",
        description: "Username cannot be empty",
        variant: "destructive",
      });
      return;
    }

    // Check for special characters
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast({
        title: "Invalid username",
        description: "Username can only contain letters, numbers, and underscores (_)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Handle image upload if there's a selected file
      let finalProfileImageKey = null;
      
      if (selectedFile) {
        setIsUploading(true);
        
        try {
          // Get a presigned URL to upload the file
          const uploadData = await getProfileImageUploadUrl();
          
          // Extract the URL properly from the response
          let uploadUrl = '';
          if (typeof uploadData.url === 'string') {
            uploadUrl = uploadData.url;
          } else if (uploadData.url && typeof uploadData.url === 'object') {
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
          
          finalProfileImageKey = uploadData.key;
        } catch (error) {
          console.error("Failed to upload image:", error);
          toast({
            title: "Image upload failed",
            description: error instanceof Error ? error.message : "Failed to upload profile image",
            variant: "destructive",
          });
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Store profile data for later submission
      setProfileData({
        username: username.trim(),
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        profileImageKey: finalProfileImageKey || undefined
      });
      
      // Move to the follow step
      setCurrentStep('follow');
      setIsSubmitting(false);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      
      if (error instanceof Error) {
        if (error.message.includes("Username already taken")) {
          toast({
            title: "Username not available",
            description: "This username is already taken. Please choose another one.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Could not save profile",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Could not save profile",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
      setIsSubmitting(false);
    }
  };

  const handleFollowToggle = async (postId: Id<"posts">, feedUrl: string, postTitle: string) => {
    try {
      if (followedPosts.includes(postId)) {
        // Unfollow the post
        await unfollowPost({
          postId,
          rssKey: formatRSSKey(postTitle),
        });
        setFollowedPosts(followedPosts.filter(id => id !== postId));
      } else {
        // Follow the post
        await followPost({
          postId,
          feedUrl,
          rssKey: formatRSSKey(postTitle),
        });
        setFollowedPosts([...followedPosts, postId]);
      }
    } catch (error) {
      console.error("Failed to toggle follow:", error);
      toast({
        title: "Action failed",
        description: "Could not follow or unfollow this post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const finalizeOnboarding = async () => {
    if (!profileData) {
      toast({
        title: "Error",
        description: "Profile data is missing. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (followedPosts.length < REQUIRED_FOLLOWS) {
      toast({
        title: "Follow more posts",
        description: `Please follow at least ${REQUIRED_FOLLOWS} posts to continue.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Complete onboarding with profile data
      await completeOnboarding(profileData);
      
      // Show success message
      toast({
        title: "Profile completed",
        description: "Welcome to Grasper!",
        variant: "default",
      });
      
      // Clean up any object URLs we created
      if (previewImage && previewImage.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage);
      }
      
      // Redirect to home page after successful onboarding
      router.push('/');
      router.refresh(); // Refresh to update auth state
    } catch (error) {
      console.error('Error completing onboarding:', error);
      
      toast({
        title: "Could not complete onboarding",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full container my-auto mx-auto">
      <div className="w-full max-w-[600px] mx-auto flex flex-col my-auto gap-4 pb-8">
        <div className="space-y-1 mb-2">
          <h2 className="font-semibold text-2xl tracking-tight">
            {currentStep === 'profile' ? 'Complete your profile' : 'Follow featured posts'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentStep === 'profile' 
              ? 'Set up your profile to get started' 
              : 'Follow posts that interest you to personalize your feed'}
          </p>
        </div>
        
        {currentStep === 'profile' ? (
          <form onSubmit={handleProfileSubmit} className="flex w-full flex-col space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-4 mb-2">
                <Input
                  type="file"
                  id="profileImageUpload"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-20 h-20 border rounded-full overflow-hidden border">
                  {previewImage ? (
                    <img 
                      src={previewImage} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src="data:image/svg+xml;utf8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%20100%20100%27%3E%3Ccircle%20cx=%2750%27%20cy=%2750%27%20r=%2750%27%20fill=%27%23E1E8ED%27/%3E%3Ccircle%20cx=%2750%27%20cy=%2740%27%20r=%2712%27%20fill=%27%23FFF%27/%3E%3Cpath%20fill=%27%23FFF%27%20d=%27M35,70c0-8.3%208.4-15%2015-15s15,6.7%2015,15v5H35V70z%27/%3E%3C/svg%3E"
                      alt="Default Profile"
                      className="w-full h-full"
                    />
                  )}
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Select Image
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                minLength={1}
                pattern="[a-zA-Z0-9_]+"
              />
              <p className="text-xs text-muted-foreground">
                Username can only contain letters, numbers, and underscores
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">About</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Your bio"
                className="h-24 resize-none"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center space-y-2 mb-4">
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all" 
                  style={{ width: `${Math.min(100, (followedPosts.length / REQUIRED_FOLLOWS) * 100)}%` }}
                ></div>
              </div>
              <p className="text-sm font-medium">
                {followedPosts.length >= REQUIRED_FOLLOWS 
                  ? "You're ready to complete onboarding!" 
                  : `Follow ${REQUIRED_FOLLOWS - followedPosts.length} more post${REQUIRED_FOLLOWS - followedPosts.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Featured Posts</h3>
              <span className="text-sm text-muted-foreground">{followedPosts.length}/{REQUIRED_FOLLOWS} followed</span>
            </div>
            
            {featuredPosts ? (
              <ScrollArea className="h-[50vh] pr-4 rounded-md border">
                <div className="space-y-0">
                  {featuredPosts.map((post) => (
                    <Card key={post._id} className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-1 border-r-1 border-t-0 border-b-1 rounded-none">
                      <CardContent className="p-4 h-[116px]">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-[82px] h-[82px]">
                            <AspectRatio ratio={1/1} className="overflow-hidden rounded-md">
                              {post.featuredImg ? (
                                <Image
                                  src={post.featuredImg}
                                  alt={post.title}
                                  fill
                                  sizes="82px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <p className="text-muted-foreground text-xs">No image</p>
                                </div>
                              )}
                            </AspectRatio>
                          </div>
                          <div className="flex-1 min-w-0 space-y-2 pt-0">
                            <div className="flex justify-between items-start gap-4 mt-[-4px]">
                              <h3 className="text-lg font-semibold leading-tight line-clamp-2 mt-[2px]">{post.title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 !mt-[3px]">
                              {post.body.replace(/<[^>]*>|&[^;]+;/g, '').trim()}
                            </p>
                            <Button
                              variant={followedPosts.includes(post._id) ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleFollowToggle(post._id, post.feedUrl, post.title)}
                              className="px-2 h-[23px] text-xs"
                            >
                              {followedPosts.includes(post._id) ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" /> Following
                                </>
                              ) : (
                                'Follow'
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="flex justify-between mt-8">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('profile')}
              >
                Back
              </Button>
              <Button
                onClick={finalizeOnboarding}
                disabled={followedPosts.length < REQUIRED_FOLLOWS || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  'Complete Onboarding'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
