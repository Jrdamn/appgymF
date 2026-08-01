const { pool } = require('../config/database');

class Checkin {
    constructor(data) {
        this.id = data.id;
        this.usuario_id = data.usuario_id;
        this.fecha = data.fecha;
        this.fecha_salida = data.fecha_salida;
    }

    static async create(usuarioId) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO checkins (usuario_id) VALUES (?)',
                [usuarioId]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error in Checkin.create:', error);
            throw error;
        }
    }

    static async findActiveToday(usuarioId) {
        try {
            const [rows] = await pool.execute(`
                SELECT * FROM checkins
                WHERE usuario_id = ? AND DATE(fecha) = CURDATE() AND fecha_salida IS NULL
                ORDER BY fecha DESC
                LIMIT 1
            `, [usuarioId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error in Checkin.findActiveToday:', error);
            throw error;
        }
    }

    static async registerCheckout(id) {
        try {
            const [result] = await pool.execute(
                'UPDATE checkins SET fecha_salida = CURRENT_TIMESTAMP WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in Checkin.registerCheckout:', error);
            throw error;
        }
    }

    static async findToday() {
        try {
            const [rows] = await pool.execute(`
                SELECT c.*, u.nombre as usuario_nombre, u.email as usuario_email, u.telefono as usuario_telefono
                FROM checkins c
                JOIN usuarios u ON c.usuario_id = u.id
                WHERE DATE(c.fecha) = CURDATE()
                ORDER BY c.fecha DESC
            `);
            return rows;
        } catch (error) {
            console.error('Error in Checkin.findToday:', error);
            throw error;
        }
    }

    static async findHistoryByUserId(usuarioId) {
        try {
            const [rows] = await pool.execute(`
                SELECT * FROM checkins
                WHERE usuario_id = ?
                ORDER BY fecha DESC
                LIMIT 50
            `, [usuarioId]);
            return rows;
        } catch (error) {
            console.error('Error in Checkin.findHistoryByUserId:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.execute(
                'DELETE FROM checkins WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in Checkin.delete:', error);
            throw error;
        }
    }
}

module.exports = Checkin;
