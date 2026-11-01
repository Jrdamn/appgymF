import { create } from 'axios';
import { Platform } from 'react-native';

const apiBaseUrl =
  Platform.OS === 'web'
    ? 'http://localhost:3000/api/v1'
    : 'http://10.0.2.2:3000/api/v1';

const api = create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para imprimir en la consola de tu PC la URL real que está llamando el celular
api.interceptors.request.use((config) => {
  console.log(`🚀 [Axios Request] ${config.method?.toUpperCase()} al URL: ${config.baseURL}${config.url}`);
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * Sets or removes the Authorization Bearer token for all requests.
 * @param token JWT token or null to remove it
 */
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export default api;
