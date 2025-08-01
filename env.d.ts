// env.d.ts - TypeScript declarations for Cloudflare bindings

interface CloudflareEnv {
  KV_BINDING: KVNamespace; // Dedicated locks KV namespace
  BATCH_STATUS_DO: DurableObjectNamespace; // Real-time SSE via Durable Objects
  KVFEATURED: KVNamespace;
  QUEUE: Queue;
}