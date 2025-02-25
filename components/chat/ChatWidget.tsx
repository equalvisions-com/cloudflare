'use client';

import { type Message as UIMessage, useChat } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { MessageContent, MessageSchema } from '@/app/types/article';

interface ChatWidgetProps {
  setIsOpen: (open: boolean) => void;
}

export function ChatWidget({ setIsOpen }: ChatWidgetProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      if (!response.ok) {
        console.error('Response error:', response.statusText);
        return;
      }
      console.log('Chat response received:', response);
    },
    onFinish: (message) => {
      console.log('Chat message finished:', message);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  console.log('Current messages:', messages);

  // Custom message rendering function
  const renderMessage = (message: UIMessage) => {
    console.log('Rendering message:', message);
    const isUser = message.role === 'user';
    let content: MessageContent | string;

    if (isUser) {
      content = message.content;
    } else {
      try {
        // Try to parse the content as JSON if it's from the assistant
        let parsedContent;
        
        // Check for tool invocations first
        const toolInvocation = message.toolInvocations?.[0];
        if (toolInvocation?.state === 'result' && toolInvocation.result) {
          console.log('Found tool result:', toolInvocation.result);
          parsedContent = toolInvocation.result;
        } 
        // Then check content
        else if (message.content) {
          parsedContent = typeof message.content === 'string' 
            ? JSON.parse(message.content)
            : message.content;
        } 
        // Finally check parts
        else if (message.parts?.[0]) {
          const textPart = message.parts.find(part => part.type === 'text');
          if (textPart && 'text' in textPart) {
            parsedContent = JSON.parse(textPart.text);
          }
        }

        if (!parsedContent) {
          throw new Error('No valid content found in message');
        }
        
        console.log('Parsed content:', parsedContent);
        
        // If the content is already in the correct format, use it directly
        if (parsedContent.message && Array.isArray(parsedContent.articles)) {
          content = parsedContent;
        } else {
          // Otherwise, try to parse the nested content
          content = MessageSchema.parse(parsedContent);
        }
        console.log('Validated content:', content);
      } catch (error) {
        console.log('Failed to parse/validate message content:', {
          error,
          message,
          content: message.content,
          parts: message.parts,
          toolInvocations: message.toolInvocations,
          isUser,
        });
        
        // Fallback to plain text
        const toolInvocation = message.toolInvocations?.[0];
        if (message.content) {
          content = message.content;
        } else if (message.parts?.[0]) {
          const textPart = message.parts.find(part => part.type === 'text');
          content = textPart && 'text' in textPart ? textPart.text : 'No content available';
        } else if (toolInvocation?.state === 'result' && toolInvocation.result) {
          content = JSON.stringify(toolInvocation.result, null, 2);
        } else {
          content = 'No content available';
        }
      }
    }

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`} key={message.id}>
        <div className={`max-w-[80%] p-3 rounded-lg ${isUser ? 'bg-blue-100 text-gray-900' : 'bg-gray-100 text-gray-900'}`}>
          {typeof content === 'string' ? (
            <p>{content}</p>
          ) : (
            <>
              <p className="mb-2">{content.message}</p>
              {content.articles && content.articles.length > 0 && (
                <div className="mt-4">
                  <Carousel
                    opts={{
                      align: "start",
                      loop: true,
                    }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-2 md:-ml-4">
                      {content.articles.map((article, index) => (
                        <CarouselItem key={`${article.link}-${index}`} className="pl-2 md:pl-4 basis-full">
                          <Card className="bg-white">
                            <CardHeader className="p-3">
                              <div className="flex items-start gap-3">
                                {article.imageUrl && (
                                  <div className="flex-shrink-0 w-16 h-16 rounded-sm overflow-hidden">
                                    <AspectRatio ratio={1} className="bg-muted">
                                      <Image
                                        src={article.imageUrl}
                                        alt={article.title}
                                        className="object-cover"
                                        fill
                                        sizes="64px"
                                      />
                                    </AspectRatio>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm">
                                    <a
                                      href={article.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      {article.title}
                                    </a>
                                  </CardTitle>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-2">
                                {article.source && <span>{article.source}</span>}
                                {article.date && (
                                  <>
                                    <span>•</span>
                                    <span>{article.date}</span>
                                  </>
                                )}
                                {article.section && (
                                  <>
                                    <span>•</span>
                                    <span>{article.section}</span>
                                  </>
                                )}
                              </div>
                            </CardHeader>
                            {article.snippet && (
                              <CardContent className="p-3 pt-0">
                                <CardDescription className="text-xs">{article.snippet}</CardDescription>
                              </CardContent>
                            )}
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-0" />
                    <CarouselNext className="right-0" />
                  </Carousel>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed bottom-20 right-4 w-96 h-[500px] bg-white shadow-xl rounded-lg border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Chatbot</h2>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={index}>{renderMessage(message)}</div>
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 p-3 rounded-lg max-w-[80%]">
              <p className="text-gray-500">Loading...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask me anything..."
          className="flex-1"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading}>
          Send
        </Button>
      </form>
    </div>
  );
}