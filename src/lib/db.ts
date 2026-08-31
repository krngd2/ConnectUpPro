import { PrismaClient } from '@prisma/client'

// Declare global type
declare global {
  var __prisma: PrismaClient | undefined
}

// Create a single Prisma client instance with better connection handling
const createPrismaClient = () => {
  // Check if there's already a global instance
  if (globalThis.__prisma) {
    console.log('[DB] Reusing existing global PrismaClient instance')
    return globalThis.__prisma
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    errorFormat: 'pretty',
  })

  // In development, add connection monitoring
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] Creating new PrismaClient instance')

    // Monitor for connection issues
    client.$on('error', (e) => {
      console.error('[DB] Prisma error:', e)
    })
  }

  // Store globally immediately
  globalThis.__prisma = client
  return client
}

// Use global variable to store Prisma client
export const prisma = createPrismaClient()

// Simple health check function
export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('[DB] Health check failed:', error)

    // If engine is not connected, try to restart the connection
    // if (error instanceof Error && error.message.includes('Engine is not yet connected')) {
    //   console.log('[DB] Attempting to reconnect...')
    //   try {
    //     // Force a new connection attempt
    //     await prisma.$disconnect()
    //     await prisma.$connect()
    //     await prisma.$queryRaw`SELECT 1`
    //     console.log('[DB] Reconnection successful')
    //     return true
    //   } catch (reconnectError) {
    //     console.error('[DB] Reconnection failed:', reconnectError)
    //     return false
    //   }
    // }

    return false
  }
}

// Function to check if an error is database-related (for debugging)
export function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  const errorName = error.name?.toLowerCase() || ''

  return (
    message.includes('engine is not yet connected') ||
    message.includes('prisma engine') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('timeout') ||
    message.includes('client initialization') ||
    errorName.includes('prismaclientunknownrequesterror') ||
    errorName.includes('prismaclientinitializationerror') ||
    errorName.includes('prismaclientconnectionerror')
  )
}
