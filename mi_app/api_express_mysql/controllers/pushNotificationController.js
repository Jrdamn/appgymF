const { pool } = require('../config/database');
const { sendTestPushNotificationToUser } = require('../services/pushNotificationService');

const isExpoPushToken = (value) =>
    typeof value === 'string' &&
    value.length <= 255 &&
    /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(value);

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

exports.sendTestNotification = async (req, res) => {
    try {
        const sent = await sendTestPushNotificationToUser(req.user.userId);
        if (!sent) {
            return res.status(404).json({
                success: false,
                message: 'Este dispositivo aún no registró un token push. Cierra y vuelve a iniciar sesión con internet.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Expo aceptó la notificación de prueba para este dispositivo'
        });
    } catch (error) {
        console.error('Error al enviar notificación de prueba:', error);
        return res.status(502).json({
            success: false,
            message: 'Expo no pudo aceptar la notificación de prueba',
            error: error.message
        });
    }
};
