const Venta = require('../models/Venta');
const Producto = require('../models/Producto');
const Membresia = require('../models/Membresia');
const { pool } = require('../config/database');
const { sendMembershipConfirmationToUser } = require('../services/pushNotificationService');
const { createInAppNotification } = require('../services/inAppNotificationService');

exports.getAllSales = async (req, res) => {
    try {
        const sales = await Venta.findAll();
        res.status(200).json({
            success: true,
            data: sales
        });
    } catch (error) {
        console.error('Error in getAllSales:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.getStats = async (req, res) => {
    try {
        const stats = await Venta.getStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error in getStats:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.createSale = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { usuario_id, producto_id, membresia_id, cantidad, total, tipo } = req.body;
        let membershipName = null;

        if (!tipo || !total) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Tipo y total son requeridos'
            });
        }

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
                    message: 'usuario_id y membresia_id son requeridos para asignación de membresías'
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

        // Crear registro de venta
        const [result] = await connection.execute(
            'INSERT INTO ventas (usuario_id, producto_id, membresia_id, cantidad, total, tipo) VALUES (?, ?, ?, ?, ?, ?)',
            [usuario_id || null, producto_id || null, membresia_id || null, cantidad || 1, total, tipo]
        );

        if (tipo === 'membresia' && membershipName) {
            await createInAppNotification(
                usuario_id,
                `Tu membresía ${membershipName} fue activada. ¡Nos vemos en Shark Gym!`,
                connection
            );
        }

        await connection.commit();

        const saleId = result.insertId;

        if (tipo === 'membresia' && membershipName) {
            sendMembershipConfirmationToUser(usuario_id, membershipName, saleId).catch((pushError) => {
                console.error('Error al enviar push de membresía confirmada:', pushError);
            });
        }

        // Enviar correo con el PDF adjunto en segundo plano para no demorar la respuesta HTTP
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
                                `Hola ${fullSale.usuario_nombre},\n\n¡Gracias por tu compra en Shark Gym!\n\nAdjunto a este correo encontrarás el recibo de tu compra en formato PDF.\n\nDetalles del cargo:\n- Total: ₡${Math.round(parseFloat(fullSale.total)).toLocaleString('es-CR')}\n\n¡Sigue entrenando duro!`,
                                [{
                                    filename: `recibo_sharkgym_${fullSale.id}.pdf`,
                                    content: pdfBuffer
                                }]
                            );
                        }
                    }
                } catch (emailErr) {
                    console.error('Error al enviar correo de recibo en segundo plano:', emailErr);
                }
            })();
        }

        res.status(201).json({
            success: true,
            message: 'Venta registrada con éxito',
            saleId: saleId
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in createSale:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno al procesar la venta',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

exports.getTodaySales = async (req, res) => {
    try {
        const sales = await Venta.findToday();
        res.status(200).json({
            success: true,
            data: sales
        });
    } catch (error) {
        console.error('Error in getTodaySales:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.getSalePDF = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.execute(`
            SELECT v.*, u.nombre as usuario_nombre, u.email as usuario_email, u.telefono as usuario_telefono,
                   p.nombre as producto_nombre, m.nombre as membresia_nombre
            FROM ventas v
            LEFT JOIN usuarios u ON v.usuario_id = u.id
            LEFT JOIN productos p ON v.producto_id = p.id
            LEFT JOIN membresias m ON v.membresia_id = m.id
            WHERE v.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        const sale = rows[0];
        const { generateSalePDF } = require('../services/pdfService');
        const pdfBuffer = await generateSalePDF(sale);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=recibo_${sale.id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in getSalePDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar PDF de la venta',
            error: error.message
        });
    }
};

exports.getReportPDF = async (req, res) => {
    try {
        // 1. Obtener estadísticas generales de ingresos / gastos
        const [totalSalesRow] = await pool.execute(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(CASE WHEN tipo = 'producto' THEN total ELSE 0 END), 0) as total_productos,
                COALESCE(SUM(CASE WHEN tipo = 'membresia' THEN total ELSE 0 END), 0) as total_membresias,
                COALESCE(SUM(total), 0) as total_general,
                COALESCE(SUM(CASE WHEN DATE(fecha) = CURDATE() THEN total ELSE 0 END), 0) as total_hoy
            FROM ventas
        `);
        const stats = totalSalesRow[0];

        // 2. Obtener reporte de stock de productos (Consumido vs Restante)
        const [productsReport] = await pool.execute(`
            SELECT 
                p.nombre, 
                p.stock AS stock_restante, 
                COALESCE(SUM(v.cantidad), 0) AS stock_vendido,
                COALESCE(SUM(v.total), 0) AS total_recaudado
            FROM productos p
            LEFT JOIN ventas v ON p.id = v.producto_id
            GROUP BY p.id, p.nombre, p.stock
        `);

        // 3. Obtener reporte de membresías vendidas
        const [membershipsReport] = await pool.execute(`
            SELECT 
                m.nombre, 
                COUNT(v.id) AS cantidad_vendida,
                COALESCE(SUM(v.total), 0) AS total_recaudado
            FROM membresias m
            LEFT JOIN ventas v ON m.id = v.membresia_id
            GROUP BY m.id, m.nombre
        `);

        // 4. Obtener últimas 15 ventas
        const [recentSales] = await pool.execute(`
            SELECT v.id, v.fecha, v.total, v.tipo, v.cantidad,
                   u.nombre as usuario_nombre,
                   p.nombre as producto_nombre, m.nombre as membresia_nombre
            FROM ventas v
            LEFT JOIN usuarios u ON v.usuario_id = u.id
            LEFT JOIN productos p ON v.producto_id = p.id
            LEFT JOIN membresias m ON v.membresia_id = m.id
            ORDER BY v.fecha DESC
            LIMIT 15
        `);

        const { generateReportPDF } = require('../services/pdfService');
        const pdfBuffer = await generateReportPDF({
            stats,
            products: productsReport,
            memberships: membershipsReport,
            sales: recentSales
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte_sharkgym.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in getReportPDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar el reporte PDF',
            error: error.message
        });
    }
};
