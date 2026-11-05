# API REST - Gestión de Usuarios con Express y MySQL

Una API REST completa para gestión de usuarios desarrollada con Node.js, Express y MySQL. Incluye operaciones CRUD completas, validaciones, paginación y documentación.

## Despliegue de Shark Gym en Netlify

La configuración `netlify.toml` en la raíz del repositorio publica la app web de `login_app` y sirve esta API mediante una Netlify Function. La base de datos MySQL debe estar alojada externamente y aceptar conexiones desde Netlify.

Al conectar el repositorio en Netlify, deja la carpeta base en la raíz del repositorio y usa la configuración de `netlify.toml`. Agrega estas variables en la configuración del sitio de Netlify; no las guardes en el repositorio. Usa como `FRONTEND_URL` la URL HTTPS asignada al sitio:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_SSL`: configúralo como `true` para bases administradas que requieren TLS, como TiDB Cloud Starter
- `JWT_SECRET`: clave aleatoria y privada, distinta de cualquier clave de desarrollo
- `FRONTEND_URL`: URL HTTPS del sitio publicado en Netlify
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: necesarios para los códigos de acceso por correo
- `SMTP_FROM`: opcional, remitente de los correos
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: habilitan el envío de notificaciones push a navegadores web
- `EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY`: la misma clave pública VAPID, disponible durante el build web
- `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`: si se habilitan pagos con PayPal
- `SCANNER_PIN`: opcional, PIN del lector de accesos

Para Web Push, genera un par de claves VAPID desde `mi_app/api_express_mysql` con `npx web-push generate-vapid-keys`. Configura la clave privada como secreto y no la publiques. `VAPID_SUBJECT` debe ser un contacto `mailto:` o URL válida. Configura la clave pública tanto como `VAPID_PUBLIC_KEY` en las funciones como `EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY` en el build web. Los usuarios activan las notificaciones desde el botón de prueba en su perfil; el navegador solicitará permiso.

La función verifica la conexión a MySQL en su primera solicitud y prepara las tablas mediante la rutina existente. Verifica el resultado en `/health`. Las funciones de Netlify tienen límites de ejecución y tamaño de solicitud; para archivos grandes o tráfico sostenido, conviene alojar la API en un servicio Node persistente y mantener la web en Netlify.

## 🚀 Características

- **Autenticación JWT**: Sistema completo de registro, login y autenticación
- **Seguridad**: Contraseñas hasheadas con bcrypt
- **CRUD Completo**: Crear, leer, actualizar y eliminar usuarios
- **Base de Datos MySQL**: Conexión robusta con pool de conexiones
- **Validaciones**: Validación completa de datos de entrada
- **Paginación**: Listado de usuarios con paginación
- **Búsqueda**: Búsqueda de usuarios por nombre
- **Manejo de Errores**: Manejo centralizado de errores
- **Documentación**: Documentación completa de la API
- **Health Check**: Endpoint para monitoreo del estado de la aplicación

## 🛠️ Tecnologías

- **Node.js** - Entorno de ejecución
- **Express.js** - Framework web
- **MySQL** - Base de datos
- **mysql2** - Cliente MySQL con soporte para promesas
- **bcryptjs** - Hash de contraseñas
- **jsonwebtoken** - Autenticación JWT
- **express-validator** - Validación de datos
- **cors** - Manejo de CORS
- **dotenv** - Variables de entorno

## 📋 Requisitos Previos

- Node.js (versión 14 o superior)
- MySQL (versión 5.7 o superior)
- npm o yarn

## ⚙️ Instalación

1. **Clonar el repositorio o descargar archivos**

   ```bash
   # Si usas git
   git clone <tu-repo>
   cd express-mysql-crud
   ```

2. **Instalar dependencias**

   ```bash
   npm install
   ```

3. **Configurar variables de entorno**

   Copia el archivo `.env` y configura tus variables:

   ```env
   # Configuración de la aplicación
   NODE_ENV=development
   PORT=3000

   # Configuración de la base de datos MySQL
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=tu_password
   DB_NAME=usuarios_db

   # Configuración del servidor
   API_PREFIX=/api/v1

   # Configuración SMTP (necesaria para enviar códigos de inicio de sesión 2FA)
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=tu_usuario_smtp
   SMTP_PASS=tu_password_smtp
   SMTP_FROM="Shark Gym <no-reply@example.com>"
   ```

   El inicio de sesión requiere contraseña y un código de seis dígitos enviado al correo registrado. El código vence en 10 minutos y se limita a cinco intentos. La tabla de verificación se crea automáticamente al iniciar la API; el correo debe estar configurado para que el login pueda completarse.

4. **Crear la base de datos**

   ```sql
   -- Conectarse a MySQL y crear la base de datos
   CREATE DATABASE usuarios_db;
   USE usuarios_db;

   -- Ejecutar el script SQL que está en docs/database.sql
   ```

5. **Ejecutar la aplicación**

   ```bash
   # Desarrollo (con nodemon)
   npm run dev

   # Producción
   npm start
   ```

## 🗄️ Estructura del Proyecto

```
express/
├── config/
│   └── database.js          # Configuración de conexión MySQL
├── controllers/
│   └── userController.js    # Controladores de usuarios
├── middleware/
│   └── validation.js        # Middleware de validaciones
├── models/
│   └── User.js             # Modelo de usuario
├── routes/
│   └── userRoutes.js       # Rutas de usuarios
├── docs/
│   └── database.sql        # Script de creación de BD
├── .env                    # Variables de entorno
├── app.js                  # Aplicación principal
├── package.json            # Dependencias y scripts
└── README.md              # Documentación
```

## 📖 Documentación de la API

### Base URL

```
http://localhost:3000/api/v1
```

### Endpoints Disponibles

#### 🏠 General

| Método | Endpoint  | Descripción                      |
| ------ | --------- | -------------------------------- |
| GET    | `/`       | Información general de la API    |
| GET    | `/health` | Estado de salud de la aplicación |
| GET    | `/docs`   | Documentación básica             |

#### � Autenticación

| Método | Endpoint         | Descripción                   | Auth |
| ------ | ---------------- | ----------------------------- | ---- |
| POST   | `/auth/register` | Registrar nuevo usuario       | No   |
| POST   | `/auth/login`    | Verificar contraseña y enviar código 2FA | No |
| POST   | `/auth/verify-login-code` | Verificar código 2FA e iniciar sesión | No |
| GET    | `/auth/profile`  | Obtener perfil del usuario    | Sí   |
| PUT    | `/auth/profile`  | Actualizar perfil del usuario | Sí   |
| POST   | `/auth/refresh`  | Renovar token JWT             | Sí   |
| POST   | `/auth/logout`   | Cerrar sesión                 | Sí   |

#### �👥 Usuarios

| Método | Endpoint        | Descripción                | Auth |
| ------ | --------------- | -------------------------- | ---- |
| GET    | `/users`        | Obtener todos los usuarios | No   |
| GET    | `/users/search` | Buscar usuarios por nombre | No   |
| GET    | `/users/stats`  | Estadísticas de usuarios   | No   |
| GET    | `/users/:id`    | Obtener usuario por ID     | No   |
| POST   | `/users`        | Crear nuevo usuario        | No   |
| PUT    | `/users/:id`    | Actualizar usuario         | No   |
| DELETE | `/users/:id`    | Eliminar usuario           | No   |

### 📝 Ejemplos de Uso

#### 🔐 Autenticación

#### 1. Registrar nuevo usuario

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "email": "juan@ejemplo.com",
  "telefono": "+1234567890",
  "password": "MiPassword123!",
  "termsAccepted": true
}
```

