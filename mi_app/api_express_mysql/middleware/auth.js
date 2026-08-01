/**
 * Middleware de Autenticación JWT
 * @description Middleware para verificar y validar tokens JWT
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware para verificar token JWT
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const authenticateToken = async (req, res, next) => {
    try {
        // Obtener el token del header Authorization
        const authHeader = req.headers['authorization'];
        let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        // Fallback para query parameters (útil para descarga directa de archivos en navegador)
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token de acceso requerido',
                error: 'No se proporcionó token de autenticación'
            });
        }

        // Verificar y decodificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');

        // Verificar que el usuario aún existe en su tabla respectiva
        const user = await User.findById(decoded.userId, decoded.role || 'user');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido',
                error: 'El usuario asociado al token no existe'
            });
        }

        // Agregar información del usuario al request (incluyendo rol)
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role || 'user'
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido',
                error: 'El token proporcionado no es válido'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado',
                error: 'El token ha expirado, por favor inicia sesión nuevamente'
            });
        }

        console.error('Error en authenticateToken:', error);
        return res.status(500).json({
            success: false,
            message: 'Error de autenticación',
            error: 'Error interno del servidor'
        });
    }
};

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero agrega información del usuario si existe
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return next(); // Continuar sin autenticación
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');
        const user = await User.findById(decoded.userId, decoded.role || 'user');

        if (user) {
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role || 'user'
            };
        }

        next();
    } catch (error) {
        // En caso de error, simplemente continuar sin autenticación
        next();
    }
};

/**
 * Middleware para verificar roles (para futuras implementaciones)
 * @param {Array} allowedRoles - Roles permitidos
 * @returns {Function} Middleware function
 */
const authorizeRoles = (allowedRoles = []) => {
    return (req, res, next) => {
        // Por ahora, solo verificamos que el usuario esté autenticado
        // En el futuro se puede extender para manejar roles específicos
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }

        // Aquí se podría agregar lógica de roles en el futuro
        // if (!allowedRoles.includes(req.user.role)) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'No tienes permisos para acceder a este recurso'
        //     });
        // }

        next();
    };
};

/**
 * Middleware para comprobar que el usuario sea administrador
 */
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Autenticación requerida',
            error: 'No se encontró información de autenticación'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado',
            error: 'Se requieren permisos de administrador para realizar esta acción'
        });
    }

    next();
};

/**
 * Middleware para comprobar que el usuario sea administrador o coach
 */
const isCoachOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Autenticación requerida',
            error: 'No se encontró información de autenticación'
        });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'coach') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado',
            error: 'Se requieren permisos de administrador o coach para realizar esta acción'
        });
    }

    next();
};

const verifyOwnership = (req, res, next) => {
    const requestedUserId = parseInt(req.params.id);
    const currentUserId = req.user.userId;

    if (requestedUserId !== currentUserId) {
        return res.status(403).json({
            success: false,
            message: 'No tienes permisos para acceder a este recurso',
            error: 'Solo puedes acceder a tu propia información'
        });
    }

    next();
};

module.exports = {
    authenticateToken,
    optionalAuth,
    authorizeRoles,
    verifyOwnership,
    isCoachOrAdmin,
    isAdmin
};