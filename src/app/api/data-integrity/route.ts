import { NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { checkDataIntegrity } from '@/lib/data-integrity';

/**
 * GET /api/data-integrity
 * 
 * Returns a data integrity report
 * Only accessible to authenticated users
 */
export async function GET() {
    try {
        // Check if user is authenticated (admin check could be added here)
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Run integrity check
        const report = await checkDataIntegrity();

        return NextResponse.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('[DATA_INTEGRITY_API] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to check data integrity',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
