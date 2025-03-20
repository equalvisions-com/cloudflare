import { z } from 'zod';

// Interface for the RapidAPI Google News response
export interface RapidAPINewsResponse {
  is_successful: boolean;
  message: string;
  data?: {
    articles: RapidAPIArticle[];
  };
}

// Interface for an article from RapidAPI Google News
export interface RapidAPIArticle {
  headline?: string | null;
  external_url?: string | null;
  publish_timestamp?: number | null;
  publisher?: string | null;
  publisher_icon_url?: string | null;
  photo_url?: string | null;
}

// Schema for an article
export const ArticleSchema = z.object({
  title: z.string().default('No title available'),
  link: z.string().default('#'),
  date: z.string().default(''),
  source: z.string().default(''),
  publisherIconUrl: z.string().optional().default(''),
  photo_url: z.string().optional(),
});

// Type for an article
export type Article = z.infer<typeof ArticleSchema>;

// Schema for the message content
export const MessageSchema = z.object({
  message: z.string(),
  articles: z.array(ArticleSchema).default([]),
});

// Type for the message content
export type MessageContent = z.infer<typeof MessageSchema>; 