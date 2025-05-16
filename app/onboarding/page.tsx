'use client';

// REMOVE "use server" directive
// "use server"; 

// REMOVE cookie import
// import { cookies } from 'next/headers';

// --- REMOVE Server Action Definition --- 
/*
export async function finalizeOnboardingCookieAction(): Promise<{ success: boolean; error?: string }> {
  "use server"; // Ensure this action runs on the server
  try {
    // Set the cookie server-side
    cookies().set('user_onboarded', 'true', {
      path: '/',
      httpOnly: true, // Recommended for security
      secure: process.env.NODE_ENV === 'production', // Recommended for security
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax', // Recommended
    });
    return { success: true };

  } catch (error: any) {
    console.error('Error in finalizeOnboardingCookieAction:', error);
    return { success: false, error: "Failed to set onboarding cookie" };
  }
}
*/

// Interface for profile data passed from client
interface FinalizeOnboardingArgs {
  username: string;
  name?: string;
  bio?: string;
  profileImageKey?: string;
}

// --- We'll use Server Components differently --- 
// Don't directly import server components in client components
// Instead we'll use them in the layout structure
// Delete this line:
// import VerifyOnboardingStatus from '@/app/onboarding/verification';

// --- Update the Client Component --- 

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Keep useAction for the *Convex* action
import { useAction, useQuery, useMutation } from 'convex/react'; 
import { api } from '@/convex/_generated/api'; // Keep this for Convex hooks
import { Id } from '@/convex/_generated/dataModel';
// Update import to use the new atomic action
import { atomicFinalizeOnboarding } from './actions';
// Remove the unused direct cookie setting import
// import { setCookie } from 'cookies-next';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRSSKey } from '@/lib/rss';
import { EdgeAuthWrapper } from "@/components/auth/EdgeAuthWrapper";

// Define step types for onboarding
type OnboardingStep = 'profile' | 'follow';

// Use default export for the client component
export default function OnboardingPage() {
  return (
    <EdgeAuthWrapper>
      <OnboardingPageContent />
    </EdgeAuthWrapper>
  );
}

function OnboardingPageContent() {
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
  const [profileData, setProfileData] = useState<FinalizeOnboardingArgs | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch featured posts for the follow step
  const featuredPosts = useQuery(api.featured.getFeaturedPosts);
  
  // Hooks for necessary API calls
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
      console.log("Invalid username: cannot be empty");
      return;
    }

    // Check for special characters
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      console.log("Invalid username: can only contain letters, numbers, and underscores");
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
          console.error("Image upload failed:", error instanceof Error ? error.message : "Failed to upload profile image");
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
          console.error("Username not available: This username is already taken. Please choose another one.");
        } else {
          console.error("Could not save profile:", error.message);
        }
      } else {
        console.error("Could not save profile: An unexpected error occurred. Please try again.");
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
      console.error("Action failed: Could not follow or unfollow this post. Please try again.");
    }
  };

  const finalizeOnboarding = async () => {
    if (!profileData) {
      console.error("Error: Profile data is missing. Please try again.");
      return;
    }

    if (followedPosts.length < REQUIRED_FOLLOWS) {
      console.error(`Follow more posts: Please follow at least ${REQUIRED_FOLLOWS} posts to continue.`);
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Add timeout for the server action to prevent indefinite hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Onboarding request timed out")), 10000)
      );

      // Define the return type for clarity
      type OnboardingResult = {
        success: boolean;
        error?: string;
        redirectUrl?: string;
        message?: string;
      };
      
      // Use the new atomic server action with timeout protection
      const result = await Promise.race([
        atomicFinalizeOnboarding(profileData),
        timeoutPromise
      ]) as OnboardingResult;
      
      if (!result.success) {
        console.error("Could not complete onboarding:", result.error || "An unexpected error occurred");
        
        // If there's a redirect URL in case of auth errors, use it
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
          return;
        }
      } else {
        console.log(result.message ? "Already Onboarded" : "Profile completed", 
                   result.message || "Welcome to Grasper!");
        
        // Clean up object URLs
        if (previewImage && previewImage.startsWith('blob:')) {
          URL.revokeObjectURL(previewImage);
        }
        
        // Use redirect URL from server action
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
          router.refresh();
        } else {
          // Fallback to default redirect
          router.push('/');
          router.refresh();
        }
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      console.error("Could not complete onboarding:", error instanceof Error ? error.message : "An unexpected error occurred");
      
      // For any unhandled errors, redirect to signin after a short delay
      setTimeout(() => {
        router.push('/signin');
      }, 1500); // Show the error message briefly before redirecting
    } finally {
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
                    <Image 
                      src={previewImage} 
                      alt="Profile preview" 
                      width={80} 
                      height={80} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image 
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(
                        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
                          <defs>
                            <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
                              <stop offset='0%' style='stop-color:rgb(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)})' />
                              <stop offset='100%' style='stop-color:rgb(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)})' />
                            </linearGradient>
                          </defs>
                          <circle cx='50' cy='50' r='50' fill='url(#g)'/>
                        </svg>`
                      )}`}
                      alt="Default Profile"
                      width={80}
                      height={80}
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
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" />
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
    </div>
  );
}
