const Checkin = require('../models/Checkin');
const { pool } = require('../config/database');

exports.getTodayCheckins = async (req, res) => {
    try {
        const checkins = await Checkin.findToday();
        res.status(200).json({
            success: true,
            data: checkins
        });
    } catch (error) {
        console.error('Error in getTodayCheckins:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.getUserCheckinHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const checkins = await Checkin.findHistoryByUserId(userId);
        res.status(200).json({
            success: true,
            data: checkins
        });
    } catch (error) {
        console.error('Error in getUserCheckinHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.registerCheckin = async (req, res) => {
    try {
        const { usuario_id } = req.body;
        if (!usuario_id) {
            return res.status(400).json({
                success: false,
                message: 'usuario_id es requerido'
            });
        }

        // 1. Obtener detalles del usuario
        const [userRows] = await pool.execute(
            'SELECT nombre, fecha_vencimiento FROM usuarios WHERE id = ?',
            [usuario_id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const user = userRows[0];

        // 2. Verificar si ya tiene un check-in activo (sin salida registrada) hoy
        const activeCheckin = await Checkin.findActiveToday(usuario_id);
        if (activeCheckin) {
            // Si ya está adentro, registrar su SALIDA
            await Checkin.registerCheckout(activeCheckin.id);
            return res.status(200).json({
                success: true,
                tipo: 'salida',
                message: `Salida Registrada. ¡Buen entrenamiento, ${user.nombre}!`,
                usuario_nombre: user.nombre
            });
        }

        // 3. Si es ENTRADA, verificar que la membresía esté activa
        if (!user.fecha_vencimiento) {
            return res.status(400).json({
                success: false,
                message: 'El usuario no tiene una membresía registrada'
            });
        }

        const expiry = new Date(user.fecha_vencimiento);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);

        if (expiry < today) {
            const formattedExpiry = user.fecha_vencimiento instanceof Date 
                ? user.fecha_vencimiento.toISOString().split('T')[0]
                : String(user.fecha_vencimiento).split('T')[0];

            return res.status(400).json({
                success: false,
                message: `Acceso Denegado. La membresía de ${user.nombre} venció el ${formattedExpiry}`
            });
        }

        // 4. Registrar la ENTRADA (Check-in)
        const checkinId = await Checkin.create(usuario_id);

        const formattedExpiryDate = user.fecha_vencimiento instanceof Date 
            ? user.fecha_vencimiento.toISOString().split('T')[0]
            : String(user.fecha_vencimiento).split('T')[0];

        res.status(201).json({
            success: true,
            tipo: 'entrada',
            message: `Acceso Permitido: ¡Bienvenido, ${user.nombre}!`,
            checkinId,
            usuario_nombre: user.nombre,
            fecha_vencimiento: formattedExpiryDate
        });
    } catch (error) {
        console.error('Error in registerCheckin:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.deleteCheckin = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Checkin.delete(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Check-in no encontrado'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Check-in eliminado correctamente'
        });
    } catch (error) {
        console.error('Error in deleteCheckin:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.manuallyCheckoutCheckin = async (req, res) => {
    try {
        const { id } = req.params;
        // Registrar salida (checkout)
        const updated = await Checkin.registerCheckout(id);
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Registro de check-in no encontrado o ya completado'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Sesión finalizada correctamente'
        });
    } catch (error) {
        console.error('Error in manuallyCheckoutCheckin:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.webScanRegister = async (req, res) => {
    try {
        const { id, pin } = req.query;
        if (!id) {
            return res.status(400).send(getErrorHtml('ID de usuario es requerido'));
        }

        // 1. Obtener detalles del usuario
        const [userRows] = await pool.execute(
            'SELECT nombre, fecha_vencimiento FROM usuarios WHERE id = ?',
            [id]
        );

        if (userRows.length === 0) {
            return res.status(404).send(getErrorHtml('Usuario no encontrado'));
        }

        const user = userRows[0];

        // VALIDACIÓN DE PIN DE ACCESO
        const requiredPin = process.env.SCANNER_PIN || '1234';
        if (!pin) {
            return res.status(200).send(getPinPromptHtml(id, user.nombre));
        }

        if (pin !== requiredPin) {
            return res.status(200).send(getPinPromptHtml(id, user.nombre, 'PIN incorrecto. Ingrese el PIN de Recepción de nuevo.'));
        }

        // 2. Verificar si ya tiene un check-in activo hoy
        const activeCheckin = await Checkin.findActiveToday(id);
        if (activeCheckin) {
            // Si ya está adentro, registrar su SALIDA
            await Checkin.registerCheckout(activeCheckin.id);
            return res.status(200).send(getSuccessHtml('salida', user.nombre));
        }

        // 3. Si es ENTRADA, verificar que la membresía esté activa
        if (!user.fecha_vencimiento) {
            return res.status(400).send(getErrorHtml(`El usuario <strong>${user.nombre}</strong> no tiene una membresía registrada.`));
        }

        const expiry = new Date(user.fecha_vencimiento);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);

        if (expiry < today) {
            const formattedExpiry = user.fecha_vencimiento instanceof Date 
                ? user.fecha_vencimiento.toISOString().split('T')[0]
                : String(user.fecha_vencimiento).split('T')[0];

            return res.status(400).send(getErrorHtml(`Acceso Denegado. La membresía de <strong>${user.nombre}</strong> venció el ${formattedExpiry}`));
        }

        // 4. Registrar la ENTRADA (Check-in)
        await Checkin.create(id);
        return res.status(200).send(getSuccessHtml('entrada', user.nombre));

    } catch (error) {
        console.error('Error in webScanRegister:', error);
        return res.status(500).send(getErrorHtml('Error interno al registrar el acceso'));
    }
};

const getSuccessHtml = (tipo, name) => {
    const isEntrada = tipo === 'entrada';
    const accentColor = isEntrada ? '#4caf50' : '#2196f3';
    const title = isEntrada ? 'Acceso Permitido' : 'Salida Registrada';
    const icon = isEntrada ? '✅' : '🚪';
    const message = isEntrada 
        ? `¡Bienvenido a Shark Gym, <strong>${name}</strong>!<br>Entrena duro hoy.`
        : `¡Hasta luego, <strong>${name}</strong>!<br>Salida registrada correctamente.`;

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #0c0c0e;
                color: #ffffff;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .card {
                background: linear-gradient(135deg, #121214 0%, #17171d 100%);
                border: 2px solid ${accentColor};
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
                border-radius: 24px;
                padding: 40px 30px;
                text-align: center;
                max-width: 360px;
                width: 85%;
                margin: 20px;
            }
            .icon {
                font-size: 70px;
                margin-bottom: 20px;
            }
            h1 {
                font-size: 24px;
                color: #ffffff;
                margin-top: 0;
                margin-bottom: 12px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            p {
                font-size: 15px;
                line-height: 1.6;
                color: #a0a0a5;
                margin-bottom: 30px;
            }
            .time-badge {
                display: inline-block;
                background-color: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.08);
                color: ${accentColor};
                padding: 8px 20px;
                border-radius: 30px;
                font-size: 13px;
                font-weight: 700;
            }
            .brand {
                font-size: 13px;
                color: #444449;
                margin-top: 35px;
                font-weight: 800;
                letter-spacing: 2px;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">${icon}</div>
            <h1>${title}</h1>
            <p>${message}</p>
            <div class="time-badge">${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div class="brand">SHARK GYM 🦈</div>
        </div>
    </body>
    </html>
    `;
};

const getErrorHtml = (message) => {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Acceso Denegado</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #0c0c0e;
                color: #ffffff;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .card {
                background: linear-gradient(135deg, #121214 0%, #17171d 100%);
                border: 2px solid #ff4d4f;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
                border-radius: 24px;
                padding: 40px 30px;
                text-align: center;
                max-width: 360px;
                width: 85%;
                margin: 20px;
            }
            .icon {
                font-size: 70px;
                margin-bottom: 20px;
            }
            h1 {
                font-size: 24px;
                color: #ff4d4f;
                margin-top: 0;
                margin-bottom: 12px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            p {
                font-size: 15px;
                line-height: 1.6;
                color: #a0a0a5;
                margin-bottom: 30px;
            }
            .brand {
                font-size: 13px;
                color: #444449;
                margin-top: 35px;
                font-weight: 800;
                letter-spacing: 2px;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">❌</div>
            <h1>Acceso Denegado</h1>
            <p>${message}</p>
            <div class="brand">SHARK GYM 🦈</div>
        </div>
    </body>
    </html>
    `;
};

const getPinPromptHtml = (id, name, errorMsg = '') => {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Autorización de Acceso</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #0c0c0e;
                color: #ffffff;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .card {
                background: linear-gradient(135deg, #121214 0%, #17171d 100%);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
                border-radius: 24px;
                padding: 40px 30px;
                text-align: center;
                max-width: 360px;
                width: 85%;
                margin: 20px;
            }
            .icon {
                font-size: 55px;
                margin-bottom: 20px;
            }
            h1 {
                font-size: 20px;
                color: #ffffff;
                margin-top: 0;
                margin-bottom: 12px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            p {
                font-size: 14px;
                line-height: 1.5;
                color: #a0a0a5;
                margin-bottom: 25px;
            }
            .client-name {
                color: #208AEF;
                font-weight: 700;
            }
            .error-message {
                color: #ff4d4f;
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            input[type="password"] {
                width: 100%;
                box-sizing: border-box;
                background-color: rgba(255, 255, 255, 0.05);
                border: 1.5px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                color: #ffffff;
                padding: 12px;
                font-size: 16px;
                text-align: center;
                margin-bottom: 20px;
                outline: none;
                transition: border-color 0.2s;
                letter-spacing: 4px;
            }
            input[type="password"]:focus {
                border-color: #208AEF;
            }
            button {
                width: 100%;
                background-color: #208AEF;
                border: none;
                border-radius: 12px;
                color: #ffffff;
                padding: 12px;
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            button:hover {
                background-color: #1a76cc;
            }
            .brand {
                font-size: 13px;
                color: #444449;
                margin-top: 35px;
                font-weight: 800;
                letter-spacing: 2px;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">🔒</div>
            <h1>Autorizar Acceso</h1>
            <p>Se requiere PIN de personal para registrar entrada/salida de:<br><span class="client-name">${name}</span></p>
            
            ${errorMsg ? `<div class="error-message">${errorMsg}</div>` : ''}

            <form method="GET" action="/api/v1/checkins/web-scan">
                <input type="hidden" name="id" value="${id}">
                <input type="password" name="pin" placeholder="••••" maxlength="4" required autofocus style="-webkit-text-security: disc;">
                <button type="submit">Confirmar Registro</button>
            </form>

            <div class="brand">SHARK GYM 🦈</div>
        </div>
    </body>
    </html>
    `;
};
