const { pool } = require('../config/database');
const { sendTestPushNotificationToUser } = require('../services/pushNotificationService');
const crypto = require('crypto');

const isExpoPushToken = (value) =>
    typeof value === 'string' &&
    value.length <= 255 &&
    /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(value);

const getWebPushEndpoint = (value) => {
    if (typeof value !== 'string' || value.length > 2048) return null;

    try {
        const endpoint = new URL(value);
        const hostname = endpoint.hostname.toLowerCase();
        const allowedHost =
            hostname === 'fcm.googleapis.com' ||
            hostname.endsWith('.push.services.mozilla.com') ||
            hostname.endsWith('.push.apple.com') ||
            hostname.endsWith('.push.microsoft.com');

        return endpoint.protocol === 'https:' && allowedHost ? endpoint.toString() : null;
    } catch {
        return null;
    }
};

const getWebPushSubscription = (value) => {
    const endpoint = getWebPushEndpoint(value?.endpoint);
    const p256dh = value?.keys?.p256dh;
    const auth = value?.keys?.auth;

    if (
        !endpoint ||
        typeof p256dh !== 'string' ||
        p256dh.length > 255 ||
        typeof auth !== 'string' ||
        auth.length > 255
    ) {
        return null;
    }

    return {
        endpoint,
        endpointHash: crypto.createHash('sha256').update(endpoint).digest('hex'),
        p256dh,
        auth
    };
};

exports.registerToken = async (req, res) => {
    const { expoPushToken } = req.body;
    if (!isExpoPushToken(expoPushToken)) {
        return res.status(400).json({
            success: false,
            message: 'El token de notificaciones no tiene un formato válido'
        });
    }

    try {
        await pool.execute(
            `INSERT INTO push_tokens (usuario_id, expo_push_token)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE
                usuario_id = VALUES(usuario_id),
                updated_at = CURRENT_TIMESTAMP`,
            [req.user.userId, expoPushToken]
        );

        return res.status(200).json({
            success: true,
            message: 'Token de notificaciones registrado'
        });
    } catch (error) {
        console.error('Error al registrar token de notificaciones:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo registrar el token de notificaciones'
        });
    }
};

exports.unregisterToken = async (req, res) => {
    const { expoPushToken } = req.body;
    if (!isExpoPushToken(expoPushToken)) {
        return res.status(400).json({
            success: false,
            message: 'El token de notificaciones no tiene un formato válido'
        });
    }

    try {
        await pool.execute(
            'DELETE FROM push_tokens WHERE usuario_id = ? AND expo_push_token = ?',
            [req.user.userId, expoPushToken]
        );

        return res.status(200).json({
            success: true,
            message: 'Token de notificaciones desvinculado'
        });
    } catch (error) {
        console.error('Error al desvincular token de notificaciones:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo desvincular el token de notificaciones'
        });
    }
};

exports.registerWebSubscription = async (req, res) => {
    const subscription = getWebPushSubscription(req.body?.subscription);
    if (!subscription) {
        return res.status(400).json({
            success: false,
            message: 'La suscripción web push no tiene un formato válido'
        });
    }

    try {
        await pool.execute(
            `INSERT INTO web_push_subscriptions
                (usuario_id, endpoint_hash, endpoint, p256dh, auth)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                usuario_id = VALUES(usuario_id),
                endpoint = VALUES(endpoint),
                p256dh = VALUES(p256dh),
                auth = VALUES(auth),
                updated_at = CURRENT_TIMESTAMP`,
            [
                req.user.userId,
                subscription.endpointHash,
                subscription.endpoint,
                subscription.p256dh,
                subscription.auth
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Suscripción web registrada'
        });
    } catch (error) {
        console.error('Error al registrar suscripción web push:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo registrar la suscripción web'
        });
    }
};

exports.unregisterWebSubscription = async (req, res) => {
    const endpoint = getWebPushEndpoint(req.body?.endpoint);
    if (!endpoint) {
        return res.status(400).json({
            success: false,
            message: 'El endpoint de la suscripción web no tiene un formato válido'
        });
    }

    const endpointHash = crypto.createHash('sha256').update(endpoint).digest('hex');
    try {
        await pool.execute(
            'DELETE FROM web_push_subscriptions WHERE usuario_id = ? AND endpoint_hash = ?',
            [req.user.userId, endpointHash]
        );

        return res.status(200).json({
            success: true,
            message: 'Suscripción web desvinculada'
        });
    } catch (error) {
        console.error('Error al desvincular suscripción web push:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo desvincular la suscripción web'
        });
    }
};

exports.sendTestNotification = async (req, res) => {
    try {
        const sent = await sendTestPushNotificationToUser(req.user.userId);
        if (!sent) {
            return res.status(404).json({
                success: false,
                message: 'Este dispositivo o navegador aún no tiene notificaciones push activadas.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'El servicio de notificaciones aceptó la notificación de prueba'
        });
    } catch (error) {
        console.error('Error al enviar notificación de prueba:', error);
        return res.status(502).json({
            success: false,
            message: error instanceof Error
                ? `No se pudo enviar la notificación de prueba: ${error.message}`
                : 'No se pudo enviar la notificación de prueba'
        });
    }
};
