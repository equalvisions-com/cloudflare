import { connect, Connection, ExecutedQuery } from '@planetscale/database';

// Connection pool for different operations
let writeConnection: Connection | null = null;
let readConnection: Connection | null = null;

/**
 * Check if we're running in a production environment where Hyperdrive should be used
 * In Cloudflare Pages, we need to check multiple indicators, not just NODE_ENV
 */
function shouldUseHyperdrive(): boolean {
  // Must have Hyperdrive Worker URL configured
  if (!process.env.HYPERDRIVE_WORKER_URL) {
    return false;
  }
  
  // Check multiple production indicators for Cloudflare Pages
  const isProd = 
    process.env.NODE_ENV === 'production' ||           // Standard Node.js env
    process.env.CF_PAGES === '1' ||                    // Cloudflare Pages indicator
    process.env.ENVIRONMENT === 'production' ||        // Custom env variable
    typeof globalThis !== 'undefined' && 
    (globalThis as any).CF_PAGES_URL;                  // CF Pages runtime global
  
  return isProd;
}

/**
 * Get a connection to the primary (write) database
 */
export function getWriteConnection(): Connection {
  if (!writeConnection) {
    writeConnection = connect({
      host: process.env.PLANETSCALE_HOST,
      username: process.env.PLANETSCALE_USERNAME,
      password: process.env.PLANETSCALE_PASSWORD,
    });
  }
  return writeConnection;
}

/**
 * Get a connection to a read replica
 */
export function getReadConnection(): Connection {
  if (!readConnection) {
    readConnection = connect({
      host: process.env.REPLICA_DATABASE_HOST || process.env.PLANETSCALE_HOST,
      username: process.env.REPLICA_DATABASE_USERNAME || process.env.PLANETSCALE_USERNAME,
      password: process.env.REPLICA_DATABASE_PASSWORD || process.env.PLANETSCALE_PASSWORD,
    });
  }
  return readConnection;
}

/**
 * Execute a read query against a replica
 * In production, this will use Hyperdrive acceleration through a Worker
 */
export async function executeRead<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<ExecutedQuery> {
  // Check if we should use Hyperdrive acceleration
  if (shouldUseHyperdrive()) {
    console.log('🚀 HYPERDRIVE: Using Hyperdrive Worker for read query');
    
    try {
      const response = await fetch(process.env.HYPERDRIVE_WORKER_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HYPERDRIVE_WORKER_TOKEN || ''}`,
        },
        body: JSON.stringify({
          query,
          params,
          type: 'read'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('✅ HYPERDRIVE: Query successful via Hyperdrive Worker');
          return result.data;
        } else {
          console.warn('⚠️ HYPERDRIVE: Worker returned unsuccessful result:', result);
        }
      } else {
        console.warn('⚠️ HYPERDRIVE: Worker response not ok:', response.status, response.statusText);
      }
      
      // Fall back to direct connection if Hyperdrive Worker fails
      console.warn('🔄 HYPERDRIVE: Falling back to direct PlanetScale connection');
    } catch (error) {
      console.warn('❌ HYPERDRIVE: Worker error, falling back to direct connection:', error);
    }
  } else {
    console.log('🔗 PLANETSCALE: Using direct PlanetScale connection (Hyperdrive not configured)');
  }

  // Default: Use direct PlanetScale connection
  const connection = getReadConnection();
  try {
    const result = await connection.execute(query, params);
    console.log('✅ PLANETSCALE: Query successful via direct connection');
    return result;
  } catch (error) {
    console.error(`❌ PLANETSCALE: Read query error: ${error}`);
    throw error;
  }
}

/**
 * Execute a write query against the primary database
 * In production, this will use Hyperdrive acceleration through a Worker
 */
export async function executeWrite<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<ExecutedQuery> {
  // Check if we should use Hyperdrive acceleration
  if (shouldUseHyperdrive()) {
    console.log('🚀 HYPERDRIVE: Using Hyperdrive Worker for write query');
    
    try {
      const response = await fetch(process.env.HYPERDRIVE_WORKER_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HYPERDRIVE_WORKER_TOKEN || ''}`,
        },
        body: JSON.stringify({
          query,
          params,
          type: 'write'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('✅ HYPERDRIVE: Write query successful via Hyperdrive Worker');
          return result.data;
        } else {
          console.warn('⚠️ HYPERDRIVE: Worker returned unsuccessful result:', result);
        }
      } else {
        console.warn('⚠️ HYPERDRIVE: Worker response not ok:', response.status, response.statusText);
      }
      
      // Fall back to direct connection if Hyperdrive Worker fails
      console.warn('🔄 HYPERDRIVE: Falling back to direct PlanetScale connection');
    } catch (error) {
      console.warn('❌ HYPERDRIVE: Worker error, falling back to direct connection:', error);
    }
  } else {
    console.log('🔗 PLANETSCALE: Using direct PlanetScale connection (Hyperdrive not configured)');
  }

  // Default: Use direct PlanetScale connection
  const connection = getWriteConnection();
  try {
    const result = await connection.execute(query, params);
    console.log('✅ PLANETSCALE: Write query successful via direct connection');
    return result;
  } catch (error) {
    console.error(`❌ PLANETSCALE: Write query error: ${error}`);
    throw error;
  }
} 