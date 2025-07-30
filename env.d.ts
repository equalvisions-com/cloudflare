// env.d.ts - TypeScript declarations for Cloudflare bindings

interface CloudflareEnv {
  BATCH_STATUS: KVNamespace;
  BATCH_STATUS_DO: DurableObjectNamespace;
  KVFEATURED: KVNamespace;
  QUEUE: Queue;
}