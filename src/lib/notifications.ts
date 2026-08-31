// Notification utilities (local web notifications)

// Re-export client-side functions (no Prisma dependency)
export { sendBrowserNotification, requestNotificationPermission } from './notifications.client';

export interface NotificationPayload {
    userId: string;
    videoId: string;
    status: 'COMPLETED' | 'FAILED';
    title?: string | null;
    errorMessage?: string;
    commentsCount?: number;
}

export async function sendAnalysisEmailNotification(payload: NotificationPayload) {
    console.log('[NOTIFICATIONS] Email notifications are disabled in the local edition:', {
        videoId: payload.videoId,
        status: payload.status,
    });
    return { success: false, error: 'Email notifications are not configured' };
}

// Basic in-memory browser notification subscriber store (for demo only)
const webNotificationSubscribers = new Set<string>();

export function subscribeUserToWebNotifications(userId: string) {
    webNotificationSubscribers.add(userId);
    console.log('[NOTIFICATIONS] User subscribed to web notifications:', userId);
}

export function isUserSubscribed(userId: string) {
    return webNotificationSubscribers.has(userId);
}

export async function sendWebNotification(payload: NotificationPayload) {
    if (!isUserSubscribed(payload.userId)) {
        console.log('[NOTIFICATIONS] User not subscribed to web notifications, skipping:', payload.userId);
        return { delivered: false, reason: 'not_subscribed' };
    }
    // Placeholder push logic
    console.log('[NOTIFICATIONS] (WEB) Would push notification to user', payload.userId, 'Video', payload.videoId, 'Status', payload.status);
    return { delivered: true };
}

export async function notifyAnalysisResult(payload: NotificationPayload) {
    await Promise.all([
        sendAnalysisEmailNotification(payload),
        sendWebNotification(payload)
    ]);
}
