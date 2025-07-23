import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Test query - simple SELECT to check database connectivity
    const testQuery = 'SELECT 1 as test_value, NOW() as server_time, CONNECTION_ID() as connection_id';
    
    const result = await executeRead(testQuery, []);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Check if we're using Hyperdrive Worker
    const isUsingHyperdrive = !!(process.env.HYPERDRIVE_WORKER_URL);
    const hyperdriveWorkerUrl = process.env.HYPERDRIVE_WORKER_URL || 'Not configured';
    
    return NextResponse.json({
      success: true,
      hyperdrive: {
        enabled: isUsingHyperdrive,
        workerUrl: hyperdriveWorkerUrl,
        status: isUsingHyperdrive ? 'Hyperdrive Worker configured' : 'Direct PlanetScale connection'
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
        nodeEnv: process.env.NODE_ENV,
        runtime: 'edge'
      }
    });
    
  } catch (error) {
    console.error('Hyperdrive test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hyperdrive: {
        enabled: !!(process.env.HYPERDRIVE_WORKER_URL),
        workerUrl: process.env.HYPERDRIVE_WORKER_URL || 'Not configured',
        status: 'Error occurred'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, params = [] } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Query parameter is required and must be a string'
      }, { status: 400 });
    }
    
    const startTime = Date.now();
    const result = await executeRead(query, params);
    const endTime = Date.now();
    
    return NextResponse.json({
      success: true,
      hyperdrive: {
        enabled: !!(process.env.HYPERDRIVE_WORKER_URL),
        workerUrl: process.env.HYPERDRIVE_WORKER_URL || 'Not configured'
      },
      performance: {
        queryDuration: `${endTime - startTime}ms`,
        timestamp: new Date().toISOString()
      },
      result: {
        rowCount: result.rows.length,
        affectedRows: result.rowsAffected,
        insertId: result.insertId,
        rows: result.rows.slice(0, 5) // Limit to first 5 rows for safety
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