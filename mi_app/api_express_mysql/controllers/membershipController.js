const Membresia = require('../models/Membresia');

exports.getAllMemberships = async (req, res) => {
    try {
        const memberships = await Membresia.findAll();
        res.status(200).json({
            success: true,
            data: memberships
        });
    } catch (error) {
        console.error('Error in getAllMemberships:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

exports.createMembership = async (req, res) => {
    try {
        const { nombre, precio, duracion_dias } = req.body;
        if (!nombre || !precio || !duracion_dias) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, completa nombre, precio y duracion_dias'
            });
        }

        const newMembership = await Membresia.create({ nombre, precio: parseFloat(precio), duracion_dias: parseInt(duracion_dias) });
        res.status(201).json({
            success: true,
            message: 'Membresía creada correctamente',
            data: newMembership
        });
    } catch (error) {
        console.error('Error in createMembership:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};
