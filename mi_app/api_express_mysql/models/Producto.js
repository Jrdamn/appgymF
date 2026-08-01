const { pool } = require('../config/database');

class Producto {
    constructor(data) {
        this.id = data.id;
        this.nombre = data.nombre;
        this.precio = data.precio;
        this.stock = data.stock;
        this.fecha_creacion = data.fecha_creacion;
    }

    static async findAll() {
        try {
            const [rows] = await pool.execute('SELECT * FROM productos ORDER BY nombre ASC');
            return rows;
        } catch (error) {
            console.error('Error in Producto.findAll:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.execute('SELECT * FROM productos WHERE id = ?', [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error in Producto.findById:', error);
            throw error;
        }
    }

    static async create(data) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)',
                [data.nombre, data.precio, data.stock || 0]
            );
            return await this.findById(result.insertId);
        } catch (error) {
            console.error('Error in Producto.create:', error);
            throw error;
        }
    }

    static async update(id, data) {
        try {
            await pool.execute(
                'UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?',
                [data.nombre, data.precio, data.stock, id]
            );
            return await this.findById(id);
        } catch (error) {
            console.error('Error in Producto.update:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            const [result] = await pool.execute('DELETE FROM productos WHERE id = ?', [id]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in Producto.delete:', error);
            throw error;
        }
    }
}

module.exports = Producto;
