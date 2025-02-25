import { Message } from 'ai';
import { streamText, jsonSchema } from 'ai';
import { openai as openaiClient } from '@ai-sdk/openai';
import { Article, RapidAPINewsResponse, MessageSchema } from '@/app/types/article';

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
      console.error('RapidAPI Google News error:', response.status);
      throw new Error(`RapidAPI request failed with status ${response.status}`);
    }

    const data = await response.json() as RapidAPINewsResponse;

    if (!data.is_successful) {
      console.error('RapidAPI returned unsuccessful response:', data.message);
      throw new Error(`RapidAPI request was unsuccessful: ${data.message}`);
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter out articles with missing required fields, older than 7 days, and map to our schema
    return (data.data?.articles || [])
      .filter(article => {
        // Filter out articles with missing required fields
        if (!article || !article.headline || !article.external_url) return false;
        
        // Filter out articles older than 7 days
        if (article.publish_timestamp) {
          const publishDate = new Date(article.publish_timestamp * 1000);
          return publishDate >= sevenDaysAgo;
        }
        
        // If no timestamp, include the article (assume it's recent)
        return true;
      })
      .slice(0, 15) // Take up to 15 articles
      .map((article) => {
        // Format the date if available
        let formattedDate = '';
        if (article.publish_timestamp) {
          const date = new Date(article.publish_timestamp * 1000);
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / (1000 * 60));
          
          if (diffMins < 60) {
            // For articles less than an hour old
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
          source: article.publisher || '',
          publisherIconUrl: article.publisher_icon_url || '',
        };
      });
  } catch (error) {
    console.error('Error fetching articles:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Only keep messages from the most recent user query onward.
    // This assumes that the latest user message indicates a new topic.
    const lastUserIndex = messages.map((m: Message) => m.role).lastIndexOf('user');
    const trimmedMessages = lastUserIndex !== -1 ? messages.slice(lastUserIndex) : messages;

    // Convert messages to OpenAI format
    const openAIMessages = trimmedMessages.map((message: Message) => ({
      role: message.role === 'data' ? 'assistant' : message.role,
      content: message.content,
    }));

    const result = await streamText({
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
                  : `I couldn't find any recent articles about ${topic} from the past week. Please try a different topic.`,
                articles: articles,
              };
              
              // Validate the response against our schema
              try {
                return MessageSchema.parse(response);
              } catch (validationError) {
                console.error('Validation error:', validationError);
                // Return a fallback response if validation fails
                return {
                  message: `I found some information about ${topic}, but there was an issue processing it.`,
                  articles: [],
                };
              }
            } catch (error) {
              console.error('Error in getArticles tool:', error instanceof Error ? error.message : 'Unknown error');
              // Return a fallback response if article fetching fails
              return {
                message: `I couldn't fetch articles about ${topic} at the moment. Please try again later.`,
                articles: [],
              };
            }
          },
        },
      },
    });

    return result.toDataStreamResponse({
      headers: {
        'x-vercel-ai-data-stream': 'v1',
      },
    });
  } catch (error) {
    console.error('Error in POST handler:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request' 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
