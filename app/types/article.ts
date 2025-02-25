import { z } from 'zod';

export interface SerperArticle {
  title: string;
  link: string;
  snippet?: string;
  section?: string;
  date?: string;
  source?: string;
  imageUrl?: string;
  position?: number;
}

export interface SerperResponse {
  news: SerperArticle[];
}

export const ArticleSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  snippet: z.string(),
  section: z.string().optional(),
  date: z.string().optional(),
  source: z.string().optional(),
  imageUrl: z.string().url().optional(),
  position: z.number().optional(),
});

export type Article = z.infer<typeof ArticleSchema>;

export const MessageSchema = z.object({
  message: z.string(),
  articles: z.array(ArticleSchema).optional(),
});

export type MessageContent = z.infer<typeof MessageSchema>; 