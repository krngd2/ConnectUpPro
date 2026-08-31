import { prisma } from '@/lib/db'

export async function checkDatabaseConnection() {
  try {
    // Simple connectivity test
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection successful')
    return { connected: true, error: null }
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    }
  }
}

export async function getDatabaseInfo() {
  try {
    // Get connection info
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`
    const connectionCount = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
    `
    
    return {
      version: result[0]?.version || 'Unknown',
      activeConnections: connectionCount[0]?.count || 0,
      status: 'healthy'
    }
  } catch (error) {
    return {
      version: 'Unknown',
      activeConnections: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function testDatabaseOperations() {
  try {
    // Test basic read operation
    const userCount = await prisma.user.count()
    
    // Test basic aggregation
    const videoCount = await prisma.video.count()
    
    return {
      success: true,
      userCount,
      videoCount,
      message: 'All database operations working correctly'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database operation failed',
      userCount: 0,
      videoCount: 0
    }
  }
}
