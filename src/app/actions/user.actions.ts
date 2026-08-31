'use server'

import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'
import { User } from '@prisma/client'

export interface UserPreferences {
    emailUpdates: boolean
    notifyAnalysisComplete: boolean
    weeklySummary: boolean
}

/**
 * Get the current user's notification preferences
 */
export async function getUserData(userId?: string): Promise<User | null> {
    try {
        if (!userId) {
            const user = await getLocalUser()
            if (!user) {
                return null
            }
            userId = user.id
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: userId }
        })

        if (!dbUser) {
            return null
        }

        return dbUser
    } catch (error) {
        console.error('Error fetching preferences:', error)
        return null
    }
}

/**
 * Update the user's notification preferences
 */
export async function updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
    try {
        const user = await getLocalUser()
        if (!user) {
            throw new Error('Local workspace is unavailable')
        }

        // Get existing preferences first
        const existingUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { preferences: true }
        })

        if (!existingUser) {
            throw new Error('User not found')
        }

        const existingPreferences = existingUser.preferences
            ? (existingUser.preferences as unknown as UserPreferences)
            : {
                emailUpdates: false,
                notifyAnalysisComplete: false,
                weeklySummary: false
            }

        // Merge with new preferences
        const updatedPreferences = {
            ...existingPreferences,
            ...preferences
        }

        // Update user preferences
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { preferences: updatedPreferences }
        })

        return updatedUser.preferences as unknown as UserPreferences
    } catch (error) {
        console.error('Error updating preferences:', error)
        throw error
    }
}


export const getUserTotalComments = async (userId: string): Promise<number> => {
    try {
        const commentsCount = await prisma.video.findMany({
            where: { userId },
            select: {
                _count: {
                    select: {
                        comments: true
                    }
                }
            }
        });
        return commentsCount[0]?._count?.comments || 0;
    } catch (error) {
        console.error('Error fetching user comments:', error);
        return 0;
    }
}
