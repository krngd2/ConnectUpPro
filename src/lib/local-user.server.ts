import type { User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { seedDefaultSemanticSearches } from '@/lib/default-semantic-searches';

// The database schema keeps ownership relationships so the app can evolve to
// multi-user support later. For the local open-source edition there is one
// workspace owner and no sign-in flow.
const DEFAULT_LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_LOCAL_USER_EMAIL = 'local@connectuppro.local';
const DEFAULT_LOCAL_USER_NAME = 'Local Workspace';

let defaultSearchSeed: Promise<void> | null = null;

async function ensureDefaultSemanticSearches(userId: string) {
  if (defaultSearchSeed) return defaultSearchSeed;

  defaultSearchSeed = (async () => {
    const existingDefault = await prisma.semanticSearch.findFirst({
      where: { userId, isDefault: true },
      select: { id: true },
    });

    if (!existingDefault) {
      await seedDefaultSemanticSearches(userId);
    }
  })().catch((error) => {
    // Seeding is helpful but should never prevent the dashboard from loading.
    console.error('[LOCAL_USER] Failed to seed default semantic searches:', error);
    defaultSearchSeed = null;
  });

  return defaultSearchSeed;
}

/**
 * Returns the owner of this local installation, creating it on first run.
 *
 * Existing databases created by the hosted version may already contain a
 * single user. Reusing that user keeps its projects visible after upgrading
 * without requiring a manual data migration. Set LOCAL_USER_ID to opt into a
 * specific existing user instead.
 */
export async function getLocalUser(): Promise<User> {
  const configuredUserId = process.env.LOCAL_USER_ID || DEFAULT_LOCAL_USER_ID;

  let user = await prisma.user.findUnique({
    where: { id: configuredUserId },
  });

  if (!user && !process.env.LOCAL_USER_ID) {
    user = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!user) {
    user = await prisma.user.upsert({
      where: { id: configuredUserId },
      update: {},
      create: {
        id: configuredUserId,
        email: process.env.LOCAL_USER_EMAIL || DEFAULT_LOCAL_USER_EMAIL,
        name: process.env.LOCAL_USER_NAME || DEFAULT_LOCAL_USER_NAME,
        preferences: {
          emailUpdates: false,
          notifyAnalysisComplete: false,
          weeklySummary: false,
        },
      },
    });
  }

  void ensureDefaultSemanticSearches(user.id);
  return user;
}
