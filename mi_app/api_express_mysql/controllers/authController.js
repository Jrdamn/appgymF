/**
 * Controlador de Autenticación
 * @description Maneja las operaciones de registro, login y autenticación
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');

/**
 * Clase que maneja las operaciones de autenticación
 */
class AuthController {
    /**
     * Registra un nuevo usuario
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async register(req, res) {
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

            const { nombre, email, telefono, password, rol } = req.body;

            // Verificar si el email ya existe en alguna de las tablas
            const emailAlreadyExists = await User.emailExists(email);
            if (emailAlreadyExists) {
                return res.status(409).json({
                    success: false,
                    message: 'El email ya está registrado'
                });
            }

            // Hashear la contraseña
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Crear el usuario
            const newUser = await User.create({
                nombre,
                email,
                telefono,
                password: hashedPassword,
                rol: rol !== undefined ? parseInt(rol) : 1
            });

            // Generar JWT token con rol real del usuario
            const token = jwt.sign(
                { 
                    userId: newUser.id, 
                    email: newUser.email,
                    role: newUser.role
                },
                process.env.JWT_SECRET || 'default_secret_key',
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            res.status(201).json({
                success: true,
                message: 'Usuario registrado correctamente',
                data: {
                    user: newUser,
                    token,
                    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
                }
            });
        } catch (error) {
            console.error('Error en register:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Autentica un usuario (login)
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async login(req, res) {
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

            const { email, password } = req.body;

            // Buscar usuario por email (con contraseña)
            const user = await User.findByEmailWithPassword(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Verificar contraseña
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Generar JWT token con rol
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    role: user.role
                },
                process.env.JWT_SECRET || 'default_secret_key',
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            // Remover password del objeto user antes de enviarlo
            delete user.password;

            res.status(200).json({
                success: true,
                message: 'Login exitoso',
                data: {
                    user,
                    token,
                    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
                }
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtiene el perfil del usuario autenticado
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async getProfile(req, res) {
        try {
            const userId = req.user.userId;
            const role = req.user.role;

            const user = await User.findById(userId, role);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Perfil obtenido correctamente',
                data: user
            });
        } catch (error) {
            console.error('Error en getProfile:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Actualiza el perfil del usuario autenticado
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async updateProfile(req, res) {
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

            const userId = req.user.userId;
            const role = req.user.role;
            const { nombre, email, telefono, currentPassword, newPassword, foto_perfil, peso, estatura } = req.body;

            // Verificar si el usuario existe
            const existingUser = await User.findByEmailWithPassword(req.user.email);
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            let updateData = { 
                nombre, 
                email, 
                telefono,
                foto_perfil: foto_perfil !== undefined ? (foto_perfil === '' ? null : foto_perfil) : undefined,
                peso: peso !== undefined ? (peso === '' || peso === null ? null : parseFloat(peso)) : undefined,
                estatura: estatura !== undefined ? (estatura === '' || estatura === null ? null : parseInt(estatura, 10)) : undefined
            };

            // Si se quiere cambiar la contraseña
            if (newPassword) {
                if (!currentPassword) {
                    return res.status(400).json({
                        success: false,
                        message: 'La contraseña actual es requerida para cambiar la contraseña'
                    });
                }

                // Verificar contraseña actual
                const isCurrentPasswordValid = await bcrypt.compare(currentPassword, existingUser.password);
                if (!isCurrentPasswordValid) {
                    return res.status(401).json({
                        success: false,
                        message: 'Contraseña actual incorrecta'
                    });
                }

                // Hashear nueva contraseña
                const saltRounds = 12;
                updateData.password = await bcrypt.hash(newPassword, saltRounds);
            }

            // Verificar si el email ya existe en otro usuario
            if (email !== existingUser.email) {
                const emailAlreadyExists = await User.emailExists(email);
                if (emailAlreadyExists) {
                    return res.status(409).json({
                        success: false,
                        message: 'El email ya está registrado en otro usuario'
                    });
                }
            }

            // Actualizar el usuario
            const updatedUser = await User.update(userId, updateData, role);

            res.status(200).json({
                success: true,
                message: 'Perfil actualizado correctamente',
                data: updatedUser
            });
        } catch (error) {
            console.error('Error en updateProfile:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Renueva el token JWT
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async refreshToken(req, res) {
        try {
            const userId = req.user.userId;
            const email = req.user.email;
            const role = req.user.role;

            // Generar nuevo token
            const newToken = jwt.sign(
                { userId, email, role },
                process.env.JWT_SECRET || 'default_secret_key',
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            res.status(200).json({
                success: true,
                message: 'Token renovado correctamente',
                data: {
                    token: newToken,
                    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
                }
            });
        } catch (error) {
            console.error('Error en refreshToken:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Logout (en el cliente simplemente eliminar el token)
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     * @returns {Promise<void>}
     */
    static async logout(req, res) {
        try {
            // En una implementación más avanzada, aquí podrías:
            // - Agregar el token a una lista negra
            // - Invalidar el token en una base de datos de sesiones
            // - Registrar el logout en logs de auditoría

            res.status(200).json({
                success: true,
                message: 'Logout exitoso',
                data: {
                    message: 'Token invalidado. Elimina el token del cliente.'
                }
            });
        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Envía un código de 6 dígitos para restablecer contraseña
     */
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ success: false, message: 'El email es requerido' });
            }

            // Buscar usuario
            const User = require('../models/User');
            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(404).json({ success: false, message: 'No existe un usuario registrado con ese email' });
            }

            // Generar código de 6 dígitos
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            // Expira en 15 minutos
            const expires = new Date(Date.now() + 15 * 60 * 1000);

            // Guardar en la base de datos
            const { pool } = require('../config/database');
            await pool.execute(
                'UPDATE usuarios SET reset_code = ?, reset_code_expires = ? WHERE id = ?',
                [code, expires, user.id]
            );

            // Enviar correo
            const { sendMail } = require('../services/emailService');
            const mailSent = await sendMail(
                user.email,
                'Recuperación de Contraseña - Shark Gym',
                `Hola ${user.nombre},\n\nHas solicitado restablecer tu contraseña. Tu código de verificación de 6 dígitos es:\n\n${code}\n\nEste código vencerá en 15 minutos.\n\nSi no solicitaste este cambio, por favor ignora este correo.`
            );

            if (mailSent) {
                return res.status(200).json({
                    success: true,
                    message: 'Código de recuperación enviado al correo correctamente.'
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo enviar el correo de recuperación. Por favor, verifica la configuración SMTP.'
                });
            }
        } catch (error) {
            console.error('Error en forgotPassword:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
        }
    }

    /**
     * Valida el código y cambia la contraseña
     */
    static async resetPassword(req, res) {
        try {
            const { email, code, newPassword } = req.body;
            if (!email || !code || !newPassword) {
                return res.status(400).json({ success: false, message: 'Todos los campos son requeridos (email, code, newPassword)' });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
            }

            // Buscar usuario con el código
            const { pool } = require('../config/database');
            const [rows] = await pool.execute(
                'SELECT * FROM usuarios WHERE email = ? AND reset_code = ? AND reset_code_expires > NOW()',
                [email, code]
            );

            if (rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de recuperación inválido o expirado'
                });
            }

            const user = rows[0];

            // Hashear nueva contraseña
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Actualizar contraseña y borrar código
            await pool.execute(
                'UPDATE usuarios SET password = ?, reset_code = NULL, reset_code_expires = NULL WHERE id = ?',
                [hashedPassword, user.id]
            );

            res.status(200).json({
                success: true,
                message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.'
            });
        } catch (error) {
            console.error('Error en resetPassword:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
        }
    }

    /**
     * Cancela la membresía activa del usuario autenticado
     */
    static async cancelMembership(req, res) {
        try {
            const userId = req.user.userId;
            const { pool } = require('../config/database');
            
            await pool.execute(
                'UPDATE usuarios SET membresia_id = NULL, fecha_vencimiento = NULL WHERE id = ?',
                [userId]
            );

            res.status(200).json({
                success: true,
                message: 'Membresía cancelada correctamente'
            });
        } catch (error) {
            console.error('Error en cancelMembership:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cancelar la membresía',
                error: error.message
            });
        }
    }
}

module.exports = AuthController;