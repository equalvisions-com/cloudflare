'use client';

import { type Message as UIMessage, useChat } from 'ai/react';
import { useRef, useEffect, useCallback, useMemo, memo } from "react";
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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/components/ui/use-toast";
import { TrendingTopicsGrid } from './TrendingTopicsGrid';
import { useChatActions } from '@/lib/hooks/useChatActions';
import { useChatStore } from '@/lib/stores/chatStore';
import { ActiveButton } from '@/lib/types';
import {
  TypingIndicator,
  MessageActions,
  FilterButton,
  SubmitButton,
  ResetButton,
  ChatTextarea,
} from './ChatComponents';

// Helper function to truncate text
const truncateText = (text: string, maxLength: number): string => {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// Memoized message component
const ChatMessage = memo(({ 
  message, 
  isUser, 
    isLoading,
  lastMessageId, 
  activeButton, 
  likedMessages, 
  dislikedMessages, 
  onLike, 
  onDislike, 
  playTrack 
}: {
  message: UIMessage;
  isUser: boolean;
  isLoading: boolean;
  lastMessageId: string | null;
  activeButton: ActiveButton;
  likedMessages: Record<string, boolean>;
  dislikedMessages: Record<string, boolean>;
  onLike: (messageId: string) => void;
  onDislike: (messageId: string) => void;
  playTrack: (src: string, title: string, image?: string) => void;
}) => {
  const content = useMemo((): MessageContent | string | null => {
    if (isUser) {
      return message.content;
    }

    // For assistant messages, try to parse content from available sources
    // If no content is found, show loading (null) instead of error messages
    
        // Check for tool invocation results first (most reliable source)
        const toolInvocation = message.toolInvocations?.[0];
        if (toolInvocation?.state === 'result' && toolInvocation.result) {
          if (typeof toolInvocation.result === 'object' && 
              'message' in toolInvocation.result && 
              'articles' in toolInvocation.result) {
        return toolInvocation.result as MessageContent;
          } else if (typeof toolInvocation.result === 'string') {
            try {
              const parsed = JSON.parse(toolInvocation.result);
          return 'message' in parsed && 'articles' in parsed 
            ? parsed as MessageContent
                : { message: String(toolInvocation.result), articles: [] };
            } catch {
          return { message: String(toolInvocation.result), articles: [] };
            }
          } else {
        return { message: 'Received response', articles: [] };
          }
        }
    
    // Check message content
    if (message.content) {
          if (typeof message.content === 'string') {
            try {
              const parsed = JSON.parse(message.content);
          return 'message' in parsed && 'articles' in parsed 
            ? parsed as MessageContent
                : { message: message.content, articles: [] };
            } catch {
          return { message: message.content, articles: [] };
            }
          } else {
        return { 
              message: typeof message.content === 'object' ? 'Received response' : String(message.content), 
              articles: [] 
            };
          }
        } 
    
    // Check message parts
    if (message.parts?.length) {
          const textPart = message.parts.find(part => part.type === 'text');
      if (textPart && 'text' in textPart && textPart.text.trim()) {
            try {
              const parsed = JSON.parse(textPart.text);
          return 'message' in parsed && 'articles' in parsed 
            ? parsed as MessageContent
                : { message: textPart.text, articles: [] };
            } catch {
          return { message: textPart.text, articles: [] };
        }
      }
    }
    
    // If we get here, we have no content - show loading instead of error
    return null;
  }, [message, isUser]);

  // Show typing indicator if content is null (loading state)
  if (!isUser && content === null) {
    return (
      <div className="flex justify-start mb-4 w-full">
        <div className="max-w-[80%] p-3 rounded-lg bg-muted text-muted-foreground">
          <TypingIndicator />
        </div>
      </div>
    );
  }

    return (
    <div className="flex flex-col w-full mb-2">
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
          {typeof content === 'string' ? (
            <div className={`max-w-[90%] p-2 rounded-lg ${isUser ? 'bg-[#007AFF] text-primary-foreground dark:text-primary' : 'bg-muted text-foreground'}`}>
              <p className="break-words whitespace-normal">{content}</p>
            {!isUser && (
              <MessageActions
                messageId={message.id}
                likedMessages={likedMessages}
                dislikedMessages={dislikedMessages}
                onLike={onLike}
                onDislike={onDislike}
              />
            )}
            </div>
        ) : content && typeof content === 'object' && 'articles' in content && content.articles?.length > 0 ? (
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
                  {content.articles.map((article: any, index: number) => (
                      <CarouselItem key={`${article.link}-${index}`} className="pl-2 md:pl-4 basis-[90%] sm:basis-[70%] md:basis-[70%] lg:basis-[70%]">
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        className="block h-full"
                          onClick={(e) => {
                          if (activeButton === 'podcasts' && article.link) {
                              e.preventDefault();
                              playTrack(article.link, article.title, article.publisherIconUrl);
                            }
                          }}
                        >
                        <Card className="h-full border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex h-[88px]">
                            {article.publisherIconUrl ? (
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
            {!isUser && (
              <MessageActions
                messageId={message.id}
                likedMessages={likedMessages}
                dislikedMessages={dislikedMessages}
                onLike={onLike}
                onDislike={onDislike}
              />
            )}
            </div>
        ) : content && typeof content === 'object' ? (
            <div className={`max-w-[90%] p-2 rounded-lg ${isUser ? 'bg-primary/10 text-primary-foreground dark:text-primary' : 'bg-muted text-foreground'}`}>
              <p className="mb-2 break-words whitespace-normal">{content.message}</p>
            {!isUser && (
              <MessageActions
                messageId={message.id}
                likedMessages={likedMessages}
                dislikedMessages={dislikedMessages}
                onLike={onLike}
                onDislike={onDislike}
              />
            )}
          </div>
        ) : null}
        </div>
      </div>
    );
});
ChatMessage.displayName = 'ChatMessage';

const ChatPageComponent = () => {
  // Get user profile data from context
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount, isAuthenticated } = useSidebar();
  const { toast } = useToast();
  
  // Add rate limit status query
  const rateLimitStatus = useQuery(api.chat.getRateLimitStatus);
  
  // Get state and actions from store and custom hook
  const { reset } = useChatStore();
  const {
    activeButton,
    hasTyped,
    shouldAnimate,
    lastMessageId,
    likedMessages,
    dislikedMessages,
    activeTouchButton,
    toggleButton,
    handleTouchStart,
    handleTouchEnd,
    handleInputContainerClick,
    handleKeyDown,
    handleInputChange,
    handleLike,
    handleDislike,
    resetChat,
    handleTopicClick,
    setLastMessageId,
    setShouldAnimate,
  } = useChatActions();

  // State for managing messages and input
  const {
    messages,
    input,
    handleInputChange: originalHandleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      if (response.status === 200) {
        // Response received
      }
    },
    onFinish: () => {
      // Response complete
    },
    onError: (error) => {
      console.error('Chat error:', error);
      
      // Parse error message
      let errorMessage = 'Something went wrong';
      try {
        if (error.message) {
          errorMessage = error.message;
        }
      } catch {
        // Use default message if parsing fails
      }

      // Handle different types of errors
      let toastTitle = "Error";
      let toastDescription = errorMessage;

      if (errorMessage.includes("Rate limit exceeded") || errorMessage.includes("429")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "You've reached your daily message limit. Please try again tomorrow.";
      } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
        toastTitle = "Authentication Error";
        toastDescription = "Please log in to continue chatting.";
      } else if (errorMessage.includes("Network") || errorMessage.includes("fetch")) {
        toastTitle = "Connection Error";
        toastDescription = "Please check your internet connection and try again.";
      } else if (errorMessage.includes("ConnectTimeoutError") || errorMessage.includes("UND_ERR_CONNECT_TIMEOUT") || errorMessage.includes("Connect Timeout Error")) {
        toastTitle = "Connection Timeout";
        toastDescription = "The request timed out. Please try again.";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
        toastTitle = "Request Timeout";
        toastDescription = "The request took too long to complete. Please try again.";
      } else if (errorMessage.includes("fetch failed") || errorMessage === "fetch failed") {
        toastTitle = "Connection Error";
        toastDescription = "Failed to connect to the server. Please check your internet connection.";
      }

      toast({
        title: toastTitle,
        description: toastDescription,
      });
    },
    body: {
      activeButton: activeButton
    }
  });

  // Audio player hook for podcast playback
  const { playTrack } = useAudio();
  
  // Refs for DOM elements
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Scroll to bottom when messages change - minimal useEffect
  useEffect(() => {
    scrollToBottom();
  }, [messages, rateLimitStatus, scrollToBottom]);

  // Cleanup on unmount - minimal useEffect
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Memoized handlers
  const customHandleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e, textareaRef, originalHandleInputChange);
  }, [handleInputChange, originalHandleInputChange]);

  const customHandleSubmit = useCallback((e: React.FormEvent<HTMLFormElement> | Event) => {
    e.preventDefault();
    if (!input.trim() || isLoading || activeButton === "none" || !isAuthenticated) return;

    setShouldAnimate(true);
    setLastMessageId(messages.length.toString());

    const body = { activeButton: activeButton };
    originalHandleSubmit(e as React.FormEvent<HTMLFormElement>, { body });
  }, [input, isLoading, activeButton, isAuthenticated, setShouldAnimate, setLastMessageId, messages.length, originalHandleSubmit]);

  const customHandleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleKeyDown(e, input, isLoading, () => customHandleSubmit(new Event('submit')));
  }, [handleKeyDown, input, isLoading, customHandleSubmit]);

  const customHandleInputContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleInputContainerClick(e, inputContainerRef, textareaRef);
  }, [handleInputContainerClick]);

  const customResetChat = useCallback(() => {
    resetChat(messages, setMessages, textareaRef);
  }, [resetChat, messages, setMessages]);

  const customHandleTopicClick = useCallback((title: string, subtopic: string) => {
    if (!isAuthenticated) return;
    handleTopicClick(title, subtopic, textareaRef, customHandleInputChange);
  }, [isAuthenticated, handleTopicClick, customHandleInputChange]);

  // Memoized placeholder text
  const placeholderText = useMemo(() => {
    if (!isAuthenticated) return "Please log in to chat";
    if (isLoading) return "Waiting for response...";
    return "Ask me about anything...";
  }, [isAuthenticated, isLoading]);

  // Memoized filter buttons
  const filterButtons = useMemo(() => (
    <div className="flex items-center space-x-2 min-w-max">
      <FilterButton
        type="newsletters"
        activeButton={activeButton}
        activeTouchButton={activeTouchButton}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        onToggle={toggleButton}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
      <FilterButton
        type="podcasts"
        activeButton={activeButton}
        activeTouchButton={activeTouchButton}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        onToggle={toggleButton}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
      <FilterButton
        type="articles"
        activeButton={activeButton}
        activeTouchButton={activeTouchButton}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        onToggle={toggleButton}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  ), [activeButton, activeTouchButton, isAuthenticated, isLoading, toggleButton, handleTouchStart, handleTouchEnd]);

  // Memoized messages
  const messagesList = useMemo(() => 
    messages.map((message, index) => (
      <div key={index} className="w-full">
        <ChatMessage
          message={message}
          isUser={message.role === 'user'}
          isLoading={isLoading}
          lastMessageId={lastMessageId}
          activeButton={activeButton}
          likedMessages={likedMessages}
          dislikedMessages={dislikedMessages}
          onLike={handleLike}
          onDislike={handleDislike}
          playTrack={playTrack}
        />
      </div>
    )), [messages, isLoading, lastMessageId, activeButton, likedMessages, dislikedMessages, handleLike, handleDislike, playTrack]);

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
        <span className="text-base font-extrabold tracking-tight flex items-center">
          Chat <span className="ml-1.5 text-xs leading-none font-medium px-1.5 py-1 rounded bg-green-500/20 text-green-500 ml-1">v1</span>
        </span>
        <ResetButton
          isLoading={isLoading}
          hasMessages={messages.length > 0}
          onReset={customResetChat}
        />
      </div>

      {/* Chat messages area */}
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
              {messagesList}
            </div>
          )}
          {/* Show remaining messages */}
          {isAuthenticated && rateLimitStatus && (
            <div className="text-center text-xs text-muted-foreground pt-2">
              {rateLimitStatus.remaining} messages remaining today
            </div>
          )}
        </div>
      </div>

      {/* Input Form with Topic Cards */}
      {messages.length === 0 && !shouldAnimate ? (
        <div 
          className="absolute inset-0 flex items-center justify-center w-full transition-all duration-300 ease-out"
          style={{ 
            top: '45px',
            height: 'calc(100% - 45px)',
          }}
        >
          <div className="w-full max-w-screen-lg px-4">
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
                      isLoading && "opacity-100",
                      !isAuthenticated && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={customHandleInputContainerClick}
                  >
                    <div className="pb-9">
                      <ChatTextarea
                        textareaRef={textareaRef}
                        placeholder={placeholderText}
                        value={input}
                        onChange={customHandleInputChange}
                        onKeyDown={customHandleKeyDown}
                        disabled={isLoading || !isAuthenticated}
                      />
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center justify-between">
                        <div className="overflow-x-auto scrollbar-hide pr-2 mr-2">
                          {filterButtons}
                          </div>
                        <SubmitButton
                          input={input}
                          isLoading={isLoading}
                          activeButton={activeButton}
                          isAuthenticated={isAuthenticated}
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              
              {/* Dynamic Topic grid */}
              <TrendingTopicsGrid 
                isAuthenticated={isAuthenticated}
                onTopicClick={customHandleTopicClick}
              />
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="sticky bottom-0 left-0 right-0 bg-transparent p-0 z-10 transition-all duration-300 ease-out w-full"
          style={{ 
            overflow: 'hidden',
          }}
        >
          <div className="mx-auto flex flex-col p-0 max-w-screen-lg">
            {!isAuthenticated && (
              <div className="w-full text-center px-4 pt-2">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Please log in to continue chatting.
                </p>
              </div>
            )}
            <div className="w-full md:flex md:justify-center">
              <div className="w-full pl-4 pr-4 pt-4 pb-4">
                <form onSubmit={customHandleSubmit} className="w-full">
                  <div
                    ref={inputContainerRef}
                    className={cn(
                      "relative w-full rounded-3xl border border-input p-3 cursor-text",
                      "bg-secondary/0",
                      isLoading && "opacity-100",
                      !isAuthenticated && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={customHandleInputContainerClick}
                  >
                    <div className="pb-9">
                      <ChatTextarea
                        textareaRef={textareaRef}
                        placeholder={placeholderText}
                        value={input}
                        onChange={customHandleInputChange}
                        onKeyDown={customHandleKeyDown}
                        disabled={isLoading || !isAuthenticated}
                      />
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center justify-between">
                        <div className="overflow-x-auto scrollbar-hide pr-2 mr-2">
                          {filterButtons}
                          </div>
                        <SubmitButton
                          input={input}
                          isLoading={isLoading}
                          activeButton={activeButton}
                          isAuthenticated={isAuthenticated}
                        />
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
};

export const ChatPage = memo(ChatPageComponent);
ChatPage.displayName = 'ChatPage'; 