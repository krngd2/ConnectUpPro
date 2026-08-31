import { NextResponse } from 'next/server'
import { checkDatabaseConnection, getDatabaseInfo, testDatabaseOperations } from '@/lib/db-health'
import { checkDatabaseHealth } from '@/lib/db'

export async function GET() {
  try {
    // Check basic connectivity with our new functions
    const basicHealth = await checkDatabaseHealth()

    if (!basicHealth) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database connection failed',
          basicHealth,
        },
        { status: 503 }
      )
    }

    // Check detailed connectivity
    const connectionResult = await checkDatabaseConnection()

    if (!connectionResult.connected) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database connection failed',
          error: connectionResult.error
        },
        { status: 503 }
      )
    }

    // Get database info
    const dbInfo = await getDatabaseInfo()

    // Test operations
    const operationsTest = await testDatabaseOperations()

    // Utility to safely serialize BigInt values  
    function replacer(key: string, value: unknown) {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }

    const response = {
      status: 'healthy',
      message: 'Database is working correctly',
      connection: connectionResult,
      database: dbInfo,
      operations: operationsTest,
      basicHealth,
      timestamp: new Date().toISOString()
    };
    return NextResponse.json(JSON.parse(JSON.stringify(response, replacer)));

  } catch (error) {
    console.error('Health check failed:', error)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorDetails: Record<string, any> = {
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    if (error instanceof Error) {
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
      errorDetails.cause = (error as unknown as { cause?: unknown }).cause || null;
      errorDetails.full = JSON.stringify(error, Object.getOwnPropertyNames(error));
    } else {
      errorDetails.raw = error;
    }
    return NextResponse.json(errorDetails, { status: 500 })
  }
}
