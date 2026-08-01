const Rutina = require('../models/Rutina');

/**
 * Los clientes consultan sus rutinas
 */
exports.getMyRoutines = async (req, res) => {
    try {
        const userId = req.user.userId;
        const routines = await Rutina.findByUserId(userId);
        res.status(200).json({
            success: true,
            data: routines
        });
    } catch (error) {
        console.error('Error in getMyRoutines:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tus rutinas',
            error: error.message
        });
    }
};

/**
 * El administrador consulta las rutinas de un usuario
 */
exports.getUserRoutines = async (req, res) => {
    try {
        const { userId } = req.params;
        const routines = await Rutina.findByUserId(userId);
        res.status(200).json({
            success: true,
            data: routines
        });
    } catch (error) {
        console.error('Error in getUserRoutines:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las rutinas del usuario',
            error: error.message
        });
    }
};

/**
 * El administrador crea/asigna una rutina
 */
exports.createRoutine = async (req, res) => {
    try {
        const { usuario_id, nombre, descripcion } = req.body;

        if (!usuario_id || !nombre || !descripcion) {
            return res.status(400).json({
                success: false,
                message: 'usuario_id, nombre y descripcion son requeridos'
            });
        }

        const newRoutine = await Rutina.create({ usuario_id, nombre, descripcion });

        // Registrar notificación para el cliente e enviar correo
        try {
            const { pool } = require('../config/database');
            await pool.execute(
                'INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)',
                [usuario_id, `Tu entrenador ha asignado una nueva rutina de ${nombre} para ti. ¡A entrenar duro! 💪`]
            );

            // Enviar correo informativo en segundo plano
            (async () => {
                try {
                    const [userRows] = await pool.execute(
                        'SELECT nombre, email FROM usuarios WHERE id = ?',
                        [usuario_id]
                    );
                    if (userRows.length > 0 && userRows[0].email) {
                        const user = userRows[0];
                        const { sendMail } = require('../services/emailService');
                        await sendMail(
                            user.email,
                            `🏋️ ¡Nueva Rutina Asignada! - Shark Gym`,
                            `Hola ${user.nombre},\n\nTu entrenador en Shark Gym te ha asignado una nueva rutina: "${nombre}".\n\nDescripción/Notas:\n${descripcion}\n\nIngresa a la aplicación móvil en la sección de "Rutinas" para ver los detalles, reproducir los ejercicios animados con GIFs y seguir tu plan de entrenamiento.\n\n¡A entrenar duro! 💪\n\nShark Gym 🦈`
                        );
                    }
                } catch (mailErr) {
                    console.error('Error al enviar correo de notificación de rutina:', mailErr);
                }
            })();
        } catch (notifErr) {
            console.error('Error al registrar notificaciones en segundo plano:', notifErr);
        }

        res.status(201).json({
            success: true,
            message: 'Rutina asignada correctamente',
            data: newRoutine
        });
    } catch (error) {
        console.error('Error in createRoutine:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar la rutina',
            error: error.message
        });
    }
};

/**
 * El administrador elimina una rutina
 */
exports.deleteRoutine = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Rutina.delete(id);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Rutina no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Rutina eliminada correctamente'
        });
    } catch (error) {
        console.error('Error in deleteRoutine:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar la rutina',
            error: error.message
        });
    }
};
