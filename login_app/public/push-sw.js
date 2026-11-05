self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        payload = { body: event.data?.text() || '' };
    }

    const title = payload.title || 'Shark Gym';
    const options = {
        body: payload.body || 'Tienes una nueva notificación.',
        data: payload.data || {},
        tag: payload.tag || 'shark-gym-notification',
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });
        for (const client of windows) {
            if ('focus' in client) {
                await client.focus();
                return;
            }
        }
        await self.clients.openWindow('/');
    })());
});
