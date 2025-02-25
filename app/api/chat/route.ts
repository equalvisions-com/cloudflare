import { Message } from 'ai';
import { streamText, jsonSchema } from 'ai';
import { openai as openaiClient } from '@ai-sdk/openai';
import { Article, SerperResponse, SerperArticle, MessageSchema } from '@/app/types/article';

// Function to fetch articles from Serper.dev
async function fetchArticles(topic: string): Promise<Article[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('Serper API key is missing');

  console.log('Fetching articles for topic:', topic);

  const response = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: topic,
      num: 5 // Limit to 5 articles
    }),
  });

  if (!response.ok) {
    console.error('Serper API error:', response.status, await response.text());
    throw new Error(`Serper API request failed with status ${response.status}`);
  }

  const data = await response.json() as SerperResponse;
  console.log('Serper API response:', data);

  // Map the response to match our schema
  return (data.news || []).slice(0, 5).map((article: SerperArticle) => ({
    title: article.title,
    link: article.link,
    snippet: article.snippet || `${article.section || ''} ${article.date ? `(${article.date})` : ''}`.trim() || 'No description available',
    section: article.section,
    date: article.date?.replace(/ hour/g, ' hr').replace(/ hours/g, ' hrs')
      .replace(/ minute/g, ' min').replace(/ minutes/g, ' mins'),
    source: article.source,
    imageUrl: article.imageUrl,
    position: article.position,
  }));
}

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    console.log('Received messages:', messages);

    // Only keep messages from the most recent user query onward.
    // This assumes that the latest user message indicates a new topic.
    const lastUserIndex = messages.map((m: Message) => m.role).lastIndexOf('user');
    const trimmedMessages = lastUserIndex !== -1 ? messages.slice(lastUserIndex) : messages;
    console.log('Trimmed messages:', trimmedMessages);

    // Convert messages to OpenAI format
    const openAIMessages = trimmedMessages.map((message: Message) => ({
      role: message.role === 'data' ? 'assistant' : message.role,
      content: message.content,
    }));
    console.log('Converted OpenAI messages:', openAIMessages);

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
            console.log('Executing getArticles for topic:', topic);
            const articles = await fetchArticles(topic);
            const response = {
              message: `Here are some recent articles about ${topic}:`,
              articles: articles,
            };
            // Validate the response against our schema
            const validated = MessageSchema.parse(response);
            console.log('Validated response:', validated);
            return validated;
          },
        },
      },
    });

    console.log('Stream result:', result);

    return result.toDataStreamResponse({
      headers: {
        'x-vercel-ai-data-stream': 'v1',
      },
    });
  } catch (error) {
    console.error('Error in POST handler:', error);
    throw error;
  }
}
