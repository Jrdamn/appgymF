const { pool } = require('../config/database');

exports.createInAppNotification = (userId, message, executor = pool) =>
    executor.execute(
        'INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)',
        [userId, message]
    );
