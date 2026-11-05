const https = require('https');
const crypto = require('crypto');
const webPush = require('web-push');
const { pool } = require('../config/database');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_MESSAGES_PER_REQUEST = 100;

const sendWebPushNotifications = async (subscriptions, notification) => {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
        throw new Error('Falta configurar VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT');
    }

    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const results = await Promise.allSettled(subscriptions.map(async (row) => {
        const subscription = {
            endpoint: row.endpoint,
            keys: {
                p256dh: row.p256dh,
                auth: row.auth
            }
        };

        try {
            await webPush.sendNotification(subscription, JSON.stringify(notification));
            return true;
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await pool.execute(
                    'DELETE FROM web_push_subscriptions WHERE endpoint_hash = ?',
                    [row.endpoint_hash]
                );
            }
            throw error;
        }
    }));

    const sentCount = results.filter((result) => result.status === 'fulfilled').length;
    if (sentCount > 0) return sentCount;

    const failureMessages = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason.message);
    if (failureMessages.length) {
        throw new Error(`No se pudo enviar push web: ${failureMessages.join('; ')}`);
    }

    return 0;
};

const sendExpoMessages = (messages) => new Promise((resolve, reject) => {
    const request = https.request(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'identity',
            'Content-Type': 'application/json'
        },
        timeout: 10000
    }, (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
            responseBody += chunk;
        });
        response.on('end', () => {
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                reject(new Error(`Expo Push Service respondió HTTP ${response.statusCode}: ${responseBody}`));
                return;
            }

            let result;
            try {
                result = JSON.parse(responseBody);
            } catch (error) {
                reject(new Error(`No se pudo interpretar la respuesta de Expo Push Service: ${error.message}`));
                return;
            }

            if (!Array.isArray(result.data)) {
                reject(new Error(`Expo Push Service devolvió una respuesta inesperada: ${responseBody}`));
                return;
            }

            const failures = result.data.filter((ticket) => ticket?.status !== 'ok');
            if (failures.length > 0) {
                reject(new Error(`Expo Push Service rechazó ${failures.length} notificación(es): ${JSON.stringify(failures)}`));
                return;
            }
            resolve(result);
        });
    });

    request.on('timeout', () => request.destroy(new Error('Tiempo de espera agotado al enviar notificaciones push')));
    request.on('error', reject);
    request.write(JSON.stringify(messages));
    request.end();
});

exports.sendPushNotificationToUser = async (userId, notification) => {
    const [[expoRows], [webRows]] = await Promise.all([
        pool.execute(
            'SELECT expo_push_token FROM push_tokens WHERE usuario_id = ?',
            [userId]
        ),
        pool.execute(
            'SELECT endpoint_hash, endpoint, p256dh, auth FROM web_push_subscriptions WHERE usuario_id = ?',
            [userId]
        )
    ]);

    if (expoRows.length === 0 && webRows.length === 0) {
        return false;
    }

    const messages = expoRows.map(({ expo_push_token: to }) => ({
        to,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        channelId: 'default',
        priority: 'high'
    }));

    const deliveryTasks = [];
    for (let index = 0; index < messages.length; index += MAX_MESSAGES_PER_REQUEST) {
        deliveryTasks.push(sendExpoMessages(messages.slice(index, index + MAX_MESSAGES_PER_REQUEST)));
    }
    if (webRows.length > 0) {
        deliveryTasks.push(sendWebPushNotifications(webRows, notification));
    }

    const results = await Promise.allSettled(deliveryTasks);
    if (results.some((result) => result.status === 'fulfilled')) {
        return true;
    }

    const failureMessages = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason.message);
    throw new Error(`No se pudo enviar la notificación: ${failureMessages.join('; ')}`);
};

exports.sendTestPushNotificationToUser = (userId) =>
    exports.sendPushNotificationToUser(userId, {
        title: 'Notificación de prueba',
        body: '¡Las notificaciones de Shark Gym están funcionando!',
        data: { type: 'push_test' }
    });

exports.sendMembershipConfirmationToUser = (userId, membershipName, saleId) =>
    exports.sendPushNotificationToUser(userId, {
        title: 'Membresía confirmada',
        body: `Tu membresía ${membershipName} fue activada. ¡Nos vemos en Shark Gym!`,
        data: { type: 'membership_confirmed', saleId }
    });
