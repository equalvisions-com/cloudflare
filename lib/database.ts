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
 */
export async function executeRead<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<ExecutedQuery> {
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
 */
export async function executeWrite<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<ExecutedQuery> {
  const connection = getWriteConnection();
  try {
    return await connection.execute(query, params);
  } catch (error) {
    console.error(`Write query error: ${error}`);
    throw error;
  }
} 