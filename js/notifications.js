// ================================================================
//  NOTIFICATIONS LOGIC
// ================================================================

let unreadCount = 0;
let notificationsListener = null;

// Ensure we don't start multiple subscriptions
function subscribeToNotifications() {
    const client = getSupabaseClient();
    if (!client) return;

    // Get current user ID
    client.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user?.id) return;
        const userId = session.user.id;

        if (notificationsListener) {
            client.removeChannel(notificationsListener);
        }

        // Subscribe to inserts on the notifications table where user_id matches
        notificationsListener = client.channel('custom-insert-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                (payload) => {
                    handleNewNotification(payload.new);
                }
            )
            .subscribe();
            
        // Initial fetch
        fetchNotifications();
    });
}

function handleNewNotification(notification) {
    // Show a toast
    showToast(`🔔 ${notification.title}`, 'info');
    
    // Play a subtle sound? (Optional)
    
    // Refresh list and badge
    fetchNotifications();
}

async function fetchNotifications() {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session?.user?.id) return;
        
        // Fetch up to 50 recent notifications
        const { data: notifications, error } = await client
            .from('notifications')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        
        renderNotificationsPanel(notifications || []);
        
        unreadCount = (notifications || []).filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        
    } catch (e) {
        console.error("Error fetching notifications:", e);
    }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationsBadge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
        badge.classList.add('pulse-anim'); // optional animation class
    } else {
        badge.style.display = 'none';
    }
}

function renderNotificationsPanel(notifications) {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="notification-empty">
                <div style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;">📭</div>
                <p>You have no notifications yet.</p>
            </div>
        `;
        return;
    }

    let html = '';
    
    const icons = {
        'submission': '📋',
        'approved': '✅',
        'rejected': '❌',
        'revision_requested': '🔄'
    };

    notifications.forEach(n => {
        const unreadClass = n.is_read ? '' : 'unread';
        const dateObj = new Date(n.created_at);
        const timeAgo = formatTimeAgo(dateObj);
        
        html += `
            <div class="notification-card ${unreadClass}" onclick="markNotificationRead('${n.id}')">
                <div class="notification-icon">${icons[n.type] || '🔔'}</div>
                <div class="notification-content">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-message">${n.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                ${!n.is_read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

async function markNotificationRead(id) {
    const client = getSupabaseClient();
    if (!client) return;
    
    // Optimistic UI update
    const card = document.querySelector(`.notification-card[onclick="markNotificationRead('${id}')"]`);
    if (card) {
        card.classList.remove('unread');
        const dot = card.querySelector('.notification-dot');
        if (dot) dot.remove();
    }
    
    if (unreadCount > 0) {
        unreadCount--;
        updateNotificationBadge(unreadCount);
    }

    try {
        await client.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (e) {
        console.error("Error marking read:", e);
    }
}

async function markAllNotificationsRead() {
    const client = getSupabaseClient();
    if (!client) return;
    
    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session?.user?.id) return;
        
        await client.from('notifications')
            .update({ is_read: true })
            .eq('user_id', session.user.id)
            .eq('is_read', false);
            
        fetchNotifications();
        
    } catch (e) {
        console.error("Error marking all read:", e);
    }
}

// Helper to format timestamps
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

// ================================================================
//  SENDING NOTIFICATIONS (Server-side simulation)
// ================================================================

async function sendNotification(userId, type, title, message, relatedDate = null, relatedEntryIds = null) {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        await client.from('notifications').insert([{
            user_id: userId,
            type: type,
            title: title,
            message: message,
            related_date: relatedDate,
            related_entry_ids: relatedEntryIds
        }]);
    } catch (e) {
        console.error("Failed to send notification:", e);
    }
}

async function sendNotificationToAllPrincipals(type, title, message, relatedDate = null, relatedEntryIds = null) {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        // Use the RPC function to bypass RLS since teachers cannot query the users table for principals
        const { error } = await client.rpc('notify_principals', {
            p_type: type,
            p_title: title,
            p_message: message,
            p_related_date: relatedDate,
            p_related_entry_ids: relatedEntryIds
        });
            
        if (error) {
            console.error("RPC error notifying principals:", error);
        }
        
    } catch (e) {
        console.error("Failed to send notification to principals:", e);
    }
}

// Expose globally
window.subscribeToNotifications = subscribeToNotifications;
window.fetchNotifications = fetchNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.sendNotification = sendNotification;
window.sendNotificationToAllPrincipals = sendNotificationToAllPrincipals;
