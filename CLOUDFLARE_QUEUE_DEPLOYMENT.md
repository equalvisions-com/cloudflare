# Cloudflare Queue RSS Refresh System Deployment Guide

## Overview

This guide walks you through deploying the new Cloudflare Queue-based RSS refresh system that provides better performance, batching, and scalability compared to the previous direct API approach.

## Architecture

```
Frontend → Queue Producer API → Cloudflare Queue → Queue Consumer Worker → RSS Processing
     ↓                                                        ↓
Status Polling ←←←←←←←←←←←←←←←←←←← Queue Results ←←←←←←←←←←←←←←←←
```

### Key Benefits

- **Batching**: Multiple refresh requests are automatically batched together
- **Better Performance**: Non-blocking queue processing with polling for results
- **Scalability**: Cloudflare Queues can handle high-volume requests
- **Retry Logic**: Built-in retry mechanisms with dead letter queues
- **Reliability**: Failed jobs are automatically retried with exponential backoff

## Prerequisites

1. Existing Cloudflare Queue: `refresh-feed` (✅ Already configured)
2. Queue binding: `QUEUE` (✅ Already configured)
3. Cloudflare Workers environment with your existing project

## Deployment Steps

### 1. Configure Cloudflare Queue Consumer

Your queue consumer configuration (already in `wrangler.toml`):

```toml
[[queues.consumers]]
queue = "refresh-feed"
max_batch_size = 10
max_batch_timeout = 5
max_retries = 3
dead_letter_queue = "refresh-feed-dlq"
```

### 2. Deploy the Queue Consumer Worker

```bash
# Deploy the queue consumer
wrangler deploy

# Verify queue consumer is configured
wrangler queues consumer list
```

### 3. Update Environment Variables

Add these to your Cloudflare Pages environment variables:

```env
# Optional: KV namespace for storing queue results
QUEUE_RESULTS_KV_ID=your-kv-namespace-id

# Queue configuration
QUEUE_NAME=refresh-feed
QUEUE_MAX_BATCH_SIZE=10
QUEUE_MAX_RETRIES=3
```

### 4. Configure Queue Binding in Pages

In your Cloudflare Pages dashboard:

1. Go to **Settings** → **Functions**
2. Add **Queue Producer Binding**:
   - Variable name: `QUEUE`
   - Queue name: `refresh-feed`

### 5. Deploy Pages with New Code

```bash
# Build and deploy your Next.js application
npm run build
# Pages will automatically deploy via your existing CI/CD

# Or manually if needed
wrangler pages publish dist
```

## API Endpoints

### Queue Producer: `/api/queue-refresh`

**POST** - Queue a refresh request
```json
{
  "postTitles": ["Feed 1", "Feed 2"],
  "feedUrls": ["https://example.com/feed1", "https://example.com/feed2"],
  "mediaTypes": ["newsletter", "podcast"],
  "priority": "normal",
  "existingGuids": ["guid1", "guid2"],
  "newestEntryDate": "2024-01-15T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "batchId": "batch_1234567890_abc123",
  "status": "queued",
  "queuedAt": 1642248000000,
  "estimatedProcessingTime": 2500,
  "message": "Queued 2 feeds for refresh"
}
```

**GET** - Check batch status
```bash
GET /api/queue-refresh?batchId=batch_1234567890_abc123
```

**Response:**
```json
{
  "batchId": "batch_1234567890_abc123",
  "status": "completed",
  "queuedAt": 1642248000000,
  "processedAt": 1642248001000,
  "completedAt": 1642248003000,
  "result": {
    "success": true,
    "refreshedAny": true,
    "entries": [...],
    "newEntriesCount": 5,
    "totalEntries": 150,
    "processingTimeMs": 2000
  }
}
```

### Queue Consumer: `/api/queue-consumer`

This endpoint is called automatically by Cloudflare Queues. You don't need to call it directly.

## Frontend Integration

The frontend now uses the `useRSSEntriesQueueRefresh` hook which:

