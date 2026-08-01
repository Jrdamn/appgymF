const { pool } = require('../config/database');

class Rutina {
    constructor(data) {
        this.id = data.id;
        this.usuario_id = data.usuario_id;
        this.nombre = data.nombre;
        this.descripcion = data.descripcion;
        this.fecha_creacion = data.fecha_creacion;
    }

    /**
     * Crea una nueva rutina asignada a un usuario
     */
    static async create(data) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO rutinas (usuario_id, nombre, descripcion) VALUES (?, ?, ?)',
                [data.usuario_id, data.nombre.trim(), data.descripcion.trim()]
            );
            return {
                id: result.insertId,
                ...data
            };
        } catch (error) {
            console.error('Error in Rutina.create:', error);
            throw error;
        }
    }

    /**
     * Obtiene las rutinas de un usuario
     */
    static async findByUserId(userId) {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM rutinas WHERE usuario_id = ? ORDER BY fecha_creacion DESC',
                [userId]
            );
            return rows;
        } catch (error) {
            console.error('Error in Rutina.findByUserId:', error);
            throw error;
        }
    }

    /**
     * Elimina una rutina por ID
     */
    static async delete(id) {
        try {
            const [result] = await pool.execute(
                'DELETE FROM rutinas WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in Rutina.delete:', error);
            throw error;
        }
    }
}

module.exports = Rutina;
