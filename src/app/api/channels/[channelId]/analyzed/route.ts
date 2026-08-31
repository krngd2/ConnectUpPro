import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ channelId: string }> }
) {
    try {
        const { channelId } = await params;

        if (!channelId) {
            return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
        }

        // TODO: Implement analyzed videos endpoint
        return NextResponse.json({
            channelId,
            analyzed: [],
            message: 'Analyzed videos endpoint - coming soon'
        });

    } catch (error) {
        console.error('Error in analyzed videos endpoint:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