1. **Queues refresh requests** instead of making direct API calls
2. **Polls for completion** every 2 seconds until the batch is processed
3. **Handles results** when the queue processing is complete
4. **Manages timeouts** and error states

### Key Changes

```typescript
// Old: Direct API call
const response = await fetch('/api/refresh-feeds', { ... });

// New: Queue-based with polling
const queueResponse = await fetch('/api/queue-refresh', { ... });
// Then poll for completion
setInterval(() => pollBatchStatus(batchId), 2000);
```

## Monitoring and Debugging

### 1. Queue Metrics

Check queue metrics in Cloudflare dashboard:
- **Queues** → **refresh-feed** → **Metrics**
- Monitor: Messages sent, processed, failed, DLQ usage

### 2. Worker Logs

View consumer worker logs:
```bash
wrangler tail --queue refresh-feed
```

### 3. Developer Tools

In browser console, you can debug:
```javascript
// Check current batch status
const batch = window.debugQueueStatus?.getCurrentBatch();
console.log('Current batch:', batch);

// Check if polling is active
const isPolling = window.debugQueueStatus?.isPolling();
console.log('Is polling:', isPolling);
```

## Error Handling

### Queue Failures

1. **Messages sent to DLQ**: Check `refresh-feed-dlq` queue
2. **Processing timeouts**: Increase `max_batch_timeout` if needed
3. **Consumer errors**: Check worker logs and fix issues

### Frontend Fallback

If queue system fails, the app gracefully falls back to:
1. Show error message to user
2. Allow manual retry
3. Clear polling state

## Performance Tuning

### Queue Configuration

Adjust based on your traffic:

```toml
# High traffic
max_batch_size = 20
max_batch_timeout = 3

# Low traffic
max_batch_size = 5
max_batch_timeout = 10
```

### Polling Frequency

Adjust client polling based on expected processing time:

```typescript
// Fast polling for small batches
const pollInterval = feedCount < 5 ? 1000 : 2000;

// Adaptive polling
const adaptivePollInterval = Math.min(feedCount * 200, 5000);
```

## Testing

### 1. Local Testing

```bash
# Test queue producer locally
curl -X POST http://localhost:3000/api/queue-refresh \
  -H "Content-Type: application/json" \
  -d '{"postTitles":["Test"],"feedUrls":["https://example.com/feed"]}'
```

### 2. Queue Consumer Testing

```bash
# Simulate queue message
wrangler queues consumer send refresh-feed \
  --body '{"batchId":"test","feeds":[...]}'
```

### 3. Integration Testing

1. Follow/unfollow feeds in the UI
2. Verify refresh requests are queued
3. Check batch completion and result display
4. Test error scenarios (network failures, etc.)

## Migration from Direct API

The new system is **backward compatible**. Both systems can run simultaneously:

1. Deploy queue system
2. Test with subset of users
3. Gradually migrate all refresh requests
4. Deprecate `/api/refresh-feeds` when ready

## Troubleshooting

### Common Issues

1. **Queue binding not found**
   - Verify `QUEUE` binding in Pages Functions settings
   - Check queue name matches (`refresh-feed`)

2. **Consumer not processing**
   - Verify wrangler deployment succeeded
   - Check worker logs for errors
   - Ensure queue consumer configuration is correct

3. **Polling never completes**
   - Check batch status API responses
   - Verify consumer is running and processing messages
   - Look for errors in queue consumer logs

4. **High latency**
   - Adjust `max_batch_timeout` for faster processing
   - Reduce `max_batch_size` for smaller batches
   - Optimize RSS parsing logic in consumer

### Support

For issues:
1. Check Cloudflare Dashboard → Queues → Metrics
2. Review Worker logs via `wrangler tail`
3. Test individual components (producer, consumer, polling)
4. Contact Cloudflare support for queue-specific issues

## Next Steps

1. **Metrics Integration**: Add custom metrics to track queue performance
2. **Advanced Batching**: Implement intelligent batching based on feed types
3. **Caching**: Add KV-based caching for queue results
4. **Webhooks**: Replace polling with webhook notifications for faster updates
5. **Analytics**: Track refresh patterns and optimize queue parameters 