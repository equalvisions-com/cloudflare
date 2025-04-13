'use client';

import { type Message as UIMessage, useChat } from 'ai/react';
import { useState, useRef, useEffect } from "react";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { MessageContent, MessageSchema } from '@/app/types/article';
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAudio } from '@/components/audio-player/AudioContext';
import {
  ArrowUp,
  Copy,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Podcast,
  Newspaper,
  SquarePen,
} from "lucide-react";
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { useSidebar } from '@/components/ui/sidebar-context';
import { BackButton } from '@/components/back-button';

// Simple typing indicator component with animated dots.
function TypingIndicator() {
  return (
    <div className="flex space-x-1">
      <div className="animate-bounce h-1.5 w-1.5 bg-muted-foreground rounded-full delay-0"></div>
      <div className="animate-bounce h-1.5 w-1.5 bg-muted-foreground rounded-full delay-150"></div>
      <div className="animate-bounce h-1.5 w-1.5 bg-muted-foreground rounded-full delay-300"></div>
    </div>
  );
}

// Helper function to truncate text
function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Types for enhanced UI features
type ActiveButton = "none" | "newsletters" | "podcasts" | "articles";

// Add a custom hook for handling touch events
function useTouchActiveState() {
  const [activeTouchButton, setActiveTouchButton] = useState<string | null>(null);

  const handleTouchStart = (buttonType: string) => {
    setActiveTouchButton(buttonType);
  };

  const handleTouchEnd = () => {
    setActiveTouchButton(null);
  };

  return {
    activeTouchButton,
    handleTouchStart,
    handleTouchEnd
  };
}

