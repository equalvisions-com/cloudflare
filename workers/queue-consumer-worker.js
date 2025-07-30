// workers/queue-consumer-worker.js
// Cloudflare Worker to consume queue messages and forward to Pages Function
// This is the bridge between Cloudflare Queues and your Next.js API routes

export default {
  async queue(batch, env) {
    console.log(`🔄 QUEUE WORKER: Processing ${batch.messages.length} messages`);

    try {
      // Forward all messages to the Pages Function API endpoint
      const response = await fetch(`${env.PAGES_FUNCTION_URL}/api/queue-consumer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.PAGES_FUNCTION_TOKEN || ''}`,
        },
        body: JSON.stringify({
          messages: batch.messages.map(msg => ({
            id: msg.id,
            timestamp: msg.timestamp,
            body: msg.body
          }))
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ QUEUE WORKER: Successfully processed batch:`, result);
        
        // Acknowledge all messages
        for (const message of batch.messages) {
          message.ack();
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ QUEUE WORKER: API call failed:`, response.status, errorText);
        
        // Retry messages
        for (const message of batch.messages) {
          message.retry();
        }
      }
    } catch (error) {
      console.error('❌ QUEUE WORKER: Error processing batch:', error);
      
      // Retry all messages on error
      for (const message of batch.messages) {
        message.retry();
      }
    }
  },

  async fetch(request, env) {
    return new Response('Queue Consumer Worker', { status: 200 });
  }
};