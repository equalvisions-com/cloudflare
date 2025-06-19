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
  defaultProfileGradientUri?: string;
}

// --- We'll use Server Components differently --- 
// Don't directly import server components in client components
// Instead we'll use them in the layout structure
// Delete this line:
// import VerifyOnboardingStatus from '@/app/onboarding/verification';

// --- Update the Client Component --- 

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// Keep useAction for the *Convex* action
import { useAction, useQuery, useMutation } from 'convex/react'; 
import { api } from '@/convex/_generated/api'; // Keep this for Convex hooks
import { Id } from '@/convex/_generated/dataModel';
// Update import to use the new atomic action
import { atomicFinalizeOnboarding } from './actions';
// Remove the unused direct cookie setting import
// import { setCookie } from 'cookies-next';
import { cn } from '@/lib/utils'; // Added cn import

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

// Props interface for our new FeaturedPostItem component
interface FeaturedPostItemProps {
  post: {
    _id: Id<"posts">;
    title: string;
    body: string;
    featuredImg?: string | null;
    feedUrl: string;
  };
  followedPosts: string[];
  handleFollowToggle: (postId: Id<"posts">, feedUrl: string, postTitle: string) => void;
}

// New FeaturedPostItem component with dynamic line-clamp logic
const FeaturedPostItem: React.FC<FeaturedPostItemProps> = ({ post, followedPosts, handleFollowToggle }) => {
  const [descriptionLines, setDescriptionLines] = useState(2);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkTitleHeight = useCallback(() => {
    if (!isMountedRef.current || !titleRef.current) return;

    const styles = window.getComputedStyle(titleRef.current);
    const lineHeight = styles.lineHeight;
    const titleHeight = titleRef.current.offsetHeight;
    const fontSize = parseInt(styles.fontSize, 10);
    
    // Calculate approximate number of lines
    const effectiveLineHeight = (lineHeight === 'normal' || !lineHeight) ? fontSize * 1.2 : parseInt(lineHeight, 10);
    
    if (isNaN(effectiveLineHeight) || effectiveLineHeight === 0) {
      setDescriptionLines(2); // Default if calculation fails
      return;
    }
    const numberOfLines = Math.round(titleHeight / effectiveLineHeight);
    
    setDescriptionLines(numberOfLines === 1 ? 3 : 2);
  }, []); // fontSize is derived, not a prop or state from outside

  useEffect(() => {
    checkTitleHeight(); // Run on mount and when dependencies change
    window.addEventListener('resize', checkTitleHeight);
    return () => {
      window.removeEventListener('resize', checkTitleHeight);
    };
  }, [checkTitleHeight, post.title, followedPosts]); // Added post.title and followedPosts

  return (
    <Card key={post._id} className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-b-1 border-t-0 rounded-none">
      <CardContent className="pl-4 pt-4 pb-4 pr-5 h-[116px]">
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
            <div className="flex justify-between items-start gap-2 mt-[-4px] mb-[5px]">
              <h3 ref={titleRef} className="text-base font-bold leading-tight line-clamp-2 mt-[2px]">
                {post.title}
              </h3>
              <Button
                variant={followedPosts.includes(post._id) ? "default" : "outline"}
                size="sm"
                onClick={() => handleFollowToggle(post._id, post.feedUrl, post.title)}
                className="px-2 h-[23px] text-xs flex-shrink-0 font-semibold gap-1"
              >
                {followedPosts.includes(post._id) ? (
                  <>
                    <Check className="h-3 w-3 mr-0" /> Following
                  </>
                ) : (
                  'Follow'
                )}
              </Button>
            </div>
            <p className={cn(
              "text-sm text-muted-foreground !mt-[3px]",
              descriptionLines === 3 ? "line-clamp-3" : "line-clamp-2"
            )}>
              {post.body.replace(/<[^>]*>|&[^;]+;/g, '').trim()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

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
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameInputFocused, setIsUsernameInputFocused] = useState(false);
  const debouncedUsername = useDebounce(username, 500);

  const usernameForQuery = useMemo(() => {
    if (!username.trim()) return "skip";
    if (username.length < 3) return "skip";
    if (username.length > 15) return "skip";
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return "skip";
    
    if (!debouncedUsername || username !== debouncedUsername) {
      return "skip";
    }
    return { username: debouncedUsername };
  }, [username, debouncedUsername]);

  const checkUsernameAvailabilityResult = useQuery(api.users.checkUsernameAvailability, usernameForQuery);

  useEffect(() => {
    let determinedError: string | null = null;
    const rawUsername = username.trim();

    // --- Step 1: Determine Error State ---
    if (!rawUsername) { // If username is empty (after trimming)
      determinedError = null;
    } else { // Username is not empty
      if (!/^[a-zA-Z0-9_]+$/.test(username)) { // Check original username for disallowed characters FIRST
        determinedError = "Username can only contain letters, numbers, and underscores";
      } else if (!/[a-zA-Z0-9]/.test(username)) { // NEW: Check if username contains at least one letter or number
        determinedError = "Username must contain at least one letter or number";
      } else if (rawUsername.length < 3) { // Then check length constraints on the trimmed version
        determinedError = "Username must be at least 3 characters";
      } else if (rawUsername.length > 15) {
        determinedError = "Username cannot exceed 15 characters";
      } else {
        // Username is client-side valid (correct chars, contains letter/number, length 3-15).
        // Now consider server validation, but only if username is stable (debounced).
        if (username === debouncedUsername) { 
          if (usernameForQuery !== "skip") { // A query should be active for a stable, client-valid username
            if (checkUsernameAvailabilityResult === undefined) {
              // Server check is pending for the stable, client-side valid username.
              determinedError = null; // No error yet from server
            } else if (checkUsernameAvailabilityResult !== null && !checkUsernameAvailabilityResult.available) {
              // Server says username is taken.
              determinedError = checkUsernameAvailabilityResult.message || "Username already taken";
            } else {
              // Server says available, or result is null (which we treat as available or no issue)
              determinedError = null;
            }
          } else {
            // Username is stable, client-side valid, but usernameForQuery is "skip".
            // This is unlikely if rawUsername passed all prior client checks here.
            // It might mean debouncedUsername became empty or failed a useMemo check.
            // In this state, assume no error from server side if query is skipped.
            determinedError = null;
          }
        } else {
          // Username is client-side valid, but user is still typing (username !== debouncedUsername).
          // No error to show yet from server. Spinner will be active.
          determinedError = null;
        }
      }
    }

    setUsernameError(determinedError);

    // --- Step 2: Determine Spinner State (isCheckingUsername) ---
    let showSpinner = false;
    // Only consider showing spinner if there's no active error message
    if (determinedError === null) { 
      // And only if there's some input
      if (rawUsername.length > 0) { 
        if (username !== debouncedUsername) {
          // User is actively typing a non-empty username that currently has no error
          showSpinner = true;
        } else {
          // Username is stable (username === debouncedUsername).
          // Show spinner ONLY if it's client-side valid and a server query is pending.
          if (rawUsername.length >= 3 && 
              rawUsername.length <= 15 && 
              /^[a-zA-Z0-9_]+$/.test(rawUsername)) { // Client-side valid
            if (usernameForQuery !== "skip" && checkUsernameAvailabilityResult === undefined) {
              showSpinner = true; // Query is pending for a valid, stable username
            }
          }
        }
      }
    }
    setIsCheckingUsername(showSpinner);

  }, [username, debouncedUsername, usernameForQuery, checkUsernameAvailabilityResult]);

  // Generate the default gradient data URL once using useMemo
  const defaultGradientDataUrl = useMemo(() => {
    const randomColor = () => Math.floor(Math.random() * 256);
    const svgString = 
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' shape-rendering='geometricPrecision'>
        <defs>
          <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
            <stop offset='0%' style='stop-color:rgb(${randomColor()},${randomColor()},${randomColor()})' />
            <stop offset='100%' style='stop-color:rgb(${randomColor()},${randomColor()},${randomColor()})' />
          </linearGradient>
        </defs>
        <circle cx='50' cy='50' r='50' fill='url(#g)'/>
      </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }, []); // Empty dependency array ensures this runs only once

  // Fetch featured posts for the follow step
  const featuredPosts = useQuery(api.featured.getFeaturedPosts);
  
  // Hooks for necessary API calls
  const getProfileImageUploadUrl = useAction(api.users.getProfileImageUploadUrl);
  const followPost = useMutation(api.following.follow);
  const unfollowPost = useMutation(api.following.unfollow);

  // Number of posts required to follow
  const REQUIRED_FOLLOWS = 3;
  
  // Custom hook for debouncing
  function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);
    return debouncedValue;
  }

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
    
    if (usernameError) {
      setIsSubmitting(false);
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
        profileImageKey: finalProfileImageKey || undefined,
        defaultProfileGradientUri: !finalProfileImageKey ? defaultGradientDataUrl : undefined
      });
      
      // Move to the follow step
      setCurrentStep('follow');
      setIsSubmitting(false);
      
    } catch (error) {
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
      // Error handled silently for production
    }
  };

  const finalizeOnboarding = async () => {
    if (!profileData) {
      return;
    }

    if (followedPosts.length < REQUIRED_FOLLOWS) {
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
        // If there's a redirect URL in case of auth errors, use it
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
          return;
        }
      } else {
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
      // For any unhandled errors, redirect to signin after a short delay
      setTimeout(() => {
        router.push('/signin');
      }, 1500); // Show the error message briefly before redirecting
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full my-auto mx-auto px-4 md:px-0">
      <div className="w-full max-w-[400px] mx-auto flex flex-col my-auto gap-4 pb-[64px] md:pb-0">
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold leading-none tracking-tight mb-2">
            {currentStep === 'profile' ? 'Create Account' : 'Suggested Follows'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentStep === 'profile' 
              ? 'Set up your profile to get started' 
              : 'Personalize your feed with creators'}
          </p>
        </div>
        
        {currentStep === 'profile' ? (
          <form onSubmit={handleProfileSubmit} className="flex w-full flex-col space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  id="profileImageUpload"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-20 h-20 rounded-full overflow-hidden">
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
                      src={defaultGradientDataUrl}
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
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  autoComplete="off"
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/\s/g, ''));
                  }}
                  onFocus={() => setIsUsernameInputFocused(true)}
                  onBlur={() => setIsUsernameInputFocused(false)}
                  placeholder="Choose a username"
                  className={cn(
                    usernameError ? 'border-red-500' : '',
                    'shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0'
                  )}
                  disabled={isSubmitting || isUploading}
                  maxLength={15}
                />
                {isCheckingUsername && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {isUsernameInputFocused && (
                <p className="text-sm mt-1 h-4">
                  {usernameError ? (
                    <span className="text-red-500 text-xs">{usernameError}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Username can only contain letters, numbers, and underscores</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
                className="shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                maxLength={60}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">About</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us a bit about yourself"
                className="h-24 resize-none shadow-none bg-secondary/50 border-text-muted-foreground/90 text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                maxLength={250}
              />
            </div>
            
            <Button
              type="submit"
              className="w-full !mt-6"
              disabled={
                isSubmitting || 
                isUploading || 
                !username.trim() || 
                (username.trim().length > 0 && username.trim().length < 3 && username !== debouncedUsername) || 
                isCheckingUsername || 
                !!usernameError
              }
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
            </div>
            
            {featuredPosts ? (
              <ScrollArea type="always" className="h-[50vh] rounded-md border">
                <div className="space-y-0">
                  {featuredPosts.map((post) => (
                    <FeaturedPostItem
                      key={post._id}
                      post={post}
                      followedPosts={followedPosts}
                      handleFollowToggle={handleFollowToggle}
                    />
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
                disabled={
                  followedPosts.length < REQUIRED_FOLLOWS || 
                  isSubmitting || 
                  !!usernameError ||
                  isCheckingUsername
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-0 h-4 w-4 animate-spin" />
                    Finishing
                  </>
                ) : (
                  'Finish'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
