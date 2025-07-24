import { connect, Connection, ExecutedQuery } from '@planetscale/database';

// Connection pool for different operations
let writeConnection: Connection | null = null;
let readConnection: Connection | null = null;

/**
 * Check if we're running in a production environment where Hyperdrive should be used
 * 
 * ✅ EDGE RUNTIME COMPATIBLE:
 * - process.env: Available in Cloudflare Pages edge runtime
 * - globalThis: Standard Web API, available everywhere
 * - typeof checks: Standard JavaScript, works everywhere
 */
function shouldUseHyperdrive(): boolean {
  // Must have Hyperdrive Worker URL configured
  if (!process.env.HYPERDRIVE_WORKER_URL) {
    return false;
  }
  
  // Check multiple production indicators for Cloudflare Pages
  const isProd = 
    process.env.NODE_ENV === 'production' ||           // ✅ Available in edge runtime
    process.env.CF_PAGES === '1' ||                    // ✅ Cloudflare Pages indicator
    process.env.ENVIRONMENT === 'production' ||        // ✅ Custom env variable
    typeof globalThis !== 'undefined' && 
    (globalThis as any).CF_PAGES_URL;                  // ✅ Standard Web API
  
  return isProd;
}

/**
 * Get a connection to the primary (write) database
 * 
 * ✅ EDGE RUNTIME COMPATIBLE:
 * - @planetscale/database is specifically designed for edge runtime
 * - connect() function works in all JavaScript environments
 */
export function getWriteConnection(): Connection {
  if (!writeConnection) {
    writeConnection = connect({
      host: process.env.PLANETSCALE_HOST,        // ✅ Available in edge runtime
      username: process.env.PLANETSCALE_USERNAME, // ✅ Available in edge runtime
      password: process.env.PLANETSCALE_PASSWORD, // ✅ Available in edge runtime
    });
  }
  return writeConnection;
}

/**
 * Get a connection to a read replica
 * 
 * ✅ EDGE RUNTIME COMPATIBLE: Same as writeConnection
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
 * 
 * ✅ EDGE RUNTIME COMPATIBLE:
 * - fetch(): Standard Web API, available in edge runtime
 * - JSON.stringify/parse: Standard JavaScript
 * - Error handling: Standard JavaScript
 */
export async function executeRead<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
  options: { noCache?: boolean } = {}
): Promise<ExecutedQuery> {
  // Check if we should use Hyperdrive acceleration
  if (shouldUseHyperdrive()) {
    try {
      // ✅ fetch() is available in edge runtime (it's a Web Standard API)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HYPERDRIVE_WORKER_TOKEN || ''}`,
      };
      
      // Add cache-control header to bypass Hyperdrive caching if requested
      if (options.noCache) {
        headers['Cache-Control'] = 'no-store, must-revalidate';
      }
      
      const response = await fetch(process.env.HYPERDRIVE_WORKER_URL!, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          params,
          type: 'read'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return result.data;
        }
      }
      
      // Fall back to direct connection if Hyperdrive Worker fails
      console.warn('Hyperdrive Worker failed, falling back to direct PlanetScale connection');
    } catch (error) {
      console.warn('Hyperdrive Worker error, falling back to direct connection:', error);
    }
  }

  // Default: Use direct PlanetScale connection
  // ✅ @planetscale/database is edge runtime compatible
  const connection = getReadConnection();
  try {
    return await connection.execute(query, params);
  } catch (error) {
    console.error(`Database read query error: ${error}`);
    throw error;
  }
}

/**
 * Execute a write query against the primary database
 * In production, this will use Hyperdrive acceleration through a Worker
 * 
 * ✅ EDGE RUNTIME COMPATIBLE: Same APIs as executeRead
 */
export async function executeWrite<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<ExecutedQuery> {
  // Check if we should use Hyperdrive acceleration
  if (shouldUseHyperdrive()) {
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
          return result.data;
        }
      }
      
      // Fall back to direct connection if Hyperdrive Worker fails
      console.warn('Hyperdrive Worker failed, falling back to direct PlanetScale connection');
    } catch (error) {
      console.warn('Hyperdrive Worker error, falling back to direct connection:', error);
    }
  }

  // Default: Use direct PlanetScale connection
  const connection = getWriteConnection();
  try {
    return await connection.execute(query, params);
  } catch (error) {
    console.error(`Database write query error: ${error}`);
    throw error;
  }
} 