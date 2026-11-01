const paypalService = require('../services/paypalService');
const { pool } = require('../config/database');
const { sendMembershipConfirmationToUser } = require('../services/pushNotificationService');

/**
 * Crea una orden de pago en PayPal
 */
exports.createPaypalOrder = async (req, res) => {
    try {
        const { total, tipo, membresia_nombre, producto_nombre, redirectUrl } = req.body;
        
        if (!total || !tipo) {
            return res.status(400).json({
                success: false,
                message: 'Total y tipo de compra son requeridos'
            });
        }

        const concept = tipo === 'membresia' 
            ? `Plan: ${membresia_nombre || 'Membresía Gym'}` 
            : `Producto: ${producto_nombre || 'Artículo Gym'}`;

        const host = req.get('host') || 'localhost:3000';
        // Convertimos el total de Colones (CRC) a USD para procesarlo en PayPal (ej: ₡26,000 / 520 = $50 USD)
        const totalUSD = parseFloat((total / 520).toFixed(2));
        const order = await paypalService.createOrder(totalUSD, concept, host, redirectUrl);
        
        res.status(200).json({
            success: true,
            orderId: order.id,
            approveUrl: order.approveUrl,
            isMock: order.isMock
        });
    } catch (error) {
        console.error('Error in createPaypalOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar pago con PayPal',
            error: error.message
        });
    }
};

/**
 * Captura el pago y registra la venta en la base de datos
 */
