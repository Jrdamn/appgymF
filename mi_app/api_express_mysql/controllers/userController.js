/**
 * Controlador de Usuarios
 * @description Maneja todas las operaciones HTTP para la entidad Usuario
 */

const User = require('../models/User');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

/**
 * Clase que maneja las operaciones del controlador de usuarios
 */
class UserController {
    /**
     * Obtiene todos los usuarios con paginación opcional
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async getAllUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search;

            let result;
            // este comentario es para subir un cambio

            if (search) {
                // Si hay parámetro de búsqueda, buscar por nombre
                const users = await User.searchByName(search);
                result = {
                    users,
                    pagination: {
                        currentPage: 1,
                        totalPages: 1,
                        totalUsers: users.length,
                        hasNextPage: false,
                        hasPrevPage: false
                    }
                };
            } else {
                // Obtener usuarios con paginación
                result = await User.paginate(page, limit);
            }

            res.status(200).json({
                success: true,
                message: 'Usuarios obtenidos correctamente',
                data: result.users,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Error en getAllUsers:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtiene un usuario por su ID
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async getUserById(req, res) {
        try {
            const { id } = req.params;

            // Validar que el ID sea un número
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID debe ser un número válido'
                });
            }

            const user = await User.findById(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Usuario obtenido correctamente',
                data: user
            });
        } catch (error) {
            console.error('Error en getUserById:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Crea un nuevo usuario
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async createUser(req, res) {
        try {
            // Verificar errores de validación
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            const { nombre, email, telefono, password } = req.body;

            // Verificar si el email ya existe en alguna de las tablas
            const emailAlreadyExists = await User.emailExists(email);
            if (emailAlreadyExists) {
                return res.status(409).json({
                    success: false,
                    message: 'El email ya está registrado'
                });
            }

            // Hashear contraseña (usar la provista o la default)
            const rawPassword = password || 'Password123!';
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);

            // Crear el usuario
            const newUser = await User.create({ nombre, email, telefono, password: hashedPassword });

            res.status(201).json({
                success: true,
                message: 'Usuario creado correctamente',
                data: newUser
            });
        } catch (error) {
            console.error('Error en createUser:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Actualiza un usuario existente
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async updateUser(req, res) {
        try {
            // Verificar errores de validación
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const { nombre, email, telefono, rol, foto_perfil, peso, estatura } = req.body;

            // Validar que el ID sea un número
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID debe ser un número válido'
                });
            }

            // Verificar si el usuario existe
            const existingUser = await User.findById(id);
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Verificar si el email ya existe en otro usuario
            if (email !== existingUser.email) {
                const emailUser = await User.findByEmail(email);
                if (emailUser && emailUser.id !== parseInt(id)) {
                    return res.status(409).json({
                        success: false,
                        message: 'El email ya está registrado en otro usuario'
                    });
                }
            }

            // Actualizar el usuario
            const updatedUser = await User.update(id, { 
                nombre, 
                email, 
                telefono,
                rol: rol !== undefined ? parseInt(rol) : undefined,
                foto_perfil,
                peso: peso !== undefined ? (peso === null ? null : parseFloat(peso)) : undefined,
                estatura: estatura !== undefined ? (estatura === null ? null : parseInt(estatura)) : undefined
            });

            res.status(200).json({
                success: true,
                message: 'Usuario actualizado correctamente',
                data: updatedUser
            });
        } catch (error) {
            console.error('Error en updateUser:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Elimina un usuario
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async deleteUser(req, res) {
        try {
            const { id } = req.params;

            // Validar que el ID sea un número
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID debe ser un número válido'
                });
            }

            // Verificar si el usuario existe
            const existingUser = await User.findById(id);
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Eliminar el usuario
            await User.delete(id);

            res.status(200).json({
                success: true,
                message: 'Usuario eliminado correctamente'
            });
        } catch (error) {
            console.error('Error en deleteUser:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Busca usuarios por nombre
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async searchUsers(req, res) {
        try {
            const { q } = req.query;

            if (!q || q.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El parámetro de búsqueda es requerido'
                });
            }

            const users = await User.searchByName(q.trim());

            res.status(200).json({
                success: true,
                message: 'Búsqueda completada',
                data: users,
                count: users.length
            });
        } catch (error) {
            console.error('Error en searchUsers:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtiene estadísticas de usuarios
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async getUserStats(req, res) {
        try {
            const total = await User.count();

            res.status(200).json({
                success: true,
                message: 'Estadísticas obtenidas correctamente',
                data: {
                    totalUsers: total,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error en getUserStats:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtiene las notificaciones no leídas de un usuario
     */
    static async getUnreadNotifications(req, res) {
        try {
            const userId = req.user.userId;
            const { pool } = require('../config/database');
            const [rows] = await pool.execute(
                'SELECT * FROM notificaciones WHERE usuario_id = ? AND leido = 0 ORDER BY fecha_creacion DESC',
                [userId]
            );
            res.status(200).json({
                success: true,
                data: rows
            });
        } catch (error) {
            console.error('Error in getUnreadNotifications:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones',
                error: error.message
            });
        }
    }

    /**
     * Marca todas las notificaciones de un usuario como leídas
     */
    static async markNotificationsAsRead(req, res) {
        try {
            const userId = req.user.userId;
            const { pool } = require('../config/database');
            await pool.execute(
                'UPDATE notificaciones SET leido = 1 WHERE usuario_id = ? AND leido = 0',
                [userId]
            );
            res.status(200).json({
                success: true,
                message: 'Notificaciones marcadas como leídas'
            });
        } catch (error) {
            console.error('Error in markNotificationsAsRead:', error);
            res.status(500).json({
                success: false,
                message: 'Error al marcar notificaciones',
                error: error.message
            });
        }
    }
}

module.exports = UserController;