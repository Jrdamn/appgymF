const https = require('https');
const { pool } = require('../config/database');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_MESSAGES_PER_REQUEST = 100;

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
    const [rows] = await pool.execute(
        'SELECT expo_push_token FROM push_tokens WHERE usuario_id = ?',
        [userId]
    );
    if (rows.length === 0) {
        return false;
    }

    const messages = rows.map(({ expo_push_token: to }) => ({
        to,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        channelId: 'default',
        priority: 'high'
    }));

    for (let index = 0; index < messages.length; index += MAX_MESSAGES_PER_REQUEST) {
        await sendExpoMessages(messages.slice(index, index + MAX_MESSAGES_PER_REQUEST));
    }
    return true;
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
