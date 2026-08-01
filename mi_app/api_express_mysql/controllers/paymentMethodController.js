const { pool } = require('../config/database');

/**
 * Obtiene todos los métodos de pago guardados por el usuario
 */
exports.getMethods = async (req, res) => {
    try {
        const usuario_id = req.user.userId;
        const [rows] = await pool.execute(
            'SELECT * FROM metodos_pago WHERE usuario_id = ? ORDER BY es_predeterminado DESC, fecha_creacion DESC',
            [usuario_id]
        );
        
        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error in getMethods:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener métodos de pago',
            error: error.message
        });
    }
};

/**
 * Agrega un nuevo método de pago (tarjeta o paypal)
 */
exports.addMethod = async (req, res) => {
    try {
        const usuario_id = req.user.userId;
        const { tipo, nombre_titular, numero_tarjeta, fecha_expiracion, marca, email_paypal } = req.body;

        if (!tipo || (tipo !== 'tarjeta' && tipo !== 'paypal')) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de método de pago inválido (debe ser tarjeta o paypal)'
            });
        }

        // Si es el primer método de pago del usuario, lo marcamos como predeterminado
        const [countRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM metodos_pago WHERE usuario_id = ?',
            [usuario_id]
        );
        const es_predeterminado = countRows[0].count === 0 ? 1 : 0;

        let query = '';
        let params = [];

        if (tipo === 'tarjeta') {
            if (!nombre_titular || !numero_tarjeta || !fecha_expiracion || !marca) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos de la tarjeta son requeridos (nombre_titular, numero_tarjeta, fecha_expiracion, marca)'
                });
            }

            // Validaciones de tarjeta real
            const cleanNumber = numero_tarjeta.replace(/\D/g, '');
            if (cleanNumber.length < 13 || cleanNumber.length > 19) {
                return res.status(400).json({
                    success: false,
                    message: 'El número de tarjeta debe tener entre 13 y 19 dígitos.'
                });
            }

            // Algoritmo de Luhn para verificar validez matemática
            let sum = 0;
            let shouldDouble = false;
            for (let i = cleanNumber.length - 1; i >= 0; i--) {
                let digit = parseInt(cleanNumber.charAt(i));
                if (shouldDouble) {
                    digit *= 2;
                    if (digit > 9) digit -= 9;
                }
                sum += digit;
                shouldDouble = !shouldDouble;
            }
            const isValidLuhn = (sum % 10) === 0;
            if (!isValidLuhn) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de tarjeta inválido (Suma de verificación fallida).'
                });
            }

            // Validar Expiración (MM/YY)
            const expiryMatch = fecha_expiracion.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/);
            if (!expiryMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de fecha de expiración inválido (debe ser MM/YY).'
                });
            }
            const expMonth = parseInt(expiryMatch[1]);
            const expYear = parseInt('20' + expiryMatch[2]);
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                return res.status(400).json({
                    success: false,
                    message: 'La tarjeta ingresada ya está vencida.'
                });
            }

            const last4 = cleanNumber.slice(-4);
            const numero_enmascarado = `•••• •••• •••• ${last4}`;

            query = `INSERT INTO metodos_pago 
                (usuario_id, tipo, nombre_titular, numero_enmascarado, fecha_expiracion, marca, es_predeterminado) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            params = [usuario_id, tipo, nombre_titular, numero_enmascarado, fecha_expiracion, marca, es_predeterminado];
        } else {
            // PayPal
            if (!email_paypal) {
                return res.status(400).json({
                    success: false,
                    message: 'El correo electrónico de PayPal es requerido'
                });
            }

            query = `INSERT INTO metodos_pago 
                (usuario_id, tipo, email_paypal, es_predeterminado) 
                VALUES (?, ?, ?, ?)`;
            params = [usuario_id, tipo, email_paypal, es_predeterminado];
        }

        const [result] = await pool.execute(query, params);

        res.status(201).json({
            success: true,
            message: 'Método de pago agregado correctamente',
            data: {
                id: result.insertId,
                tipo,
                es_predeterminado
            }
        });
    } catch (error) {
        console.error('Error in addMethod:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar método de pago',
            error: error.message
        });
    }
};

/**
 * Elimina un método de pago
 */
exports.deleteMethod = async (req, res) => {
    try {
        const usuario_id = req.user.userId;
        const methodId = req.params.id;

        // Verificar propiedad
        const [rows] = await pool.execute(
            'SELECT * FROM metodos_pago WHERE id = ? AND usuario_id = ?',
            [methodId, usuario_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        const wasDefault = rows[0].es_predeterminado === 1;

        // Eliminar
        await pool.execute(
            'DELETE FROM metodos_pago WHERE id = ? AND usuario_id = ?',
            [methodId, usuario_id]
        );

        // Si el eliminado era el predeterminado, marcar otro como predeterminado (si existe)
        if (wasDefault) {
            const [others] = await pool.execute(
                'SELECT id FROM metodos_pago WHERE usuario_id = ? ORDER BY fecha_creacion DESC LIMIT 1',
                [usuario_id]
            );
            if (others.length > 0) {
                await pool.execute(
                    'UPDATE metodos_pago SET es_predeterminado = 1 WHERE id = ?',
                    [others[0].id]
                );
            }
        }

        res.status(200).json({
            success: true,
            message: 'Método de pago eliminado correctamente'
        });
    } catch (error) {
        console.error('Error in deleteMethod:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar método de pago',
            error: error.message
        });
    }
};

/**
 * Establece un método de pago como predeterminado
 */
exports.setDefaultMethod = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const usuario_id = req.user.userId;
        const methodId = req.params.id;

        // Verificar propiedad
        const [rows] = await pool.execute(
            'SELECT * FROM metodos_pago WHERE id = ? AND usuario_id = ?',
            [methodId, usuario_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado o no pertenece al usuario'
            });
        }

        await connection.beginTransaction();

        // 1. Quitar predeterminado a todos
        await connection.execute(
            'UPDATE metodos_pago SET es_predeterminado = 0 WHERE usuario_id = ?',
            [usuario_id]
        );

        // 2. Establecer predeterminado al seleccionado
        await connection.execute(
            'UPDATE metodos_pago SET es_predeterminado = 1 WHERE id = ?',
            [methodId]
        );

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Método de pago establecido como predeterminado'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in setDefaultMethod:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar método predeterminado',
            error: error.message
        });
    } finally {
        connection.release();
    }
};


exports.renderPaypalLinkPage = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).send('<h1>Error: El ID del usuario es requerido para la vinculación.</h1>');
        }

        const [userRows] = await pool.execute(
            'SELECT nombre FROM usuarios WHERE id = ?',
            [userId]
        );

        const name = userRows.length > 0 ? userRows[0].nombre : 'Socio de Shark Gym';

        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Vincular cuenta de PayPal - Shark Gym</title>
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
                    .paypal-logo {
                        font-size: 28px;
                        font-weight: 800;
                        font-style: italic;
                        margin-bottom: 20px;
                        letter-spacing: -1px;
                    }
                    .paypal-p { color: #003087; }
                    .paypal-p2 { color: #0070ba; }
                    h1 {
                        font-size: 18px;
                        color: #ffffff;
                        margin-top: 0;
                        margin-bottom: 12px;
                        font-weight: 700;
                    }
                    p {
                        font-size: 14px;
                        line-height: 1.5;
                        color: #a0a0a5;
                        margin-bottom: 25px;
                    }
                    .input-group {
                        text-align: left;
                        margin-bottom: 18px;
                    }
                    label {
                        display: block;
                        font-size: 12px;
                        font-weight: 600;
                        color: #a0a0a5;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    input[type="email"], input[type="password"] {
                        width: 100%;
                        box-sizing: border-box;
                        background-color: rgba(255, 255, 255, 0.05);
                        border: 1.5px solid rgba(255, 255, 255, 0.12);
                        border-radius: 12px;
                        color: #ffffff;
                        padding: 12px;
                        font-size: 15px;
                        outline: none;
                        transition: border-color 0.2s;
                    }
                    input[type="email"]:focus, input[type="password"]:focus {
                        border-color: #0070ba;
                    }
                    button {
                        width: 100%;
                        background-color: #ffc439;
                        border: none;
                        border-radius: 25px;
                        color: #003087;
                        padding: 14px;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: background-color 0.2s;
                        margin-top: 10px;
                    }
                    button:hover {
                        background-color: #f2b522;
                    }
                    .footer-note {
                        font-size: 12px;
                        color: #55555a;
                        margin-top: 25px;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="paypal-logo">
                        <span class="paypal-p">Pay</span><span class="paypal-p2">Pal</span>
                    </div>
                    <h1>Vincular Cuenta</h1>
                    <p>Inicia sesión para vincular de forma segura tu método de pago con la cuenta de:<br><strong>${name}</strong></p>
                    
                    <form method="POST" action="/api/v1/payments/link-paypal-web">
                        <input type="hidden" name="userId" value="${userId}">
                        <div class="input-group">
                            <label for="email">Correo Electrónico de PayPal</label>
                            <input type="email" id="email" name="email" placeholder="nombre@correo.com" required autofocus>
                        </div>
                        <div class="input-group">
                            <label for="password">Contraseña de PayPal</label>
                            <input type="password" id="password" name="password" placeholder="••••••••" required>
                        </div>
                        <button type="submit">Iniciar Sesión y Vincular</button>
                    </form>
                    <div class="footer-note">Transacción segura protegida por PayPal Sandbox 🔒</div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error rendering link page:', error);
        res.status(500).send('Error interno de servidor');
    }
};

exports.handlePaypalLinkSubmit = async (req, res) => {
    try {
        const { userId, email } = req.body;
        if (!userId || !email) {
            return res.status(400).send('<h1>Error: Datos incompletos.</h1>');
        }

        const [countRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM metodos_pago WHERE usuario_id = ?',
            [userId]
        );
        const es_predeterminado = countRows[0].count === 0 ? 1 : 0;

        await pool.execute(
            'INSERT INTO metodos_pago (usuario_id, tipo, email_paypal, es_predeterminado) VALUES (?, ?, ?, ?)',
            [userId, 'paypal', email.trim(), es_predeterminado]
        );

        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Vinculación Exitosa - Shark Gym</title>
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
                        color: #4caf50;
                        margin-bottom: 20px;
                    }
                    h1 {
                        font-size: 20px;
                        color: #ffffff;
                        margin-top: 0;
                        margin-bottom: 12px;
                        font-weight: 700;
                    }
                    p {
                        font-size: 14px;
                        line-height: 1.5;
                        color: #a0a0a5;
                        margin-bottom: 25px;
                    }
                    .email-display {
                        color: #ffc439;
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
                    <div class="icon">✅</div>
                    <h1>¡Vinculación Exitosa!</h1>
                    <p>Tu cuenta de PayPal:<br><span class="email-display">${email}</span><br>ha sido asociada a tu cuenta de Shark Gym correctamente.</p>
                    <p style="font-size: 12px; color: #55555a;">Ya puedes cerrar esta ventana del navegador y regresar a la aplicación móvil.</p>
                    <div class="brand">SHARK GYM 🦈</div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error registering PayPal in web flow:', error);
        res.status(500).send('<h1>Error al vincular el método de pago</h1>');
    }
};
