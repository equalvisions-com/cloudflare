import { z } from 'zod';
import type { RapidAPINewsResponse, RapidAPIArticle, Article, MessageContent } from '@/lib/types';

// Schema for an article
export const ArticleSchema = z.object({
  title: z.string().default('No title available'),
  link: z.string().default('#'),
  date: z.string().default(''),
  source: z.string().default(''),
  publisherIconUrl: z.string().optional().default(''),
  photo_url: z.string().optional(),
});

// Schema for the message content
export const MessageSchema = z.object({
  message: z.string(),
  articles: z.array(ArticleSchema).default([]),
}); 