/**
 * Configuración de conexión a la base de datos MySQL
 * @description Este módulo maneja la conexión a MySQL usando mysql2 con promesas
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Configuración de la conexión a la base de datos
 * @type {Object}
 */
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'usuarios_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

/**
 * Pool de conexiones a la base de datos
 * @type {mysql.Pool}
 */
const pool = mysql.createPool(dbConfig);

/**
 * Configura la base de datos agregando campos faltantes si es necesario
 */
const setupDatabase = async () => {
    try {
        // 1. Crear tabla usuarios si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                telefono VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                rol INT DEFAULT 1 COMMENT '1 = usuario normal, 2 = admin',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_nombre (nombre)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS login_verification_codes (
                id CHAR(64) PRIMARY KEY,
                usuario_id INT NOT NULL,
                code_hash VARCHAR(255) NOT NULL,
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                used_at DATETIME NULL,
                INDEX idx_login_verification_user_created (usuario_id, created_at),
                CONSTRAINT fk_login_verification_user
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Agregar columnas dinámicamente a 'usuarios' si no existen
        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN rol INT DEFAULT 1 COMMENT '1 = usuario normal, 2 = admin'"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN membresia_id INT NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN fecha_vencimiento DATE NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN reset_code VARCHAR(6) NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN reset_code_expires TIMESTAMP NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN foto_perfil VARCHAR(255) NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios MODIFY COLUMN foto_perfil LONGTEXT NULL"
            );
        } catch (err) {
            console.error('Error altering column to LONGTEXT:', err);
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN peso DECIMAL(5,2) NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE usuarios ADD COLUMN estatura INT NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
        }

        try {
            await pool.execute(
                "ALTER TABLE checkins ADD COLUMN fecha_salida TIMESTAMP NULL DEFAULT NULL"
            );
        } catch (err) {
            if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1146) throw err;
        }

        // 3. Crear tabla membresias si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS membresias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                precio DECIMAL(10,2) NOT NULL,
                duracion_dias INT NOT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. Crear tabla productos si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS productos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                precio DECIMAL(10,2) NOT NULL,
                stock INT NOT NULL DEFAULT 0,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Insertar productos iniciales para demo si la tabla de productos está vacía
        const [existingProds] = await pool.execute('SELECT COUNT(*) as count FROM productos');
        if (existingProds[0].count === 0) {
            await pool.execute(`
                INSERT INTO productos (nombre, precio, stock) VALUES
                ('Agua Mineral 500ml', 1000.00, 50),
                ('Bebida Energética Shark 250ml', 1500.00, 30),
                ('Bebida Energética Shark 600ml', 2000.00, 28),
                ('Barra de Proteína (Chocolate)', 2500.00, 22),
                ('Barra de Proteína (Fresa)', 2500.00, 25),
                ('Proteína en Polvo 1kg', 28000.00, 10),
                ('Proteína en Polvo 2kg', 48000.00, 10),
                ('Shaker de Acero 500ml', 8000.00, 15),
                ('Shaker de Acero 700ml', 10000.00, 15)
            `);
            console.log('✅ Productos demo insertados correctamente');
        } else {
            // Actualizar a colones los productos existentes que se hayan quedado en USD
            await pool.execute("UPDATE productos SET precio = 1000.00 WHERE nombre = 'Agua Mineral 500ml' AND precio < 500");
            await pool.execute("UPDATE productos SET precio = 1500.00 WHERE nombre = 'Bebida Energética Shark 250ml' AND precio < 500");
            await pool.execute("UPDATE productos SET precio = 2000.00 WHERE nombre = 'Bebida Energética Shark 600ml' AND precio < 500");
            await pool.execute("UPDATE productos SET precio = 2500.00 WHERE nombre = 'Barra de Proteína (Chocolate)' AND precio < 500");
            await pool.execute("UPDATE productos SET precio = 2500.00 WHERE nombre = 'Barra de Proteína (Fresa)' AND precio < 500");
            await pool.execute("UPDATE productos SET precio = 28000.00 WHERE nombre = 'Proteína en Polvo 1kg' AND precio < 5000");
            await pool.execute("UPDATE productos SET precio = 48000.00 WHERE nombre = 'Proteína en Polvo 2kg' AND precio < 5000");
            await pool.execute("UPDATE productos SET precio = 8000.00 WHERE nombre = 'Shaker de Acero 500ml' AND precio < 5000");
            await pool.execute("UPDATE productos SET precio = 10000.00 WHERE nombre = 'Shaker de Acero 700ml' AND precio < 5000");
        }

        // Insertar membresias iniciales para demo si está vacía
        const [existingMemb] = await pool.execute('SELECT COUNT(*) as count FROM membresias');
        if (existingMemb[0].count === 0) {
            await pool.execute(`
                INSERT INTO membresias (nombre, precio, duracion_dias) VALUES
                ('Pase Diario', 4500.00, 1),
                ('Mensualidad Normal', 26000.00, 30),
                ('Trimestre Fit', 68000.00, 90),
                ('Anualidad Premium', 240000.00, 365)
            `);
            console.log('✅ Membresías demo insertadas correctamente');
        } else {
            // Actualizar a colones las membresias existentes que se hayan quedado en USD
            await pool.execute("UPDATE membresias SET precio = 4500.00 WHERE nombre = 'Pase Diario' AND precio < 500");
            await pool.execute("UPDATE membresias SET precio = 26000.00 WHERE nombre = 'Mensualidad Normal' AND precio < 500");
            await pool.execute("UPDATE membresias SET precio = 68000.00 WHERE nombre = 'Trimestre Fit' AND precio < 5000");
            await pool.execute("UPDATE membresias SET precio = 240000.00 WHERE nombre = 'Anualidad Premium' AND precio < 10000");
        }

        // 5. Crear tabla ventas si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS ventas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NULL,
                producto_id INT NULL,
                membresia_id INT NULL,
                cantidad INT NOT NULL DEFAULT 1,
                total DECIMAL(10,2) NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 6. Crear tabla checkins si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS checkins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_salida TIMESTAMP NULL DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 7. Crear tabla rutinas si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS rutinas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT NOT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 8. Crear tabla metodos_pago si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS metodos_pago (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                tipo VARCHAR(20) NOT NULL COMMENT 'tarjeta, paypal',
                nombre_titular VARCHAR(100) NULL,
                numero_enmascarado VARCHAR(30) NULL,
                fecha_expiracion VARCHAR(7) NULL,
                marca VARCHAR(20) NULL,
                email_paypal VARCHAR(255) NULL,
                es_predeterminado TINYINT DEFAULT 0,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 9. Crear tabla notificaciones si no existe
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS notificaciones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                mensaje VARCHAR(255) NOT NULL,
                leido TINYINT DEFAULT 0,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS push_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                expo_push_token VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_push_tokens_usuario (usuario_id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('✅ Base de datos configurada y tablas inicializadas correctamente');
    } catch (err) {
        console.warn('⚠️ Error al configurar la base de datos:', err.message);
    }
};

/**
 * Función para probar la conexión a la base de datos
 * @returns {Promise<boolean>} True si la conexión es exitosa
 */
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión a MySQL establecida correctamente');
        connection.release();
        
        // Configurar base de datos
        await setupDatabase();
        
        return true;
    } catch (error) {
        console.error('❌ Error al conectar con MySQL:', error.message);
        return false;
    }
};

/**
 * Función para cerrar todas las conexiones del pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
    try {
        await pool.end();
        console.log('🔌 Pool de conexiones cerrado');
    } catch (error) {
        console.error('❌ Error al cerrar el pool:', error.message);
    }
};

/**
 * Función para obtener una conexión del pool
 * @returns {Promise<mysql.Connection>} Conexión a la base de datos
 */
const getConnection = async () => {
    try {
        return await pool.getConnection();
    } catch (error) {
        console.error('❌ Error al obtener conexión del pool:', error.message);
        throw error;
    }
};

module.exports = {
    pool,
    testConnection,
    closePool,
    getConnection
};