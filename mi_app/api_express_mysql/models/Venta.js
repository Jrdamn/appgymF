const { pool } = require('../config/database');

class Venta {
    constructor(data) {
        this.id = data.id;
        this.usuario_id = data.usuario_id;
        this.producto_id = data.producto_id;
        this.membresia_id = data.membresia_id;
        this.cantidad = data.cantidad;
        this.total = data.total;
        this.tipo = data.tipo;
        this.fecha = data.fecha;
    }

    static async create(data) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO ventas (usuario_id, producto_id, membresia_id, cantidad, total, tipo) VALUES (?, ?, ?, ?, ?, ?)',
                [data.usuario_id || null, data.producto_id || null, data.membresia_id || null, data.cantidad || 1, data.total, data.tipo]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error in Venta.create:', error);
            throw error;
        }
    }

    static async findAll() {
        try {
            // Unimos con usuarios, productos y membresías para mostrar nombres descriptivos en la lista de ventas
            const [rows] = await pool.execute(`
                SELECT v.*, u.nombre as usuario_nombre, p.nombre as producto_nombre, m.nombre as membresia_nombre
                FROM ventas v
                LEFT JOIN usuarios u ON v.usuario_id = u.id
                LEFT JOIN productos p ON v.producto_id = p.id
                LEFT JOIN membresias m ON v.membresia_id = m.id
                ORDER BY v.fecha DESC
            `);
            return rows;
        } catch (error) {
            console.error('Error in Venta.findAll:', error);
            throw error;
        }
    }

    static async getStats() {
        try {
            // 1. Total ventas de hoy
            const [todaySales] = await pool.execute(`
                SELECT COALESCE(SUM(total), 0) as total_hoy
                FROM ventas
                WHERE DATE(fecha) = CURDATE()
            `);

            // Total general (Histórico)
            const [allTimeSales] = await pool.execute(`
                SELECT COALESCE(SUM(total), 0) as total_general
                FROM ventas
            `);

            // 2. Conteo de checkins de hoy
            const [todayCheckins] = await pool.execute(`
                SELECT COUNT(*) as total_checkins
                FROM checkins
                WHERE DATE(fecha) = CURDATE()
            `);

            // 3. Clientes con membresía vencida o por vencer en los próximos 3 días
            const [expiringMembers] = await pool.execute(`
                SELECT id, nombre, email, fecha_vencimiento
                FROM usuarios
                WHERE fecha_vencimiento IS NOT NULL
                  AND fecha_vencimiento >= CURDATE()
                  AND fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
            `);

            // 4. Productos con stock bajo (< 5)
            const [lowStockProds] = await pool.execute(`
                SELECT id, nombre, stock, precio
                FROM productos
                WHERE stock < 5
            `);

            return {
                totalHoy: parseFloat(todaySales[0].total_hoy),
                totalGeneral: parseFloat(allTimeSales[0].total_general),
                checkinsHoy: parseInt(todayCheckins[0].total_checkins),
                porVencer: expiringMembers,
                stockBajo: lowStockProds
            };
        } catch (error) {
            console.error('Error in Venta.getStats:', error);
            throw error;
        }
    }

    static async findToday() {
        try {
            const [rows] = await pool.execute(`
                SELECT v.*, u.nombre as usuario_nombre, p.nombre as producto_nombre, m.nombre as membresia_nombre
                FROM ventas v
                LEFT JOIN usuarios u ON v.usuario_id = u.id
                LEFT JOIN productos p ON v.producto_id = p.id
                LEFT JOIN membresias m ON v.membresia_id = m.id
                WHERE DATE(v.fecha) = CURDATE()
                ORDER BY v.fecha DESC
            `);
            return rows;
        } catch (error) {
            console.error('Error in Venta.findToday:', error);
            throw error;
        }
    }
}

module.exports = Venta;