`termsAccepted` debe ser `true`; si no se acepta, el servidor rechaza la creación de la cuenta.

**Respuesta:**

```json
{
  "success": true,
  "message": "Usuario registrado correctamente",
  "data": {
    "user": {
      "id": 1,
      "nombre": "Juan Pérez",
      "email": "juan@ejemplo.com",
      "telefono": "+1234567890",
      "fecha_creacion": "2024-01-15T10:30:00.000Z",
      "fecha_actualizacion": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

#### 2. Iniciar sesión

El login requiere dos pasos: `/auth/login` valida la contraseña y envía un código de seis dígitos; luego `/auth/verify-login-code` valida el código y devuelve el token de sesión. El código vence en 10 minutos y permite hasta cinco intentos.

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "juan@ejemplo.com",
  "password": "MiPassword123!"
}
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": 1,
      "nombre": "Juan Pérez",
      "email": "juan@ejemplo.com",
      "telefono": "+1234567890",
      "fecha_creacion": "2024-01-15T10:30:00.000Z",
      "fecha_actualizacion": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

Después de recibir `challengeId` en la respuesta:

```http
POST /api/v1/auth/verify-login-code
Content-Type: application/json

{
  "challengeId": "identificador-temporal",
  "code": "123456"
}
```

#### 3. Obtener perfil (requiere autenticación)

```http
GET /api/v1/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 4. Actualizar perfil

```http
PUT /api/v1/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "nombre": "Juan Carlos Pérez",
  "telefono": "+1234567891",
  "currentPassword": "MiPassword123!",
  "newPassword": "NuevaPassword456!"
}
```

#### 👥 Gestión de Usuarios

#### 5. Obtener todos los usuarios

```http
GET /api/v1/users

# Con paginación
GET /api/v1/users?page=1&limit=10

# Con búsqueda
GET /api/v1/users?search=juan
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Usuarios obtenidos correctamente",
  "data": [
    {
      "id": 1,
      "nombre": "Juan Pérez",
      "email": "juan@ejemplo.com",
      "telefono": "+1234567890",
      "fecha_creacion": "2024-01-15T10:30:00.000Z",
      "fecha_actualizacion": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalUsers": 50,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### 2. Obtener usuario por ID

```http
GET /api/v1/users/1
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Usuario obtenido correctamente",
  "data": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@ejemplo.com",
    "telefono": "+1234567890",
    "fecha_creacion": "2024-01-15T10:30:00.000Z",
    "fecha_actualizacion": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 3. Crear nuevo usuario

