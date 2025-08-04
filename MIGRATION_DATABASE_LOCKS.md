# Database Locking Migration Guide

This guide walks through migrating from KV-based locks to database-level atomic operations for RSS feed processing.

## ✅ Prerequisites Completed

1. **Database Schema Updated**: `processing_until` column added to `rss_feeds` table
2. **New Files Created**:
   - `lib/feed-locks.ts` - Production-ready database locking utility
   - `cloudflare-workers/enhanced-queue-consumer-worker-v2.js` - Updated worker with database locks
   - `app/api/queue-consumer/route-v2.ts` - Updated API route with database locks

## 🚀 Migration Steps

### Step 1: Deploy New Database Locking Utility
The `lib/feed-locks.ts` file is ready for production and provides:
- Atomic lock acquisition with staleness checking
- Proper error handling and logging
- Lock cleanup and monitoring functions
- Enterprise-grade TypeScript implementation

### Step 2: Update Cloudflare Worker
Replace your current enhanced queue consumer worker:

```bash
# Backup current worker
cp cloudflare-workers/enhanced-queue-consumer-worker.js cloudflare-workers/enhanced-queue-consumer-worker-backup.js

# Deploy new version
cp cloudflare-workers/enhanced-queue-consumer-worker-v2.js cloudflare-workers/enhanced-queue-consumer-worker.js
```

### Step 3: Update Queue Consumer API Route
Replace your current API route:

```bash
# Backup current route
cp app/api/queue-consumer/route.ts app/api/queue-consumer/route-backup.ts

# Deploy new version
cp app/api/queue-consumer/route-v2.ts app/api/queue-consumer/route.ts
```

### Step 4: Remove KV Lock Dependencies

#### A. Update `lib/featured_kv.ts`
Remove KV locking code from featured cache:

```typescript
// REMOVE these functions:
// - acquireFeedRefreshLock()
// - releaseFeedRefreshLock()

// REPLACE with direct cache operations (no locking needed for cache)
```

#### B. Clean Up Environment Variables
Remove these from your Cloudflare Pages environment:
- Any KV bindings used specifically for locks
- Keep KV bindings used for actual caching

#### C. Remove Lock Cleanup Scripts
Delete any cron jobs or scripts that clean up KV locks.

## 🧪 Testing

### Test 1: Basic Lock Functionality
```typescript
import { acquireFeedLock, releaseFeedLock } from '@/lib/feed-locks';

// Test lock acquisition
const result = await acquireFeedLock('https://example.com/feed');
console.log('Lock acquired:', result.acquired);

// Test lock release
await releaseFeedLock('https://example.com/feed', true);
```

### Test 2: Race Condition Prevention
Run multiple workers simultaneously and verify only one processes each feed.

### Test 3: Lock Timeout
Simulate worker crash and verify locks expire after 5 minutes.

### Test 4: Staleness Check
Verify feeds are only processed if last_fetched > 4 hours ago.

## 📊 Performance Benefits

### Before (KV Locks)
- **Lock Acquisition**: 2 KV operations (GET + PUT) = ~100ms
- **Lock Release**: 1 KV operation (DELETE) = ~50ms
- **Network Overhead**: 3 round trips per feed
- **Cost**: KV read/write operations billed separately

### After (Database Locks)
- **Lock Acquisition**: 1 atomic SQL UPDATE = ~50ms
- **Lock Release**: 1 SQL UPDATE = ~50ms  
- **Network Overhead**: Reuses existing database connection
- **Cost**: Included in existing database usage

**Total Savings**: ~100ms per feed + eliminated KV costs

## 🔍 Monitoring

### Key Metrics to Monitor
1. **Lock Acquisition Rate**: Should be ~100% for stale feeds
2. **Lock Timeout Rate**: Should be <1% (indicates worker crashes)
3. **Average Processing Time**: Should decrease by ~100ms per feed
4. **Database Connection Usage**: Should remain stable

### Useful Queries
```sql
-- Check current locks
SELECT feed_url, processing_until, last_fetched 
FROM rss_feeds 
WHERE processing_until > UNIX_TIMESTAMP();

-- Check lock distribution
SELECT 
  COUNT(*) as total_feeds,
  SUM(CASE WHEN processing_until > UNIX_TIMESTAMP() THEN 1 ELSE 0 END) as locked_feeds,
  SUM(CASE WHEN last_fetched < UNIX_TIMESTAMP() - 14400 THEN 1 ELSE 0 END) as stale_feeds
FROM rss_feeds;

-- Performance metrics
SELECT 
  feed_url,
  last_fetched,
  processing_until,
  FROM_UNIXTIME(last_fetched) as last_fetched_readable,
  FROM_UNIXTIME(processing_until) as processing_until_readable
FROM rss_feeds 
ORDER BY last_fetched DESC 
LIMIT 10;
```

## 🚨 Rollback Plan

If issues occur, quickly rollback:

```bash
# Restore original files
cp cloudflare-workers/enhanced-queue-consumer-worker-backup.js cloudflare-workers/enhanced-queue-consumer-worker.js
cp app/api/queue-consumer/route-backup.ts app/api/queue-consumer/route.ts

# Redeploy
# Your KV locks will still work during rollback
```

## ✅ Success Criteria

Migration is successful when:
1. ✅ RSS feeds process without race conditions
2. ✅ Average processing time per feed decreases
3. ✅ No increase in database connection errors
4. ✅ Lock timeout rate < 1%
5. ✅ KV operation costs eliminated

## 🔧 Maintenance

### Regular Maintenance Tasks

1. **Monitor Lock Health** (weekly):
```typescript
import { cleanupExpiredLocks } from '@/lib/feed-locks';
const cleaned = await cleanupExpiredLocks();
console.log(`Cleaned ${cleaned} expired locks`);
```

2. **Performance Review** (monthly):
   - Review lock acquisition patterns
   - Adjust lock duration if needed
   - Monitor database connection usage

3. **Database Optimization** (quarterly):
   - Add indexes if query performance degrades
   - Consider archiving old lock data

## 🎯 Expected Outcomes

After migration:
- **Reduced Complexity**: Eliminated separate KV lock management
- **Better Performance**: ~100ms faster per feed
- **Cost Savings**: Eliminated KV lock operations
- **Improved Reliability**: Atomic database operations vs eventual consistency
- **Better Monitoring**: All operations visible in database logs

The new system leverages MySQL's ACID properties for bulletproof race condition prevention while simplifying the architecture and reducing costs.