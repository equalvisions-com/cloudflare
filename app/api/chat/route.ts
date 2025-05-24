import { Message } from 'ai';
import { streamText, jsonSchema } from 'ai';
import { openai as openaiClient } from '@ai-sdk/openai';
import { Article, RapidAPINewsResponse, MessageSchema } from '@/app/types/article';
import { executeRead } from '@/lib/database';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

// Define a type for the entry rows to fix type errors
interface EntryRow {
  id: number;
  guid: string;
  title: string;
  link: string;
  description: string | null;
  pub_date: string;
  image: string | null;
  media_type: string;
  feed_title: string;
  [key: string]: unknown;
}

// Function to fetch newsletter entries from PlanetScale
async function fetchNewsletterEntries(query: string): Promise<Article[]> {
  try {
    // Prepare the search query
    const searchTerms = query.split(' ').filter(term => term.length > 1);
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    // Create a simple LIKE query since we don't know if full-text search is available
    const searchPattern = `%${searchTerms.join('%')}%`;
    
    // Query the database for matching newsletter entries using read replica
    const result = await executeRead(
      `SELECT 
        e.id, 
        e.guid, 
        e.title, 
        e.link, 
        e.description, 
        e.pub_date, 
        e.image,
        e.media_type,
        f.title as feed_title
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE 
        (e.title LIKE ? OR e.description LIKE ?)
        AND e.media_type = 'newsletter'
      ORDER BY e.pub_date DESC
      LIMIT 15`,
      [searchPattern, searchPattern]
    );
    
    if (!result.rows || result.rows.length === 0) {
      // Return empty array when no results are found
      return [];
    }
    
    // Format the date for each entry
    const now = new Date();
    
    // Map the database results to the Article format with type assertion
    return (result.rows as EntryRow[]).map((entry) => {
      // Format the date
      let formattedDate = '';
      if (entry.pub_date) {
        const date = new Date(entry.pub_date as string);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 60) {
          // For entries less than an hour old
          formattedDate = diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
        } else {
          const diffHrs = Math.floor(diffMins / 60);
          if (diffHrs < 24) {
            formattedDate = diffHrs === 1 ? '1 hr ago' : `${diffHrs} hrs ago`;
          } else {
            const diffDays = Math.floor(diffHrs / 24);
            formattedDate = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
          }
        }
      }
      
      // Extract the publisher name from the feed title
      const source = (entry.feed_title as string) || 'Unknown Source';
      
      // Use the image from the entry if available
      const publisherIconUrl = (entry.image as string) || '';
      
      return {
        title: (entry.title as string) || 'No title available',
        link: (entry.link as string) || '#',
        date: formattedDate,
        source: source,
        publisherIconUrl: publisherIconUrl,
        description: (entry.description as string) || 'No description available'
      };
    });
  } catch {
    // Silently handle errors and return empty array
    return [];
  }
}

// Function to fetch podcast entries from PlanetScale
async function fetchPodcastEntries(query: string): Promise<Article[]> {
  try {
    // Prepare the search query
    const searchTerms = query.split(' ').filter(term => term.length > 1);
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    // Create a simple LIKE query since we don't know if full-text search is available
    const searchPattern = `%${searchTerms.join('%')}%`;
    
    // Query the database for matching podcast entries using read replica
    const result = await executeRead(
      `SELECT 
        e.id, 
        e.guid, 
        e.title, 
        e.link, 
        e.description, 
        e.pub_date, 
        e.image,
        e.media_type,
        f.title as feed_title
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE 
        (e.title LIKE ? OR e.description LIKE ?)
        AND e.media_type = 'podcast'
      ORDER BY e.pub_date DESC
      LIMIT 15`,
      [searchPattern, searchPattern]
    );
    
    if (!result.rows || result.rows.length === 0) {
      // Return empty array when no results are found
      return [];
    }
    
    // Format the date for each entry
    const now = new Date();
    
    // Map the database results to the Article format with type assertion
    return (result.rows as EntryRow[]).map((entry) => {
      // Format the date
      let formattedDate = '';
      if (entry.pub_date) {
        const date = new Date(entry.pub_date as string);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 60) {
          // For entries less than an hour old
          formattedDate = diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
        } else {
          const diffHrs = Math.floor(diffMins / 60);
          if (diffHrs < 24) {
            formattedDate = diffHrs === 1 ? '1 hr ago' : `${diffHrs} hrs ago`;
          } else {
            const diffDays = Math.floor(diffHrs / 24);
            formattedDate = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
          }
        }
      }
      
      // Extract the publisher name from the feed title
      const source = (entry.feed_title as string) || 'Unknown Source';
      
      // Use the image from the entry if available
      const publisherIconUrl = (entry.image as string) || '';
      
      return {
        title: (entry.title as string) || 'No title available',
        link: (entry.link as string) || '#',
        date: formattedDate,
        source: source,
        publisherIconUrl: publisherIconUrl,
        description: (entry.description as string) || 'No description available'
      };
    });
  } catch {
    // Silently handle errors and return empty array
    return [];
  }
}

