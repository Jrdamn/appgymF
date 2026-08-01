/**
 * Aplicación Express con MySQL - CRUD de Usuarios
 * @description API REST para gestión de usuarios con base de datos MySQL
 * @author Tu Nombre
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Redireccionar consola a archivo de logs
const fsLog = require('fs');
const pathLog = require('path');
const logFile = pathLog.join(__dirname, 'backend_logs.txt');
fsLog.writeFileSync(logFile, '--- INICIO LOGS DE DIAGNÓSTICO --- \n', 'utf8');

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    originalLog.apply(console, args);
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    fsLog.appendFileSync(logFile, `[LOG] ${new Date().toISOString()} - ${msg}\n`, 'utf8');
};

console.error = function(...args) {
    originalError.apply(console, args);
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    fsLog.appendFileSync(logFile, `[ERROR] ${new Date().toISOString()} - ${msg}\n`, 'utf8');
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    fsLog.appendFileSync(logFile, `[WARN] ${new Date().toISOString()} - ${msg}\n`, 'utf8');
};

// Importar configuraciones y middlewares
const { testConnection } = require('./config/database');
const { validateJSON, sanitizeInput, validateContentType } = require('./middleware/validation');

// Importar rutas
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const checkinRoutes = require('./routes/checkinRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const routineRoutes = require('./routes/routineRoutes');

// Crear aplicación Express
const app = express();

// Configuración del puerto
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

/**
 * CONFIGURACIÓN DE MIDDLEWARES
 */

// Middleware para parsear JSON (debe ir antes de las rutas)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://tu-dominio.com'] // Cambiar por tu dominio en producción
        : true, // En desarrollo, permitir todos los orígenes
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middlewares personalizados
app.use(validateContentType);
app.use(sanitizeInput);
app.use(validateJSON);

// Middleware para logging de requests (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });
}

/**
 * CONFIGURACIÓN DE RUTAS
 */

// Ruta de health check
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API de Usuarios funcionando correctamente',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            users: `${API_PREFIX}/users`,
            auth: `${API_PREFIX}/auth`,
            health: '/',
            docs: '/docs'
        }
    });
});

// Ruta de health check para monitoreo
app.get('/health', async (req, res) => {
    try {
        // Verificar conexión a la base de datos
        const dbConnected = await testConnection();
        
        res.status(200).json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: dbConnected ? 'connected' : 'disconnected',
                server: 'running'
            }
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Rutas de la API
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/memberships`, membershipRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/sales`, saleRoutes);
app.use(`${API_PREFIX}/checkins`, checkinRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/routines`, routineRoutes);

// Ruta para documentación básica
app.get('/docs', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Documentación de la API',
        baseUrl: `${req.protocol}://${req.get('host')}${API_PREFIX}`,
        endpoints: {
            // Autenticación
            'POST /auth/register': 'Registrar nuevo usuario',
            'POST /auth/login': 'Iniciar sesión',
            'GET /auth/profile': 'Obtener perfil (requiere token)',
            'PUT /auth/profile': 'Actualizar perfil (requiere token)',
            'POST /auth/refresh': 'Renovar token',
            'POST /auth/logout': 'Cerrar sesión',
            // Usuarios
            'GET /users': 'Obtener todos los usuarios (con paginación)',
            'GET /users/search?q=nombre': 'Buscar usuarios por nombre',
            'GET /users/stats': 'Obtener estadísticas de usuarios',
            'GET /users/:id': 'Obtener usuario por ID',
            'POST /users': 'Crear nuevo usuario',
            'PUT /users/:id': 'Actualizar usuario',
            'DELETE /users/:id': 'Eliminar usuario'
        },
        examples: {
            register: {
                nombre: 'Juan Pérez',
                email: 'juan@ejemplo.com',
                telefono: '+1234567890',
                password: 'MiPassword123!'
            },
            login: {
                email: 'juan@ejemplo.com',
                password: 'MiPassword123!'
            }
        }
    });
});

/**
 * MANEJO DE ERRORES
 */

// Middleware para rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
        requestedUrl: req.originalUrl,
        availableEndpoints: {
            health: '/',
            docs: '/docs',
            auth: `${API_PREFIX}/auth`,
            users: `${API_PREFIX}/users`
        }
    });
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error global:', err);

    // Error de JSON malformado
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'JSON malformado',
            error: 'La estructura del JSON enviado no es válida'
        });
    }

    // Error de payload muy grande
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'Payload demasiado grande',
            error: 'El tamaño de los datos enviados excede el límite permitido'
        });
    }

    // Error genérico del servidor
    res.status(err.status || 500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'production' 
            ? 'Algo salió mal en el servidor' 
            : err.message,
        timestamp: new Date().toISOString()
    });
});

/**
 * INICIALIZACIÓN DEL SERVIDOR
 */

// Función para inicializar la aplicación
const initializeApp = async () => {
    try {
        // Probar conexión a la base de datos
        console.log('🔍 Verificando conexión a la base de datos...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ No se pudo conectar a la base de datos');
            console.log('💡 Asegúrate de que MySQL esté ejecutándose y las credenciales sean correctas');
            console.log('💡 Revisa el archivo .env para la configuración de la base de datos');
        }

        // Iniciar servidor
        const server = app.listen(PORT, () => {
            console.log('🚀 Servidor iniciado correctamente');
            console.log(`🌐 URL: http://localhost:${PORT}`);
            console.log(`📋 API Base: http://localhost:${PORT}${API_PREFIX}`);
            console.log(`📖 Documentación: http://localhost:${PORT}/docs`);
            console.log(`💚 Health Check: http://localhost:${PORT}/health`);
            console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
        });

        // Manejo graceful de cierre del servidor
        process.on('SIGTERM', () => {
            console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
            server.close(() => {
                console.log('✅ Servidor cerrado correctamente');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('🛑 Recibida señal SIGINT (Ctrl+C), cerrando servidor...');
            server.close(() => {
                console.log('✅ Servidor cerrado correctamente');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error.message);
        process.exit(1);
    }
};

// Inicializar aplicación solo si este archivo se ejecuta directamente
if (require.main === module) {
    initializeApp();
}

// Exportar app para pruebas
module.exports = app;