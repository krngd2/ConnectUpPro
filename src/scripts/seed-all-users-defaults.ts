import { prisma } from '@/lib/db';
import { generateDefaultSearchEmbeddings, seedDefaultSemanticSearchesWithCache } from '@/lib/default-semantic-searches';

async function seedAllUsers() {
    console.log('=== Starting Default Semantic Searches Seeding ===\n');

    // Step 1: Find all users that need default searches
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
        }
    });

    console.log(`Found ${users.length} total users\n`);

    // Step 2: Generate embeddings once for all default searches
    console.log('Step 1: Generating embeddings for default searches (one-time operation)...');
    const embeddingsCache = await generateDefaultSearchEmbeddings();
    console.log(`✓ Generated embeddings for ${embeddingsCache.size} default searches\n`);

    // Step 3: Delete existing default searches for all users and reseed
    console.log('Step 2: Reseeding default searches for all users...');

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`\n[${i + 1}/${users.length}] Processing user: ${user.email || user.id}`);

        try {
            // Delete existing default searches for this user
            const deleteResult = await prisma.semanticSearch.deleteMany({
                where: {
                    userId: user.id,
                    isDefault: true
                }
            });

            if (deleteResult.count > 0) {
                console.log(`  ✓ Deleted ${deleteResult.count} existing default searches`);
            }

            // Seed new default searches using cached embeddings
            await seedDefaultSemanticSearchesWithCache(user.id, embeddingsCache);
            console.log(`  ✓ Successfully seeded default searches`);
        } catch (error) {
            console.error(`  ✗ Error processing user ${user.id}:`, error);
        }
    }

    console.log('\n=== Completed Seeding for All Users ===');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Default searches per user: ${embeddingsCache.size}`);
}

seedAllUsers()
    .catch((error) => {
        console.error('Fatal error during seeding:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });