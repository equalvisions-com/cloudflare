// Cloudflare Worker to consume queue messages and forward to Pages
export default {
  async queue(batch, env) {
    console.log(`🔄 WORKER: Processing ${batch.messages.length} messages from queue`);
    
    try {
      // Extract message bodies from the batch
      const messages = batch.messages.map(msg => ({
        body: msg.body,
        id: msg.id,
        timestamp: msg.timestamp
      }));

      console.log(`📤 WORKER: Forwarding ${messages.length} messages to Pages endpoint`);

      // Forward messages to your Pages Function endpoint
      const response = await fetch('https://socialnetworksandbox.com/api/queue-consumer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CloudflareWorker-QueueConsumer'
        },
        body: JSON.stringify({
          messages: messages
        })
      });

      if (!response.ok) {
        console.error(`❌ WORKER: Pages endpoint error: ${response.status}`);
        throw new Error(`Pages endpoint returned ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ WORKER: Successfully processed batch`, result);

      // Acknowledge all messages in the batch
      batch.messages.forEach(message => {
        message.ack();
      });

    } catch (error) {
      console.error('❌ WORKER: Error processing batch:', error);
      
      // Retry failed messages (Cloudflare will automatically retry)
      batch.messages.forEach(message => {
        message.retry();
      });
      
      throw error;
    }
  }
};