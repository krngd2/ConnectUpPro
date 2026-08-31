import { NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'

export async function GET() {
    try {
        const user = await getLocalUser()

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            }
        })
    } catch (error) {
        console.error('[API] Error fetching user:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
