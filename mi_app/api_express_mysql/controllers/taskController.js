const { pool } = require('../config/database');

exports.getMyTasks = async (req, res) => {
    try {
        const [tasks] = await pool.execute(
            `SELECT id, titulo, completada, fecha_creacion, fecha_actualizacion
             FROM tareas_usuario
             WHERE usuario_id = ?
             ORDER BY completada ASC, fecha_creacion DESC`,
            [req.user.userId]
        );

        return res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        console.error('Error al obtener la lista de tareas:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudieron cargar las tareas'
        });
    }
};

exports.createTask = async (req, res) => {
    const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
    if (!titulo || titulo.length > 255) {
        return res.status(400).json({
            success: false,
            message: 'El título es requerido y no puede superar los 255 caracteres'
        });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO tareas_usuario (usuario_id, titulo) VALUES (?, ?)',
            [req.user.userId, titulo]
        );

        return res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                titulo,
                completada: 0
            }
        });
    } catch (error) {
        console.error('Error al crear tarea:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo crear la tarea'
        });
    }
};

exports.updateTask = async (req, res) => {
    const taskId = Number(req.params.id);
    const { completada } = req.body || {};
    if (!Number.isSafeInteger(taskId) || taskId <= 0 || typeof completada !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: 'El identificador o el estado de la tarea no son válidos'
        });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE tareas_usuario SET completada = ? WHERE id = ? AND usuario_id = ?',
            [completada ? 1 : 0, taskId, req.user.userId]
        );

        if (result.affectedRows === 0) {
            const [tasks] = await pool.execute(
                'SELECT id FROM tareas_usuario WHERE id = ? AND usuario_id = ?',
                [taskId, req.user.userId]
            );
            if (tasks.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Tarea no encontrada'
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: { id: taskId, completada }
        });
    } catch (error) {
        console.error('Error al actualizar tarea:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo actualizar la tarea'
        });
    }
};

exports.deleteTask = async (req, res) => {
    const taskId = Number(req.params.id);
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
        return res.status(400).json({
            success: false,
            message: 'El identificador de la tarea no es válido'
        });
    }

    try {
        const [result] = await pool.execute(
            'DELETE FROM tareas_usuario WHERE id = ? AND usuario_id = ?',
            [taskId, req.user.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error al eliminar tarea:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo eliminar la tarea'
        });
    }
};