```http
POST /api/v1/users
Content-Type: application/json

{
  "nombre": "María García",
  "email": "maria@ejemplo.com",
  "telefono": "+9876543210"
}
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Usuario creado correctamente",
  "data": {
    "id": 2,
    "nombre": "María García",
    "email": "maria@ejemplo.com",
    "telefono": "+9876543210",
    "fecha_creacion": "2024-01-15T11:00:00.000Z",
    "fecha_actualizacion": "2024-01-15T11:00:00.000Z"
  }
}
```

#### 4. Actualizar usuario

```http
PUT /api/v1/users/1
Content-Type: application/json

{
  "nombre": "Juan Carlos Pérez",
  "email": "juan.carlos@ejemplo.com",
  "telefono": "+1234567891"
}
```

#### 5. Buscar usuarios

```http
GET /api/v1/users/search?q=juan
```

#### 6. Eliminar usuario

```http
DELETE /api/v1/users/1
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Usuario eliminado correctamente"
}
```

### 🔍 Validaciones

#### Campos Requeridos

- **nombre**: 2-100 caracteres, solo letras y espacios
- **email**: Email válido, máximo 255 caracteres
- **telefono**: 7-20 caracteres, formato de teléfono válido

#### Ejemplos de Errores

```json
{
  "success": false,
  "message": "Errores de validación",
  "errors": [
    {
      "field": "email",
      "message": "Debe ser un email válido",
      "value": "email-invalido"
    }
  ]
}
```

## 🚨 Manejo de Errores

La API maneja varios tipos de errores:

### Códigos de Estado HTTP

| Código | Descripción                 |
| ------ | --------------------------- |
| 200    | Éxito                       |
| 201    | Creado                      |
| 400    | Solicitud incorrecta        |
| 404    | No encontrado               |
| 409    | Conflicto (email duplicado) |
| 500    | Error interno del servidor  |

### Formato de Respuesta de Error

```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalle específico del error"
}
```

## 🔧 Configuración Avanzada

### Variables de Entorno

```env
# Servidor
NODE_ENV=production          # development | production
PORT=3000                   # Puerto del servidor
API_PREFIX=/api/v1          # Prefijo de la API

# Base de Datos
DB_HOST=localhost           # Host de MySQL
DB_PORT=3306               # Puerto de MySQL
DB_USER=usuario            # Usuario de MySQL
DB_PASSWORD=contraseña     # Contraseña de MySQL
DB_NAME=usuarios_db        # Nombre de la base de datos
```

### Pool de Conexiones MySQL

La aplicación usa un pool de conexiones para optimizar el rendimiento:

- **connectionLimit**: 10 conexiones máximas
- **acquireTimeout**: 60 segundos
- **timeout**: 60 segundos
- **reconnect**: Habilitado

## 🧪 Pruebas

### Usando curl

```bash
# Crear usuario
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test Usuario",
    "email": "test@ejemplo.com",
    "telefono": "+1234567890"
  }'

# Obtener usuarios
curl http://localhost:3000/api/v1/users

# Obtener usuario específico
curl http://localhost:3000/api/v1/users/1
```

### Usando Postman

1. Importar la colección de endpoints
2. Configurar el environment con la base URL
3. Ejecutar las pruebas CRUD

## 📊 Monitoring

### Health Check

```http
GET /health
```

Respuesta cuando todo está bien:

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "services": {
    "database": "connected",
    "server": "running"
  }
}
```

## 🚀 Despliegue

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
# Instalar dependencias de producción
npm install --production

# Iniciar aplicación
npm start
```

### Con PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start app.js --name "users-api"

# Monitorear
pm2 status
pm2 logs users-api
```

## 🔒 Seguridad

### Medidas Implementadas

- Validación estricta de entrada
- Sanitización de datos
- Protección CORS configurada
- Manejo seguro de errores
- Límites de payload

### Recomendaciones Adicionales

- Usar HTTPS en producción
- Implementar autenticación JWT
- Rate limiting
- Logging de seguridad

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Error de conexión a MySQL**

   - Verificar que MySQL esté ejecutándose
   - Comprobar credenciales en `.env`
   - Verificar que la base de datos exista

2. **Puerto en uso**

   - Cambiar el puerto en `.env`
   - Matar el proceso que usa el puerto

3. **Errores de validación**
   - Verificar formato de datos enviados
   - Revisar la documentación de campos requeridos

## 📈 Mejoras Futuras

- [ ] Autenticación y autorización
- [ ] Rate limiting
- [ ] Caching con Redis
- [ ] Logs estructurados
- [ ] Pruebas unitarias
- [ ] Documentación con Swagger
- [ ] Dockerización
- [ ] CI/CD

## 📄 Licencia

ISC License

## 🤝 Contribución

1. Fork el proyecto
2. Crear branch para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

---

## 📞 Soporte

Si tienes preguntas o necesitas ayuda:

- Crear un issue en el repositorio
- Revisar la documentación en `/docs`
- Verificar el health check en `/health`