exports.capturePaypalOrder = async (req, res) => {
    console.log('=== CAPTURE PAYPAL ORDER ===');
    console.log('Request Body:', req.body);
    const connection = await pool.getConnection();
    try {
        const { orderId, usuario_id, producto_id, membresia_id, cantidad, total, tipo } = req.body;
        let membershipName = null;

        if (!orderId || !total || !tipo) {
            console.log('❌ Capture failed: missing parameters');
            return res.status(400).json({
                success: false,
                message: 'orderId, total y tipo son requeridos para la captura'
            });
        }

        // 1. Confirmar pago con PayPal
        const capture = await paypalService.captureOrder(orderId);
        console.log('PayPal Capture result:', capture);
        if (!capture.success) {
            console.log('❌ Capture failed: PayPal capture was not successful');
            return res.status(400).json({
                success: false,
                message: 'El pago de PayPal no se completó correctamente',
                status: capture.status
            });
        }

        // 2. Iniciar transacción local para registrar la venta
        await connection.beginTransaction();

        if (tipo === 'producto') {
            if (!producto_id || !cantidad) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'producto_id y cantidad son requeridos para ventas de productos'
                });
            }

            // Verificar stock
            const [prodRows] = await connection.execute('SELECT * FROM productos WHERE id = ?', [producto_id]);
            if (prodRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            const product = prodRows[0];
            if (product.stock < cantidad) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente. Disponible: ${product.stock}`
                });
            }

            // Descontar stock
            const newStock = product.stock - cantidad;
            await connection.execute('UPDATE productos SET stock = ? WHERE id = ?', [newStock, producto_id]);
        }

        if (tipo === 'membresia') {
            if (!usuario_id || !membresia_id) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'usuario_id y membresia_id son requeridos para la membresía'
                });
            }

            // Obtener datos de membresía
            const [membRows] = await connection.execute('SELECT * FROM membresias WHERE id = ?', [membresia_id]);
            if (membRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Membresía no encontrada'
                });
            }

            const membership = membRows[0];
            membershipName = membership.nombre;
            
            // Calcular fecha de vencimiento
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + membership.duracion_dias);
            const expiryDateStr = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

            // Actualizar usuario
            await connection.execute(
                'UPDATE usuarios SET membresia_id = ?, fecha_vencimiento = ? WHERE id = ?',
                [membresia_id, expiryDateStr, usuario_id]
            );
        }

        // Registrar venta
        const [result] = await connection.execute(
            'INSERT INTO ventas (usuario_id, producto_id, membresia_id, cantidad, total, tipo) VALUES (?, ?, ?, ?, ?, ?)',
            [usuario_id || null, producto_id || null, membresia_id || null, cantidad || 1, total, tipo]
        );

        await connection.commit();
        const saleId = result.insertId;

        if (tipo === 'membresia' && membershipName) {
            sendMembershipConfirmationToUser(usuario_id, membershipName, saleId).catch((pushError) => {
                console.error('Error al enviar push de membresía confirmada:', pushError);
            });
        }

        // 3. Enviar correo con recibo PDF en segundo plano
        if (usuario_id) {
            (async () => {
                try {
                    const [fullSaleRows] = await pool.execute(`
                        SELECT v.*, u.nombre as usuario_nombre, u.email as usuario_email, u.telefono as usuario_telefono,
                               p.nombre as producto_nombre, m.nombre as membresia_nombre
                        FROM ventas v
                        LEFT JOIN usuarios u ON v.usuario_id = u.id
                        LEFT JOIN productos p ON v.producto_id = p.id
                        LEFT JOIN membresias m ON v.membresia_id = m.id
                        WHERE v.id = ?
                    `, [saleId]);
                    
                    if (fullSaleRows.length > 0) {
                        const fullSale = fullSaleRows[0];
                        if (fullSale.usuario_email) {
                            const { generateSalePDF } = require('../services/pdfService');
                            const { sendMail } = require('../services/emailService');
                            
                            const pdfBuffer = await generateSalePDF(fullSale);
                            await sendMail(
                                fullSale.usuario_email,
                                `Confirmación de Compra #${fullSale.id} - Shark Gym`,
                                `Hola ${fullSale.usuario_nombre},\n\n¡Felicidades! Tu pago con PayPal se completó con éxito.\n\nAdjunto encontrarás el comprobante de tu compra en formato PDF.\n\nDetalles del cargo:\n- Total: ₡${Math.round(parseFloat(fullSale.total)).toLocaleString('es-CR')}\n\n¡Gracias por tu preferencia!`,
                                [{
                                    filename: `recibo_sharkgym_${fullSale.id}.pdf`,
                                    content: pdfBuffer
                                }]
                            );
                        }
                    }
                } catch (emailErr) {
                    console.error('Error al enviar correo del recibo PayPal:', emailErr);
                }
            })();
        }

        res.status(201).json({
            success: true,
            message: 'Pago capturado y venta registrada correctamente',
            saleId: saleId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error in capturePaypalOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar y capturar el pago',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Procesa un pago con tarjeta guardada o ingresada
 */
exports.processCardPayment = async (req, res) => {
    console.log('=== PROCESS CARD PAYMENT ===');
    console.log('Request Body:', req.body);
    const connection = await pool.getConnection();
    try {
        const { cardId, usuario_id, producto_id, membresia_id, cantidad, total, tipo } = req.body;
        let membershipName = null;

        if (!total || !tipo || !usuario_id) {
            return res.status(400).json({
                success: false,
                message: 'usuario_id, total y tipo son requeridos para procesar el pago'
            });
        }

        // 1. Iniciar transacción local para registrar la venta
        await connection.beginTransaction();

        if (tipo === 'producto') {
            if (!producto_id || !cantidad) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'producto_id y cantidad son requeridos para ventas de productos'
                });
            }

            // Verificar stock
            const [prodRows] = await connection.execute('SELECT * FROM productos WHERE id = ?', [producto_id]);
            if (prodRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            const product = prodRows[0];
            if (product.stock < cantidad) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente. Disponible: ${product.stock}`
                });
            }

            // Descontar stock
            const newStock = product.stock - cantidad;
            await connection.execute('UPDATE productos SET stock = ? WHERE id = ?', [newStock, producto_id]);
        }

        if (tipo === 'membresia') {
            if (!membresia_id) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'membresia_id es requerido para la membresía'
                });
            }

            // Obtener datos de membresía
            const [membRows] = await connection.execute('SELECT * FROM membresias WHERE id = ?', [membresia_id]);
            if (membRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Membresía no encontrada'
                });
            }

            const membership = membRows[0];
            membershipName = membership.nombre;
            
            // Calcular fecha de vencimiento
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + membership.duracion_dias);
            const expiryDateStr = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

            // Actualizar usuario
            await connection.execute(
                'UPDATE usuarios SET membresia_id = ?, fecha_vencimiento = ? WHERE id = ?',
                [membresia_id, expiryDateStr, usuario_id]
            );
        }

        // Registrar venta
        const [result] = await connection.execute(
            'INSERT INTO ventas (usuario_id, producto_id, membresia_id, cantidad, total, tipo) VALUES (?, ?, ?, ?, ?, ?)',
            [usuario_id || null, producto_id || null, membresia_id || null, cantidad || 1, total, tipo]
        );

        await connection.commit();
        const saleId = result.insertId;

        if (tipo === 'membresia' && membershipName) {
            sendMembershipConfirmationToUser(usuario_id, membershipName, saleId).catch((pushError) => {
                console.error('Error al enviar push de membresía confirmada:', pushError);
            });
        }

        // 3. Enviar correo con recibo PDF en segundo plano
        (async () => {
            try {
                const [fullSaleRows] = await pool.execute(`
                    SELECT v.*, u.nombre as usuario_nombre, u.email as usuario_email, u.telefono as usuario_telefono,
                           p.nombre as producto_nombre, m.nombre as membresia_nombre
                    FROM ventas v
                    LEFT JOIN usuarios u ON v.usuario_id = u.id
                    LEFT JOIN productos p ON v.producto_id = p.id
                    LEFT JOIN membresias m ON v.membresia_id = m.id
                    WHERE v.id = ?
                `, [saleId]);
                
                if (fullSaleRows.length > 0) {
                    const fullSale = fullSaleRows[0];
                    if (fullSale.usuario_email) {
                        const { generateSalePDF } = require('../services/pdfService');
                        const { sendMail } = require('../services/emailService');
                        
                        const pdfBuffer = await generateSalePDF(fullSale);
                        await sendMail(
                            fullSale.usuario_email,
                            'Comprobante de Compra - Shark Gym',
                            `Hola ${fullSale.usuario_nombre},\n\n¡Felicidades! Tu pago se completó con éxito.\n\nAdjunto encontrarás el comprobante de tu compra en formato PDF.\n\nDetalles del cargo:\n- Total: ₡${Math.round(parseFloat(fullSale.total)).toLocaleString('es-CR')}\n\n¡Gracias por tu preferencia!`,
                            [{ filename: `recibo_${saleId}.pdf`, content: pdfBuffer }]
                        );
                    }
                }
            } catch (emailErr) {
                console.error('Error al enviar correo del recibo:', emailErr);
            }
        })();

        res.status(200).json({
            success: true,
            message: 'Pago con tarjeta procesado y registrado correctamente',
            saleId
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in processCardPayment:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el pago con tarjeta',
            error: error.message
        });
    } finally {
        connection.release();
    }
};
