import { createConnection } from 'mysql2/promise';

// Define only the types we need to avoid conflicts with Next.js
interface Hyperdrive {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}

export interface Env {
  HYPERDRIVE?: Hyperdrive;
  // For local development fallback
  DB_HOST?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  DB_PORT?: number;
  // Authentication
  WORKER_TOKEN?: string;
}

interface QueryRequest {
  query: string;
  params?: unknown[];
  type: 'read' | 'write';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only allow POST requests for database queries
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed',
        success: false
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      // Simple authentication check
      const authHeader = request.headers.get('Authorization');
      if (env.WORKER_TOKEN && authHeader !== `Bearer ${env.WORKER_TOKEN}`) {
        return new Response(JSON.stringify({
          error: 'Unauthorized',
          success: false
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Parse the request body
      let queryRequest: QueryRequest;
      try {
        queryRequest = await request.json();
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Invalid JSON in request body',
          success: false
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const { query, params = [], type } = queryRequest;

      if (!query || typeof query !== 'string') {
        return new Response(JSON.stringify({
          error: 'Query is required and must be a string',
          success: false
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      let connection;
      let connectionType = "unknown";

      if (env.HYPERDRIVE) {
        // Production: Use Hyperdrive binding
        connectionType = "hyperdrive";
        connection = await createConnection({
          host: env.HYPERDRIVE.host,
          user: env.HYPERDRIVE.user,
          password: env.HYPERDRIVE.password,
          database: env.HYPERDRIVE.database,
          port: env.HYPERDRIVE.port,
          disableEval: true
        });
      } else {
        // Local development: Use environment variables
        connectionType = "local";
        connection = await createConnection({
          host: env.DB_HOST,
          user: env.DB_USER,
          password: env.DB_PASSWORD,
          database: env.DB_NAME,
          port: env.DB_PORT,
          disableEval: true
        });
      }

      // Execute the query
      const [results, fields] = await connection.query(query, params);

      // Convert mysql2 result format to match PlanetScale format for compatibility
      const planetScaleCompatibleResult = {
        rows: Array.isArray(results) ? results : [results],
        fields: fields || [],
        insertId: (results as any)?.insertId || null,
        rowsAffected: (results as any)?.affectedRows || 0
      };

      // Clean up the connection
      ctx.waitUntil(connection.end());

      return new Response(JSON.stringify({
        success: true,
        connectionType,
        data: planetScaleCompatibleResult,
        queryType: type
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        success: false
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
}; 