// Function to fetch articles from Google News API via RapidAPI
async function fetchArticles(topic: string): Promise<Article[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RapidAPI key is missing');

  try {
    // Use AbortController to set a timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      `https://google-news-api4.p.rapidapi.com/v1/google-news/search?text=${encodeURIComponent(topic)}&country=us&language=en`, 
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'google-news-api4.p.rapidapi.com'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle non-200 responses silently
      return [];
    }

    const data = await response.json() as RapidAPINewsResponse;

    if (!data.is_successful) {
      // Handle unsuccessful API responses silently
      return [];
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter out articles with missing required fields, older than 7 days, and map to our schema
    return (data.data?.articles || [])
      .filter(article => {
        // Filter out articles with missing required fields
        if (!article.headline || !article.external_url) return false;
        
        // Filter out articles older than 7 days
        if (article.publish_timestamp) {
          const publishDate = new Date(article.publish_timestamp * 1000);
          return publishDate >= sevenDaysAgo;
        }
        
        return true;
      })
      .map(article => {
        // Format the date
        let formattedDate = '';
        if (article.publish_timestamp) {
          const date = new Date(article.publish_timestamp * 1000);
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / (1000 * 60));
          
          if (diffMins < 60) {
            formattedDate = diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
          } else {
            const diffHrs = Math.floor(diffMins / 60);
            if (diffHrs < 24) {
              formattedDate = diffHrs === 1 ? '1 hr ago' : `${diffHrs} hrs ago`;
            } else {
              const diffDays = Math.floor(diffHrs / 24);
              formattedDate = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
            }
          }
        }
        
        return {
          title: article.headline || 'No title available',
          link: article.external_url || '#',
          date: formattedDate,
          source: article.publisher || 'Unknown Source',
          publisherIconUrl: article.publisher_icon_url || '',
          photo_url: article.photo_url || '',
        };
      });
  } catch {
    // Silently handle errors and return empty array
    return [];
  }
}

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const token = await convexAuthNextjsToken().catch(() => null); // Get token, default to null on error

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages, activeButton } = await req.json();

    // Only keep messages from the most recent user query onward.
    // This assumes that the latest user message indicates a new topic.
    const lastUserIndex = messages.map((m: Message) => m.role).lastIndexOf('user');
    const trimmedMessages = lastUserIndex !== -1 ? messages.slice(lastUserIndex) : messages;

    // Determine the search type based on the active button
    const isArticleSearch = activeButton === 'articles';
    const isNewsletterSearch = activeButton === 'newsletters';
    const isPodcastSearch = activeButton === 'podcasts';

    // Convert messages to OpenAI format
    const openAIMessages = trimmedMessages.map((message: Message) => ({
      role: message.role === 'data' ? 'assistant' : message.role,
      content: message.content,
    }));

    // Create the streamText options
    const streamOptions = {
      model: openaiClient('gpt-3.5-turbo-0125'),
      messages: openAIMessages,
      tools: {
        getArticles: {
          description: 'Get the latest news articles about a specific topic using Google News',
          parameters: jsonSchema({
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'The topic to search for in the news',
              },
            },
            required: ['topic'],
          }),
          execute: async ({ topic }: { topic: string }) => {
            try {
              const articles = await fetchArticles(topic);
              
              // Create a response object that conforms to our schema
              const response = {
                message: articles.length > 0 
                  ? `Here are some recent articles about ${topic}:` 
                  : `I couldn't find any articles that match "${topic}". Please try a different search term.`,
                articles: articles,
              };
              
              // Validate the response against our schema
              try {
                return MessageSchema.parse(response);
              } catch {
                // Return a fallback response if validation fails
                return {
                  message: `I found some information about ${topic}, but there was an issue processing it.`,
                  articles: [],
                };
              }
            } catch {
              // Return a fallback response if article fetching fails
              return {
                message: `I couldn't fetch articles about ${topic} at the moment. Please try again later.`,
                articles: [],
              };
            }
          },
        },
        getNewsletters: {
          description: 'Get newsletter entries about a specific topic from our database',
          parameters: jsonSchema({
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'The topic to search for in newsletters',
              },
            },
            required: ['topic'],
          }),
          execute: async ({ topic }: { topic: string }) => {
            try {
              const newsletters = await fetchNewsletterEntries(topic);
              
              // Create a response object that conforms to our schema
              const response = {
                message: newsletters.length > 0 
                  ? `Here are some newsletter entries about ${topic}:` 
                  : `I couldn't find any newsletter entries that match "${topic}". Please try a different search term.`,
                articles: newsletters,
              };
              
              // Validate the response against our schema
              try {
                return MessageSchema.parse(response);
              } catch {
                // Return a fallback response if validation fails
                return {
                  message: `I found some newsletter entries about ${topic}, but there was an issue processing them.`,
                  articles: [],
                };
              }
            } catch {
              // Return a fallback response if newsletter fetching fails
              return {
                message: `I couldn't fetch newsletter entries about ${topic} at the moment. Please try again later.`,
                articles: [],
              };
            }
          },
        },
        getPodcasts: {
          description: 'Get podcast episodes about a specific topic from our database',
          parameters: jsonSchema({
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'The topic to search for in podcasts',
              },
            },
            required: ['topic'],
          }),
          execute: async ({ topic }: { topic: string }) => {
            try {
              const podcasts = await fetchPodcastEntries(topic);
              
              // Create a response object that conforms to our schema
              const response = {
                message: podcasts.length > 0 
                  ? `Here are some podcast episodes about ${topic}:` 
                  : `I couldn't find any podcast episodes that match "${topic}". Please try a different search term.`,
                articles: podcasts,
              };
              
              // Validate the response against our schema
              try {
                return MessageSchema.parse(response);
              } catch {
                // Return a fallback response if validation fails
                return {
                  message: `I found some podcast episodes about ${topic}, but there was an issue processing them.`,
                  articles: [],
                };
              }
            } catch {
              // Return a fallback response if podcast fetching fails
              return {
                message: `I couldn't fetch podcast episodes about ${topic} at the moment. Please try again later.`,
                articles: [],
              };
            }
          },
        },
      },
    };
    
    // If this is an article search, add a system message to force using the getArticles tool
    if (isArticleSearch) {
      openAIMessages.unshift({
        role: 'system',
        content: 'The user is specifically looking for news articles. You MUST use the getArticles tool to search for relevant articles on their topic. IMPORTANT: Do not write any text or announce you are going to use the tool - immediately use the tool without any preamble. If no results are found, clearly tell the user that no articles match their search term and suggest they try a different search.'
      });
    }
    
    // If this is a newsletter search, add a system message to force using the getNewsletters tool
    if (isNewsletterSearch) {
      openAIMessages.unshift({
        role: 'system',
        content: 'The user is specifically looking for newsletter entries. You MUST use the getNewsletters tool to search for relevant newsletters on their topic. IMPORTANT: Do not write any text or announce you are going to use the tool - immediately use the tool without any preamble. If no results are found, clearly tell the user that no newsletters match their search term and suggest they try a different search.'
      });
    }
    
    // If this is a podcast search, add a system message to force using the getPodcasts tool
    if (isPodcastSearch) {
      openAIMessages.unshift({
        role: 'system',
        content: 'The user is specifically looking for podcast episodes. You MUST use the getPodcasts tool to search for relevant podcasts on their topic. IMPORTANT: Do not write any text or announce you are going to use the tool - immediately use the tool without any preamble. If no results are found, clearly tell the user that no podcasts match their search term and suggest they try a different search.'
      });
    }

    const result = await streamText(streamOptions);

    return result.toDataStreamResponse({
      headers: {
        'x-vercel-ai-data-stream': 'v1',
      },
    });
  } catch {
    // Return a generic error response
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request' 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
