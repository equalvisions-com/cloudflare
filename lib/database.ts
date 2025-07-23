import { connect, Connection, ExecutedQuery } from '@planetscale/database';

// Connection pool for different operations
let writeConnection: Connection | null = null;
let readConnection: Connection | null = null;

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
 * In production, this could optionally use Hyperdrive acceleration through a Worker
 */
export async function executeRead<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<ExecutedQuery> {
  // Check if we should use Hyperdrive acceleration in production
  if (process.env.NODE_ENV === 'production' && process.env.HYPERDRIVE_WORKER_URL) {
    try {
      const response = await fetch(process.env.HYPERDRIVE_WORKER_URL, {
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
          return result.data;
        }
      }
      
      // Fall back to direct connection if Hyperdrive Worker fails
      console.warn('Hyperdrive Worker failed, falling back to direct connection');
    } catch (error) {
      console.warn('Hyperdrive Worker error, falling back to direct connection:', error);
    }
  }

  // Default: Use direct PlanetScale connection
  const connection = getReadConnection();
  try {
    return await connection.execute(query, params);
  } catch (error) {
    console.error(`Read query error: ${error}`);
    throw error;
  }
}

/**
 * Execute a write query against the primary database
 * In production, this could optionally use Hyperdrive acceleration through a Worker
 */
export async function executeWrite<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<ExecutedQuery> {
  // Check if we should use Hyperdrive acceleration in production
  if (process.env.NODE_ENV === 'production' && process.env.HYPERDRIVE_WORKER_URL) {
    try {
      const response = await fetch(process.env.HYPERDRIVE_WORKER_URL, {
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
      console.warn('Hyperdrive Worker failed, falling back to direct connection');
    } catch (error) {
      console.warn('Hyperdrive Worker error, falling back to direct connection:', error);
    }
  }

  // Default: Use direct PlanetScale connection
  const connection = getWriteConnection();
  try {
    return await connection.execute(query, params);
  } catch (error) {
    console.error(`Write query error: ${error}`);
    throw error;
  }
} 