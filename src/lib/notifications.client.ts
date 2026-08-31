// Client-side browser notification utilities
// This file should NOT import any server-side dependencies (Prisma, etc.)

// Client-side browser notification for immediate user feedback
export function sendBrowserNotification(payload: {
    videoId: string;
    title?: string | null;
    status: 'COMPLETED' | 'FAILED';
    errorMessage?: string;
}) {
    // Check if browser supports notifications
    if (typeof window === 'undefined' || !('Notification' in window)) {
        console.log('[NOTIFICATIONS] Browser notifications not supported');
        return;
    }

    // Check if permission is granted
    if (Notification.permission !== 'granted') {
        console.log('[NOTIFICATIONS] Browser notification permission not granted');
        return;
    }

    const videoTitle = payload.title || `Video ${payload.videoId}`;

    let body: string;
    let notificationTitle: string;

    if (payload.status === 'COMPLETED') {
        notificationTitle = '✅ Video Analysis Complete';
        body = `Analysis for "${videoTitle}" is complete! Click to view results.`;
    } else {
        notificationTitle = '❌ Analysis Failed';
        body = payload.errorMessage
            ? `Analysis failed: ${payload.errorMessage}`
            : `Analysis for "${videoTitle}" has failed.`;
    }

    try {
        const notification = new Notification(notificationTitle, {
            body,
            tag: `video-analysis-${payload.videoId}`, // Prevent duplicate notifications
            requireInteraction: true, // Keep notification visible until user interacts
        });

        // Add click handler to focus/navigate to the analysis page
        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        console.log('[NOTIFICATIONS] Browser notification sent for video:', payload.videoId);
    } catch (error) {
        console.error('[NOTIFICATIONS] Error sending browser notification:', error);
    }
}

// Request notification permission if not already granted or denied
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        console.log('[NOTIFICATIONS] Browser notifications not supported');
        return 'denied';
    }

    // If already granted or denied, return current permission
    if (Notification.permission !== 'default') {
        return Notification.permission;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('[NOTIFICATIONS] Permission request result:', permission);
        return permission;
    } catch (error) {
        console.error('[NOTIFICATIONS] Error requesting permission:', error);
        return 'denied';
    }
}
