const { pool } = require('../config/database');

class Membresia {
    constructor(data) {
        this.id = data.id;
        this.nombre = data.nombre;
        this.precio = data.precio;
        this.duracion_dias = data.duracion_dias;
        this.fecha_creacion = data.fecha_creacion;
    }

    static async findAll() {
        try {
            const [rows] = await pool.execute('SELECT * FROM membresias ORDER BY precio ASC');
            return rows;
        } catch (error) {
            console.error('Error in Membresia.findAll:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.execute('SELECT * FROM membresias WHERE id = ?', [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error in Membresia.findById:', error);
            throw error;
        }
    }

    static async create(data) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO membresias (nombre, precio, duracion_dias) VALUES (?, ?, ?)',
                [data.nombre, data.precio, data.duracion_dias]
            );
            return await this.findById(result.insertId);
        } catch (error) {
            console.error('Error in Membresia.create:', error);
            throw error;
        }
    }
}

module.exports = Membresia;
