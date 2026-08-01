const Producto = require('../models/Producto');

exports.getAllProducts = async (req, res) => {
    try {
        const products = await Producto.findAll();
        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { nombre, precio, stock } = req.body;
        if (!nombre || precio === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, completa nombre y precio'
            });
        }

        const newProduct = await Producto.create({ nombre, precio: parseFloat(precio), stock: stock ? parseInt(stock) : 0 });
        res.status(201).json({
            success: true,
            message: 'Producto creado correctamente',
            data: newProduct
        });
    } catch (error) {
        console.error('Error in createProduct:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, precio, stock } = req.body;
        if (!nombre || precio === undefined || stock === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, completa nombre, precio y stock'
            });
        }

        const updatedProduct = await Producto.update(id, { nombre, precio: parseFloat(precio), stock: parseInt(stock) });
        res.status(200).json({
            success: true,
            message: 'Producto actualizado correctamente',
            data: updatedProduct
        });
    } catch (error) {
        console.error('Error in updateProduct:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const success = await Producto.delete(id);
        if (success) {
            res.status(200).json({
                success: true,
                message: 'Producto eliminado correctamente'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};
