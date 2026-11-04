const serverless = require('serverless-http');
const app = require('../../app');
const { testConnection } = require('../../config/database');

const expressHandler = serverless(app);
const requiredEnvironmentVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
let databaseReady;

const ensureDatabaseReady = async () => {
    if (!databaseReady) {
        databaseReady = Promise.resolve().then(() => {
            const missingVariables = requiredEnvironmentVariables.filter((name) => !process.env[name]);
            if (missingVariables.length) {
                throw new Error(`Faltan variables requeridas de Netlify: ${missingVariables.join(', ')}`);
            }

            return testConnection();
        })
            .then((connected) => {
                if (!connected) {
                    throw new Error('No se pudo conectar a la base de datos configurada en Netlify');
                }
            })
            .catch((error) => {
                databaseReady = undefined;
                throw error;
            });
    }

    await databaseReady;
};

const getExpressPath = (event) => {
    const requestPath = event.rawUrl
        ? new URL(event.rawUrl, 'https://netlify.local').pathname
        : event.path || '/';

    if (requestPath.startsWith('/api/')) {
        return requestPath;
    }

    const functionPrefix = '/.netlify/functions/api';
    if (requestPath.startsWith(`${functionPrefix}/`)) {
        const path = requestPath.slice(functionPrefix.length);
        return path.startsWith('/api/') || path === '/health' ? path : `/api${path}`;
    }

    return requestPath;
};

exports.handler = async (event, context) => {
    await ensureDatabaseReady();

    return expressHandler({
        ...event,
        path: getExpressPath(event),
    }, context);
};
