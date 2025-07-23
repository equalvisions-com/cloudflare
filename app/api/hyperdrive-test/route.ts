import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';

export const runtime = 'edge';

// Environment detection function (duplicated from database.ts for testing)
function shouldUseHyperdrive(): boolean {
  if (!process.env.HYPERDRIVE_WORKER_URL) {
    return false;
  }
  
  const isProd = 
    process.env.NODE_ENV === 'production' ||
    process.env.CF_PAGES === '1' ||
    process.env.ENVIRONMENT === 'production' ||
    typeof globalThis !== 'undefined' && 
    (globalThis as any).CF_PAGES_URL;
  
  return isProd;
}

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Test query - simple SELECT to check database connectivity
    const testQuery = 'SELECT 1 as test_value, NOW() as server_time, CONNECTION_ID() as connection_id';
    
    const result = await executeRead(testQuery, []);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const isHyperdriveEnabled = shouldUseHyperdrive();
    
    return NextResponse.json({
      success: true,
      hyperdrive: {
        enabled: isHyperdriveEnabled,
        status: isHyperdriveEnabled 
          ? 'Hyperdrive acceleration active' 
          : 'Direct PlanetScale connection',
        workerConfigured: !!process.env.HYPERDRIVE_WORKER_URL,
        tokenConfigured: !!process.env.HYPERDRIVE_WORKER_TOKEN
      },
      performance: {
        queryDuration: `${duration}ms`,
        timestamp: new Date().toISOString()
      },
      database: {
        testValue: (result.rows[0] as any)?.test_value,
        serverTime: (result.rows[0] as any)?.server_time,
        connectionId: (result.rows[0] as any)?.connection_id,
        rowCount: result.rows.length
      },
      environment: {
        runtime: 'edge',
        nodeEnv: process.env.NODE_ENV,
        cfPages: process.env.CF_PAGES
      }
    });
    
  } catch (error) {
    console.error('Hyperdrive test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hyperdrive: {
        enabled: shouldUseHyperdrive(),
        workerConfigured: !!process.env.HYPERDRIVE_WORKER_URL,
        tokenConfigured: !!process.env.HYPERDRIVE_WORKER_TOKEN
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, params = [] } = await request.json();
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query is required'
      }, { status: 400 });
    }
    
    const startTime = Date.now();
    const result = await executeRead(query, params);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return NextResponse.json({
      success: true,
      result: {
        rows: result.rows,
        rowCount: result.rows.length,
        insertId: result.insertId
      },
      performance: {
        queryDuration: `${duration}ms`,
        timestamp: new Date().toISOString()
      },
      hyperdrive: {
        enabled: shouldUseHyperdrive()
      }
    });
    
  } catch (error) {
    console.error('Custom query test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 