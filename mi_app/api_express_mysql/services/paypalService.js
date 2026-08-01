require('dotenv').config();

const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

/**
 * Obtiene el Token de Acceso de PayPal OAuth2
 * @returns {Promise<string|null>} Token de acceso o null
 */
async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return null;
    }

    try {
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`PayPal OAuth error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('❌ Error al obtener token de PayPal:', error.message);
        return null;
    }
}

/**
 * Crea una orden de pago en PayPal
 * @param {number} total - Importe total a cobrar
 * @param {string} description - Concepto de la compra
 * @param {string} host - Host dinámico (IP y puerto de la API)
 * @returns {Promise<Object>} Datos de la orden (id y approve_url)
 */
async function createOrder(total, description = 'Compra Shark Gym', host = 'localhost:3000', redirectUrl = '') {
    const token = await getAccessToken();

    if (!token) {
        throw new Error('Las credenciales de PayPal no están configuradas en el archivo .env del backend.');
    }

    try {
        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'USD',
                        value: parseFloat(total).toFixed(2)
                    },
                    description: description
                }],
                application_context: {
                    brand_name: 'Shark Gym',
                    user_action: 'PAY_NOW',
                    return_url: 'http://localhost:3000/api/v1/payments/paypal/success',
                    cancel_url: 'http://localhost:3000/api/v1/payments/paypal/cancel'
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`PayPal Create Order error: ${errText}`);
        }

        const data = await response.json();
        const approveLink = data.links.find(link => link.rel === 'approve');

        return {
            success: true,
            isMock: false,
            id: data.id,
            approveUrl: approveLink ? approveLink.href : null
        };
    } catch (error) {
        console.error('❌ Error al crear orden de PayPal:', error.message);
        throw error;
    }
}

/**
 * Captura y confirma un pago aprobado de PayPal
 * @param {string} orderId - ID de la orden de PayPal
 * @returns {Promise<Object>} Datos del pago capturado
 */
async function captureOrder(orderId) {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('No se pudo autenticar con PayPal para capturar la orden.');
    }

    try {
        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`PayPal Capture Order error: ${errText}`);
        }

        const data = await response.json();
        return {
            success: data.status === 'COMPLETED',
            isMock: false,
            paypalOrderId: data.id,
            status: data.status,
            payer: data.payer
        };
    } catch (error) {
        console.error(`❌ Error al capturar la orden de PayPal ${orderId}:`, error.message);
        throw error;
    }
}

module.exports = {
    createOrder,
    captureOrder
};
