import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { migrateClusterDataToTable } from '@/lib/cluster-migration-stub';

export async function POST(request: NextRequest) {
    try {
        const { action } = await request.json();

        if (action === 'migrate') {
            await migrateClusterDataToTable();
            return NextResponse.json({ success: true, message: 'Cluster data migration completed' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Cluster migration API error:', error);
        return NextResponse.json({ error: 'Migration failed', details: error }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const videoId = searchParams.get('videoId');

        if (!videoId) {
            return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
        }

        // Fetch all clusters for the video in a single query
        const flatClusters = await prisma.cluster.findMany({
            where: { videoId },
            orderBy: [
                { level: 'asc' },
                { createdAt: 'asc' }
            ],
            select: {
                id: true,
                name: true,
                description: true,
                parentClusterId: true,
                level: true,
                commentCount: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // Build lookup map
        type ClusterNode = {
            id: string;
            name: string;
            description: string | null;
            parentClusterId: string | null;
            level: number;
            commentCount: number;
            createdAt: Date;
            updatedAt: Date;
            commentIDs: string[]; // compatibility with AnalysisDataCluster
            subClusters?: ClusterNode[];
        };

        const map = new Map<string, ClusterNode>();
        flatClusters.forEach(c => {
            map.set(c.id, {
                ...c,
                commentIDs: [],
                subClusters: []
            });
        });

        const roots: ClusterNode[] = [];
        flatClusters.forEach(c => {
            const node = map.get(c.id)!;
            if (c.parentClusterId) {
                const parent = map.get(c.parentClusterId);
                if (parent) {
                    parent.subClusters!.push(node);
                } else {
                    // Orphaned cluster fallback to roots
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        return NextResponse.json({ clusters: roots });
    } catch (error) {
        console.error('Get clusters API error:', error);
        return NextResponse.json({ error: 'Failed to get clusters', details: error }, { status: 500 });
    }
}
