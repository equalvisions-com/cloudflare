/// <reference types="@cloudflare/workers-types" />

import { createConnection } from 'mysql2/promise';

export interface Env {
  HYPERDRIVE?: Hyperdrive;
  // For local development fallback
  DB_HOST?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  DB_PORT?: number;
}

export default {
 async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
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

          // This is needed to use mysql2 with Workers
          // This configures mysql2 to use static parsing instead of eval() parsing (not available on Workers)
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

          // This is needed to use mysql2 with Workers
          // This configures mysql2 to use static parsing instead of eval() parsing (not available on Workers)
          disableEval: true
        });
      }

      const [results, fields] = await connection.query('SHOW tables;');

      // Clean up the connection
      ctx.waitUntil(connection.end());

      return new Response(JSON.stringify({ 
        success: true,
        connectionType,
        results, 
        fields 
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
        },
      });
    }
 },
} satisfies ExportedHandler<Env>; 