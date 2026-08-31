import { NextRequest, NextResponse } from 'next/server';
import { createSubClustersAction } from '@/app/actions/videos.actions';

export async function POST(request: NextRequest) {
    try {
        const { clusterId } = await request.json();

        if (!clusterId) {
            return NextResponse.json({ error: 'Cluster ID is required' }, { status: 400 });
        }

        const result = await createSubClustersAction(clusterId);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error in create sub-clusters API:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create sub-clusters'
        }, { status: 500 });
    }
}