export function ChatPage() {
  // Get user profile data from context
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  
  // State for managing messages and input
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      // This callback is called when a response is received from the API
      if (response.status === 200) {
        // We're starting to receive a response, but content might still be streaming
        // Keep isStreaming true until content is fully received
        // The actual streamed content and tool results will be handled automatically by useChat
      }
    },
    onFinish: () => {
      // Called when the entire response is complete
      setIsStreaming(false);
    },
    body: {
      // Include the active button type in the request
      activeButton: 'newsletters' // This will be updated before submission
    }
  });

  // Audio player hook for podcast playback
  const { playTrack } = useAudio();
  
  // New state for enhanced UI features
  const [activeButton, setActiveButton] = useState<"none" | "newsletters" | "podcasts" | "articles">("newsletters");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  
  // Refs for DOM elements
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const selectionStateRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  
  // Additional state for input handling
  const [hasTyped, setHasTyped] = useState(false);

  // Add a new state to track if animation should run
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Add touch state handling
  const { activeTouchButton, handleTouchStart, handleTouchEnd } = useTouchActiveState();

  // Add a new state for tracking liked and disliked messages
  const [likedMessages, setLikedMessages] = useState<Record<string, boolean>>({});
  const [dislikedMessages, setDislikedMessages] = useState<Record<string, boolean>>({});

  // Safely attempt to vibrate if supported
  const safeVibrate = (pattern: number | number[]) => {
    try {
      if (typeof window !== 'undefined' && navigator?.vibrate) {
        navigator.vibrate(pattern);
      }
      // Silently fail if vibration is not supported
    } catch {
      // Ignore errors
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Additional scroll handler for carousel content load
  useEffect(() => {
    const handleCarouselLoad = () => {
      scrollToBottom();
    };

    // Add event listener for image load events within carousels
    const carouselItems = document.querySelectorAll('.embla__slide img');
    carouselItems.forEach(img => {
      img.addEventListener('load', handleCarouselLoad);
    });

    // Also handle MutationObserver to detect when carousel content is added
    const observer = new MutationObserver(() => {
      scrollToBottom();
    });

    if (chatContainerRef.current) {
      observer.observe(chatContainerRef.current, { 
        childList: true, 
        subtree: true 
      });
    }

    return () => {
      // Cleanup
      carouselItems.forEach(img => {
        img.removeEventListener('load', handleCarouselLoad);
      });
      observer.disconnect();
    };
  }, [messages]);

  // Save the current selection state
  const saveSelectionState = () => {
    if (textareaRef.current) {
      selectionStateRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  };

  // Restore selection state after toggling
  const restoreSelectionState = () => {
    if (textareaRef.current) {
      const { start, end } = selectionStateRef.current;
      if (start !== null && end !== null) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);
      }
    }
  };

  // Compute the ID of the last message in the conversation.
  useEffect(() => {
    if (messages.length > 0) {
      setLastMessageId(messages[messages.length - 1].id);
    }
  }, [messages]);

  // Move vibration setup into useEffect
  useEffect(() => {
    // Import vibration functionality only on client side
    import('ios-vibrator-pro-max').catch(() => {
      // Silently fail if import fails
      console.debug('Vibration not supported');
    });
  }, []);

  // Toggle action buttons with selection preservation
  const toggleButton = (buttonType: ActiveButton) => {
    if (!isStreaming) {
      // Add vibration feedback on mobile
      safeVibrate(50);

      // Save the current selection state before toggling
      saveSelectionState();

      // Set the active button (clicking the same button won't deactivate it)
      setActiveButton(buttonType);

      // Restore the selection state after toggling
      setTimeout(() => {
        restoreSelectionState();
      }, 0);
    }
  };

  // Handle input container click
  const handleInputContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only focus if clicking directly on the container, not on buttons or other interactive elements
    if (
      e.target === e.currentTarget ||
      (e.currentTarget === inputContainerRef.current && !(e.target as HTMLElement).closest("button"))
    ) {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Handle key down events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Cmd+Enter on both mobile and desktop
    if (!isStreaming && e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      if (input.trim()) {
        customHandleSubmit(new Event('submit'));
      }
      return;
    }

    // Handle regular Enter key (without Shift)
    if (!isStreaming && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        customHandleSubmit(new Event('submit'));
      }
    }
  };

  // Handle like/dislike actions
  const handleLike = (messageId: string) => {
    safeVibrate(50);
    setLikedMessages(prev => {
      const newState = { ...prev };
      newState[messageId] = !prev[messageId];
      return newState;
    });
    // Remove from disliked if it was there
    setDislikedMessages(prev => {
      const newState = { ...prev };
      if (newState[messageId]) {
        newState[messageId] = false;
      }
      return newState;
    });
  };

  const handleDislike = (messageId: string) => {
    safeVibrate(50);
    setDislikedMessages(prev => {
      const newState = { ...prev };
      newState[messageId] = !prev[messageId];
      return newState;
    });
    // Remove from liked if it was there
    setLikedMessages(prev => {
      const newState = { ...prev };
      if (newState[messageId]) {
        newState[messageId] = false;
      }
      return newState;
    });
  };

  // Custom message rendering function
  const renderMessage = (message: UIMessage) => {
    const isUser = message.role === 'user';
    let content: MessageContent | string;

    if (isUser) {
      content = message.content;
    } else {
      // Check if this is the most recent assistant message
      const isLatestAssistantMessage = message.id === lastMessageId;
      
      // Always show loading indicator for the latest assistant message if we're loading
      // This prevents any flash of content before tool results come in
      if (isLatestAssistantMessage && isLoading) {
        return (
          <div className="flex justify-start mb-4 w-full" key={message.id}>
            <div className="max-w-[80%] p-3 rounded-lg bg-muted text-muted-foreground">
              <TypingIndicator />
            </div>
          </div>
        );
      }
      
      // Check for tool invocations separately
      const hasToolInProgress = message.toolInvocations?.some(tool => 
        tool.state !== 'result'
      );
      
      // Hide content if tools are still running
      if (hasToolInProgress) {
        return (
          <div className="flex justify-start mb-4 w-full" key={message.id}>
            <div className="max-w-[80%] p-3 rounded-lg bg-muted text-muted-foreground">
              <TypingIndicator />
            </div>
          </div>
        );
      }

      // Parse the message content
      try {
        // Check for tool invocation results first (most reliable source)
        const toolInvocation = message.toolInvocations?.[0];
        if (toolInvocation?.state === 'result' && toolInvocation.result) {
          if (typeof toolInvocation.result === 'object' && 
              'message' in toolInvocation.result && 
              'articles' in toolInvocation.result) {
            content = toolInvocation.result;
          } else if (typeof toolInvocation.result === 'string') {
            try {
              const parsed = JSON.parse(toolInvocation.result);
              content = 'message' in parsed && 'articles' in parsed 
                ? parsed 
                : { message: String(toolInvocation.result), articles: [] };
            } catch {
              content = { message: String(toolInvocation.result), articles: [] };
            }
          } else {
            content = { message: 'Received response', articles: [] };
          }
        }
        // 2. Check message content
        else if (message.content) {
          if (typeof message.content === 'string') {
            try {
              const parsed = JSON.parse(message.content);
              content = 'message' in parsed && 'articles' in parsed 
                ? parsed 
                : { message: message.content, articles: [] };
            } catch {
              content = { message: message.content, articles: [] };
            }
          } else {
            content = { 
              message: typeof message.content === 'object' ? 'Received response' : String(message.content), 
              articles: [] 
            };
          }
        } 
        // 3. Check message parts as last resort
        else if (message.parts?.length) {
          const textPart = message.parts.find(part => part.type === 'text');
          if (textPart && 'text' in textPart) {
            try {
              const parsed = JSON.parse(textPart.text);
              content = 'message' in parsed && 'articles' in parsed 
                ? parsed 
                : { message: textPart.text, articles: [] };
            } catch {
              content = { message: textPart.text, articles: [] };
            }
          } else {
            content = { message: 'No readable content available', articles: [] };
          }
        } else {
          content = { message: 'No content available', articles: [] };
        }

        // Validate content against schema if it's an object
        if (typeof content === 'object' && content !== null) {
          try {
            content = MessageSchema.parse(content);
          } catch {
            // If validation fails, ensure we have a valid structure
            if (typeof content.message === 'string') {
              content = { 
                message: content.message, 
                articles: Array.isArray(content.articles) ? content.articles : [] 
              };
            } else {
              content = { message: 'Received response with invalid format', articles: [] };
            }
          }
        }
      } catch {
        // Final fallback if all parsing attempts fail
        content = { message: 'Unable to process response', articles: [] };
      }
    }

    // Message actions for non-user messages
    const messageActions = !isUser && (
      <div className="flex items-center gap-1 mt-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full hover:bg-muted"
          title="Like"
          onClick={() => handleLike(message.id)}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${likedMessages[message.id] ? 'fill-current text-primary' : 'text-muted-foreground'}`} />
          <span className="sr-only">Like</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full hover:bg-muted"
          title="Dislike"
          onClick={() => handleDislike(message.id)}
        >
          <ThumbsDown className={`h-3.5 w-3.5 ${dislikedMessages[message.id] ? 'fill-current text-primary' : 'text-muted-foreground'}`} />
          <span className="sr-only">Dislike</span>
        </Button>
      </div>
    );

    return (
      <div className="flex flex-col w-full mb-2" key={message.id}>
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
          {typeof content === 'string' ? (
            <div className={`max-w-[90%] p-2 rounded-lg ${isUser ? 'bg-[#007AFF] text-primary-foreground dark:text-primary' : 'bg-muted text-foreground'}`}>
              <p className="break-words whitespace-normal">{content}</p>
              {!isUser && messageActions}
            </div>
          ) : content.articles?.length > 0 ? (
            <div className="w-full">
              <p className="text-sm text-muted-foreground break-words whitespace-normal mb-2">{content.message}</p>
              <div className="w-full max-w-full">
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-2 md:-ml-4">
                    {content.articles.map((article, index) => (
                      <CarouselItem key={`${article.link}-${index}`} className="pl-2 md:pl-4 basis-[90%] sm:basis-[70%] md:basis-[70%] lg:basis-[70%]">
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          onClick={(e) => {
                            // Check if this is a podcast entry (based on activeButton)
                            if (activeButton === 'podcasts') {
                              e.preventDefault();
                              // Play the podcast in the audio player
                              playTrack(article.link, article.title, article.publisherIconUrl);
                            }
                          }}
                        >
                          <Card className="w-full bg-card hover:bg-muted/50 transition-colors shadow-none overflow-hidden">
                            <div className="flex">
                              {/* Image on the left in 1:1 aspect ratio */}
                              {article.photo_url ? (
                                <div className="flex-shrink-0 h-[88px] w-[88px] overflow-hidden rounded-l-lg">
                                  <AspectRatio ratio={1} className="h-full">
                                    <Image
                                      src={article.photo_url}
                                      alt={article.title || "Article image"}
                                      fill
                                      unoptimized
                                      className="object-cover"
                                      onError={(e) => {
                                        // If the photo_url fails to load, set the src to the publisher icon
                                        if (article.publisherIconUrl) {
                                          (e.target as HTMLImageElement).src = article.publisherIconUrl;
                                        } else {
                                          // If there's no publisher icon either, hide the image element
                                          (e.target as HTMLImageElement).style.display = 'none';
                                          // Show a fallback icon
                                          const container = (e.target as HTMLImageElement).parentElement;
                                          if (container && container.parentElement) {
                                            container.parentElement.classList.add('bg-muted');
                                            container.parentElement.classList.add('flex');
                                            container.parentElement.classList.add('items-center');
                                            container.parentElement.classList.add('justify-center');
                                            
                                            // Create and append the appropriate icon based on activeButton
                                            const iconElement = document.createElement('div');
                                            if (activeButton === 'podcasts') {
                                              iconElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-muted-foreground"><path d="M17.72 5.72a9.997 9.997 0 0 0-14.14 0"></path><path d="M14.14 9.3a4.998 4.998 0 0 0-7.07 0"></path><path d="M4.86 18.3a1 1 0 1 0 1.41-1.42c-.2-.2-.56-.2-.56-.2s0 .37.2.56"></path><path d="M7.14 16.56c-.23.23-.35.32-.35.44"></path><circle cx="12" cy="15" r="1"></circle><path d="M10.5 20.5a2.5 2.5 0 0 0 5 0v-2.2a2.5 2.5 0 0 1-5 0z"></path></svg>';
                                            } else if (activeButton === 'newsletters') {
                                              iconElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-muted-foreground"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>';
                                            } else {
                                              iconElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-muted-foreground"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8"></path><path d="M15 18h-5"></path><path d="M10 6h8v4h-8V6Z"></path></svg>';
                                            }
                                            container.parentElement.appendChild(iconElement);
                                          }
                                        }
                                      }}
                                    />
                                  </AspectRatio>
                                </div>
                              ) : article.publisherIconUrl ? (
                                <div className="flex-shrink-0 h-[88px] w-[88px] overflow-hidden rounded-l-lg">
                                  <AspectRatio ratio={1} className="h-full">
                                    <Image
                                      src={article.publisherIconUrl}
                                      alt={article.source || "Publisher"}
                                      fill
                                      unoptimized
                                      className="object-cover"
                                    />
                                  </AspectRatio>
                                </div>
                              ) : (
                                <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 bg-muted flex items-center justify-center rounded-l-xl">
                                  {activeButton === 'podcasts' ? (
                                    <Podcast className="h-8 w-8 text-muted-foreground" />
                                  ) : activeButton === 'newsletters' ? (
                                    <Mail className="h-8 w-8 text-muted-foreground" />
                                  ) : (
                                    <Newspaper className="h-8 w-8 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                              
                              {/* Content on the right */}
                              <div className="p-3 md:p-2 flex flex-col justify-center">
                                <div className="text-sm md:text-base font-medium line-clamp-2 text-card-foreground mb-1">
                                  {article.title}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {article.source && <span className="font-medium" title={article.source}>{truncateText(article.source, 20)}</span>}
                                  {article.date && (
                                    <>
                                      <span>•</span>
                                      <span>{article.date}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </a>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="-left-3 bg-card border-border hidden md:flex" />
                  <CarouselNext className="-right-3 bg-card border-border hidden md:flex" />
                </Carousel>
              </div>
              {!isUser && messageActions}
            </div>
          ) : (
            <div className={`max-w-[90%] p-2 rounded-lg ${isUser ? 'bg-primary/10 text-primary-foreground dark:text-primary' : 'bg-muted text-foreground'}`}>
              <p className="mb-2 break-words whitespace-normal">{content.message}</p>
              {!isUser && messageActions}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Modify custom submit handler to trigger animation on first message
  const customHandleSubmit = (e: React.FormEvent<HTMLFormElement> | Event) => {
    e.preventDefault();
    
    // Only submit if there's input, we're not already streaming, and a button is selected
    if (input.trim() && !isLoading && !isStreaming && activeButton !== "none") {
      // Check if this is the first message being sent
      if (messages.length === 0) {
        // Set animation state before submitting to ensure smooth transition
        setShouldAnimate(true);
        
        // Give the animation a moment to start before continuing with the submission
        setTimeout(() => {
          // Add vibration when message is submitted
          safeVibrate(50);
          
          // Focus the textarea
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
          
          // Set streaming state
          setIsStreaming(true);
          
          // Scroll to bottom immediately when sending
          scrollToBottom();
          
          // Call our custom handleSubmit function
          handleSubmit(e as React.FormEvent<HTMLFormElement>);
        }, 300); // Longer delay to allow animation to complete
      } else {
        // For subsequent messages, no animation delay is needed
        // Add vibration when message is submitted
        safeVibrate(50);
        
        // Focus the textarea
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        
        // Set streaming state
        setIsStreaming(true);
        
        // Scroll to bottom immediately when sending
        scrollToBottom();
        
        // Call our custom handleSubmit function
        handleSubmit(e as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  // Custom input change handler that wraps the original handleInputChange
  const customHandleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // Only allow input changes when not streaming
    if (!isLoading) {
      // Call the original handler
      handleInputChange(e);

      if (newValue.trim() !== "" && !hasTyped) {
        setHasTyped(true);
      } else if (newValue.trim() === "" && hasTyped) {
        setHasTyped(false);
      }

      // Auto-resize textarea
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const newHeight = Math.max(24, Math.min(textarea.scrollHeight, 160));
        textarea.style.height = `${newHeight}px`;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Include the active button type in the request
    const body = {
      activeButton: activeButton
    };
    
    // Call the original handleSubmit with the updated body
    originalHandleSubmit(e, { body });
  };

  // Handle touch events for better mobile scrolling
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    
    // Passive touch listener to prevent scrolling issues on mobile
    const handleTouchStart = () => {
      // This empty handler ensures the element stays "active" for scrolling
      // The passive: true option improves scroll performance
    };
    
    if (chatContainer) {
      chatContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    }
    
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('touchstart', handleTouchStart);
      }
    };
  }, []);

  // Add reset chat function
  const resetChat = () => {
    // Only reset if there are messages
    if (messages.length > 0) {
      // Vibrate when resetting chat
      safeVibrate(100);
      
      // First set the animation state to false to trigger the transition
      setShouldAnimate(false);
      
      // Wait for transition to begin before clearing messages
      setTimeout(() => {
        // Clear the chat using the setMessages method from useChat
        setMessages([]);
        
        // Reset any other state
        setIsStreaming(false);
        setLastMessageId(null);
        
        // Focus the textarea after clearing
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 300); // Longer delay to allow animation to complete
    }
  };

  // New function to handle topic card clicks
  const handleTopicClick = (topic: string, subtopic: string) => {
    if (textareaRef.current) {
      // Set an appropriate starter question based on the topic
      const starterQuestions = {
        sports: `Tell me the latest news about ${subtopic}.`,
        investing: `What's happening with ${subtopic} recently?`,
        politics: `What's the latest news about ${subtopic}?`,
        technology: `What are the latest developments in ${subtopic}?`
      };
      
      // Map topics to appropriate content types
      const topicToContentType: Record<string, ActiveButton> = {
        sports: "articles",
        investing: "newsletters",
        politics: "podcasts",
        technology: "articles"
      };
      
      // Get the question text based on topic
      const questionText = starterQuestions[topic.toLowerCase() as keyof typeof starterQuestions];
      
      // Set the appropriate content type button
      const contentType = topicToContentType[topic.toLowerCase() as keyof typeof topicToContentType];
      setActiveButton(contentType);
      
      // Set the input value programmatically
      const e = {
        target: {
          value: questionText
        }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      // Call the input change handler to update the state
      customHandleInputChange(e);
      
      // Focus the textarea
      textareaRef.current.focus();
    }
  };

  return (
    <div 
      ref={mainContainerRef} 
      className="border-0 w-full flex flex-col md:relative fixed inset-0 h-[calc(100dvh_-_65px)] md:h-[100dvh] overflow-hidden sm:max-w-100vw md:max-w-[552px] disabled-full-opacity"
    >
      {/* Top bar */}
      <div className="flex-shrink-0 border-b flex items-center justify-between px-4 py-2">
        <div style={{ width: '36px' }} className="flex items-start justify-start">
          <div className="hidden md:block">
            <BackButton />
          </div>
          {isBoarded && (
            <div className="md:hidden">
              <UserMenuClientWithErrorBoundary 
                initialDisplayName={displayName}
                initialProfileImage={profileImage}
                isBoarded={isBoarded}
                pendingFriendRequestCount={pendingFriendRequestCount}
              />
            </div>
          )}
        </div>
        <span className="text-base font-extrabold tracking-tight flex items-center">Chat <span className="ml-1.5 text-xs leading-none font-medium px-1.5 py-1 rounded bg-green-500/20 text-green-500 ml-1">v1</span></span>
        <Button
          variant="secondary" 
          size="icon"
          onClick={resetChat}
          className="rounded-full w-[36px] h-[36px] p-0 shadow-none text-muted-foreground md:hover:bg-transparent md:bg-transparent md:text-muted-foreground md:hover:text-muted-foreground md:rounded-none md:mr-[-0.5rem]"
          style={{ width: '36px', height: '36px', minHeight: '32px', minWidth: '32px' }}
          title="Reset Chat"
          disabled={isLoading || messages.length === 0}
        >
          <SquarePen className="!h-[18px] !w-[18px]" strokeWidth={2.25} />
          <span className="sr-only">Reset Chat</span>
        </Button>
      </div>

      {/* Chat messages area - adjust padding to account for top bar */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto w-full md:pb-[135px]"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none'
        }}
      >
        <div className="min-h-full pl-4 pr-4 pt-4 pb-2 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex">
              {/* Empty space to push content down */}
            </div>
          ) : (
            <div className="w-full space-y-4">
              {messages.map((message, index) => (
                <div key={index} className="w-full">
                  {renderMessage(message)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input Form with Topic Cards - Mobile: sticky, Desktop: fixed 
          Add conditional positioning and transition */}
      {messages.length === 0 && !shouldAnimate ? (
        <div 
          className="absolute inset-0 flex items-center justify-center w-full transition-all duration-300 ease-out"
          style={{ 
            top: '45px', // Account for top bar height
            height: 'calc(100% - 45px)', // Adjust height to exclude top bar
          }}
        >
          <div className="w-full max-w-screen-lg px-4">
            {/* Group all three elements together for proper centering */}
            <div className="w-full">
              {/* Title */}
              <div className="mb-4">
                <h2 className="text-2xl font-medium text-center leading-tight">
                  What topic are you interested in?
                </h2>
              </div>
              
              {/* Input area */}
              <div className="w-full mb-4">
                <form onSubmit={customHandleSubmit} className="w-full">
                  <div
                    ref={inputContainerRef}
                    className={cn(
                      "relative w-full rounded-3xl border border-input p-3 cursor-text",
                      "bg-secondary/0",
                      isLoading && "opacity-100"
                    )}
                    onClick={handleInputContainerClick}
                  >
                    <div className="pb-9">
                      <Textarea
                        ref={textareaRef}
                        placeholder={isLoading ? "Waiting for response..." : "Ask me about anything..."}
                        className="min-h-[24px] max-h-[160px] w-full rounded-3xl border-0 bg-transparent text-foreground placeholder:text-muted-foreground placeholder:text-base focus-visible:ring-0 focus-visible:ring-offset-0 text-base pl-2 pr-4 pt-0 pb-0 resize-none overflow-y-auto leading-tight disabled:opacity-100"
                        value={input}
                        onChange={customHandleInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center justify-between">
                        <div className="overflow-x-auto scrollbar-hide pr-2 mr-2">
                          <div className="flex items-center space-x-2 min-w-max">
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "chat-filter-button rounded-full h-8 px-3 flex items-center gap-1.5 shrink-0 hover:bg-primary hover:text-primary-foreground group shadow-none bg-background/60 transition-none border disabled:opacity-100",
                                activeButton === "newsletters" && "bg-primary text-primary-foreground",
                                activeTouchButton === "newsletters" && activeButton !== "newsletters" && "bg-background/80"
                              )}
                              data-state={activeButton === "newsletters" ? "active" : "inactive"}
                              onClick={() => toggleButton("newsletters")}
                              onTouchStart={() => handleTouchStart("newsletters")}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              disabled={isLoading}
                            >
                              <Mail className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === "newsletters" && "text-primary-foreground")} />
                              <span className={cn("text-foreground text-sm group-hover:text-primary-foreground transition-none", activeButton === "newsletters" && "font-medium text-primary-foreground")}>
                                Newsletters
                              </span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "chat-filter-button rounded-full h-8 px-3 flex items-center gap-1.5 shrink-0 hover:bg-primary hover:text-primary-foreground group shadow-none bg-background/60 transition-none border disabled:opacity-100",
                                activeButton === "podcasts" && "bg-primary text-primary-foreground",
                                activeTouchButton === "podcasts" && activeButton !== "podcasts" && "bg-background/80"
                              )}
                              data-state={activeButton === "podcasts" ? "active" : "inactive"}
                              onClick={() => toggleButton("podcasts")}
                              onTouchStart={() => handleTouchStart("podcasts")}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              disabled={isLoading}
                            >
                              <Podcast className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === "podcasts" && "text-primary-foreground")} />
                              <span className={cn("text-foreground text-sm group-hover:text-primary-foreground transition-none", activeButton === "podcasts" && "font-medium text-primary-foreground")}>
                                Podcasts
                              </span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "chat-filter-button rounded-full h-8 px-3 flex items-center gap-1.5 shrink-0 hover:bg-primary hover:text-primary-foreground group shadow-none bg-background/60 transition-none border disabled:opacity-100",
                                activeButton === "articles" && "bg-primary text-primary-foreground",
                                activeTouchButton === "articles" && activeButton !== "articles" && "bg-background/80"
                              )}
                              data-state={activeButton === "articles" ? "active" : "inactive"}
                              onClick={() => toggleButton("articles")}
                              onTouchStart={() => handleTouchStart("articles")}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              disabled={isLoading}
                            >
                              <Newspaper className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === "articles" && "text-primary-foreground")} />
                              <span className={cn("text-foreground text-sm group-hover:text-primary-foreground transition-none", activeButton === "articles" && "font-medium text-primary-foreground")}>
                                Articles
                              </span>
                            </Button>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          size="icon"
                          disabled={!input.trim() || isLoading || activeButton === "none"}
                          className={cn(
                            "rounded-full h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0",
                            (!input.trim() || activeButton === "none") && "opacity-50 cursor-not-allowed",
                            isLoading && "opacity-100 cursor-not-allowed"
                          )}
                        >
                          <ArrowUp className="h-4 w-4" />
                          <span className="sr-only">Send</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              
              {/* Topic grid */}
              <div className="w-full">
                <div className="grid grid-cols-2 gap-4">
                  {/* Sports card */}
                  <div 
                    className="border rounded-xl p-3 bg-secondary/0 hover:bg-secondary/80 cursor-pointer transition-colors"
                    onClick={() => handleTopicClick('sports', 'NFL')}
                  >
                    <h3 className="text-muted-foreground text-sm font-medium mb-3 flex items-center leading-none">
                      <span className="mr-2">🏈</span>
                      <span>Sports</span>
                    </h3>
                    <p className="text-primary text-sm leading-none">NFL Free Agency</p>
                  </div>
                  
                  {/* Investing card */}
                  <div 
                    className="border rounded-xl p-3 bg-secondary/0 hover:bg-secondary/80 cursor-pointer transition-colors"
                    onClick={() => handleTopicClick('investing', 'Bitcoin')}
                  >
                    <h3 className="text-muted-foreground text-sm font-medium mb-3 flex items-center leading-none">
                      <span className="mr-2">📈</span>
                      <span>Investing</span>
                    </h3>
                    <p className="text-primary text-sm leading-none">Stock Market</p>
                  </div>
                  
                  {/* Pop Culture card */}
                  <div 
                    className="border rounded-xl p-3 bg-secondary/0 hover:bg-secondary/80 cursor-pointer transition-colors"
                    onClick={() => handleTopicClick('politics', 'Kendrick Lamar')}
                  >
                    <h3 className="text-muted-foreground text-sm font-medium mb-3 flex items-center leading-none">
                      <span className="mr-2">🍿</span>
                      <span>Pop Culture</span>
                    </h3>
                    <p className="text-primary text-sm leading-none">Kendrick Lamar</p>
                  </div>
                  
                  {/* Technology card */}
                  <div 
                    className="border rounded-xl p-3 bg-secondary/0 hover:bg-secondary/80 cursor-pointer transition-colors"
                    onClick={() => handleTopicClick('technology', 'AI')}
                  >
                    <h3 className="text-muted-foreground text-sm font-medium mb-3 flex items-center leading-none">
                      <span className="mr-2">🤖</span>
                      <span>Technology</span>
                    </h3>
                    <p className="text-primary text-sm leading-none">Artificial Intelligence</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="sticky bottom-0 left-0 right-0 bg-transparent p-0 z-10 transition-all duration-300 ease-out w-full"
          style={{ 
            overflow: 'hidden', // Prevent overflow during transition
          }}
        >
          <div className="mx-auto flex flex-col p-0 max-w-screen-lg">
            <div className="w-full md:flex md:justify-center">
              <div className="w-full pl-4 pr-4 pt-4 pb-4">
                <form onSubmit={customHandleSubmit} className="w-full">
                  <div
                    ref={inputContainerRef}
                    className={cn(
                      "relative w-full rounded-3xl border border-input p-3 cursor-text",
                      "bg-secondary/0",
                      isLoading && "opacity-100"
                    )}
                    onClick={handleInputContainerClick}
                  >
                    <div className="pb-9">
                      <Textarea
                        ref={textareaRef}
                        placeholder={isLoading ? "Waiting for response..." : "Ask me about anything..."}
                        className="min-h-[24px] max-h-[160px] w-full rounded-3xl border-0 bg-transparent text-foreground placeholder:text-muted-foreground placeholder:text-base focus-visible:ring-0 focus-visible:ring-offset-0 text-base pl-2 pr-4 pt-0 pb-0 resize-none overflow-y-auto leading-tight disabled:opacity-100"
                        value={input}
                        onChange={customHandleInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center justify-between">
                        <div className="overflow-x-auto scrollbar-hide pr-2 mr-2">
                          <div className="flex items-center space-x-2 min-w-max">
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "chat-filter-button rounded-full h-8 px-3 flex items-center gap-1.5 shrink-0 hover:bg-primary hover:text-primary-foreground group shadow-none bg-background/60 transition-none border disabled:opacity-100",
                                activeButton === "newsletters" && "bg-primary text-primary-foreground",
                                activeTouchButton === "newsletters" && activeButton !== "newsletters" && "bg-background/80"
                              )}
                              data-state={activeButton === "newsletters" ? "active" : "inactive"}
                              onClick={() => toggleButton("newsletters")}
                              onTouchStart={() => handleTouchStart("newsletters")}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              disabled={isLoading}
                            >
                              <Mail className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === "newsletters" && "text-primary-foreground")} />
                              <span className={cn("text-foreground text-sm group-hover:text-primary-foreground transition-none", activeButton === "newsletters" && "font-medium text-primary-foreground")}>
                                Newsletters
                              </span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "chat-filter-button rounded-full h-8 px-3 flex items-center gap-1.5 shrink-0 hover:bg-primary hover:text-primary-foreground group shadow-none bg-background/60 transition-none border disabled:opacity-100",
                                activeButton === "podcasts" && "bg-primary text-primary-foreground",
                                activeTouchButton === "podcasts" && activeButton !== "podcasts" && "bg-background/80"
                              )}
                              data-state={activeButton === "podcasts" ? "active" : "inactive"}
                              onClick={() => toggleButton("podcasts")}
                              onTouchStart={() => handleTouchStart("podcasts")}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              disabled={isLoading}
                            >
                              <Podcast className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === "podcasts" && "text-primary-foreground")} />
                              <span className={cn("text-foreground text-sm group-hover:text-primary-foreground transition-none", activeButton === "podcasts" && "font-medium text-primary-foreground")}>
                                Podcasts
                              </span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "chat-filter-button rounded-full h-8 px-3 flex items-center gap-1.5 shrink-0 hover:bg-primary hover:text-primary-foreground group shadow-none bg-background/60 transition-none border disabled:opacity-100",
                                activeButton === "articles" && "bg-primary text-primary-foreground",
                                activeTouchButton === "articles" && activeButton !== "articles" && "bg-background/80"
                              )}
                              data-state={activeButton === "articles" ? "active" : "inactive"}
                              onClick={() => toggleButton("articles")}
                              onTouchStart={() => handleTouchStart("articles")}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              disabled={isLoading}
                            >
                              <Newspaper className={cn("h-4 w-4 text-foreground group-hover:text-primary-foreground transition-none", activeButton === "articles" && "text-primary-foreground")} />
                              <span className={cn("text-foreground text-sm group-hover:text-primary-foreground transition-none", activeButton === "articles" && "font-medium text-primary-foreground")}>
                                Articles
                              </span>
                            </Button>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          size="icon"
                          disabled={!input.trim() || isLoading || activeButton === "none"}
                          className={cn(
                            "rounded-full h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0",
                            (!input.trim() || activeButton === "none") && "opacity-50 cursor-not-allowed",
                            isLoading && "opacity-100 cursor-not-allowed"
                          )}
                        >
                          <ArrowUp className="h-4 w-4" />
                          <span className="sr-only">Send</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 