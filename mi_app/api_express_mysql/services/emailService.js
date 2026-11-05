const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuración del transportador SMTP
const smtpPort = parseInt(process.env.SMTP_PORT, 10) || 2525;
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
});

/**
 * Envía un correo electrónico de forma asíncrona.
 * @param {string} to - Destinatario del correo
 * @param {string} subject - Asunto
 * @param {string} text - Contenido en texto plano
 * @param {Array} attachments - Archivos adjuntos (ej: [{ filename: 'recibo.pdf', content: buffer }])
 * @returns {Promise<boolean>} True si el correo se envió con éxito
 */
async function sendMail(to, subject, text, attachments = []) {
    try {
        // Validación de configuración
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('⚠️ SMTP_USER o SMTP_PASS no están configurados en el archivo .env. Saltando envío de correo.');
            return false;
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || '"Shark Gym" <receipts@sharkgym.com>',
            to,
            subject,
            text,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✉️ Correo enviado con éxito a: ${to} (ID: ${info.messageId})`);
        return true;
    } catch (error) {
        console.error(`❌ Error al enviar correo a ${to}:`, error.message);
        return false;
    }
}

module.exports = {
    sendMail
};
