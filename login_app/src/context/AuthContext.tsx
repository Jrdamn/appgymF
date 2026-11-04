import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import api, { setAuthToken } from '../services/api';
import { registerPushNotifications, unregisterPushNotifications } from '../services/pushNotifications';

// Helper functions to handle web vs mobile storage
const getStorageItem = async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage.getItem(key);
            }
        } catch (e) {
            console.error('Error reading from localStorage', e);
        }
        return null;
    }
    return await SecureStore.getItemAsync(key);
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, value);
            }
        } catch (e) {
            console.error('Error writing to localStorage', e);
        }
        return;
    }
    await SecureStore.setItemAsync(key, value);
};

const deleteStorageItem = async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } catch (e) {
            console.error('Error deleting from localStorage', e);
        }
        return;
    }
    await SecureStore.deleteItemAsync(key);
};

export interface User {
    id: number;
    nombre: string;
    email: string;
    telefono: string;
    role?: 'admin' | 'user' | 'coach';
    foto_perfil?: string | null;
    peso?: number | null;
    estatura?: number | null;
    fecha_creacion?: string;
    fecha_actualizacion?: string;
    membresia_id?: number | null;
    fecha_vencimiento?: string | null;
    membresia_nombre?: string | null;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ requiresTwoFactor: true; challengeId: string; maskedEmail: string }>;
    verifyLoginCode: (challengeId: string, code: string) => Promise<void>;
    register: (
        nombre: string,
        email: string,
        telefono: string,
        password: string,
        termsAccepted: boolean,
        rol?: number
    ) => Promise<void>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    updateProfile: (
        nombre: string,
        email: string,
        telefono: string,
        currentPassword?: string,
        newPassword?: string,
        foto_perfil?: string | null,
        peso?: number | null,
        estatura?: number | null
    ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const pushRegistrationRef = React.useRef<Promise<void> | null>(null);
    const tokenRef = useRef<string | null>(null);
    const sessionInvalidatedRef = useRef(false);
    const userId = user?.id;

    const clearSession = useCallback(async () => {
        try {
            await deleteStorageItem('userToken');
        } catch (e) {
            console.warn('Error deleting stored token:', e);
        }
        tokenRef.current = null;
        setAuthToken(null);
        setUser(null);
        setToken(null);
    }, []);

    useEffect(() => {
        const interceptorId = api.interceptors.response.use(
            (response) => response,
            (error) => {
                const requestUrl = error.config?.url;
                const isPublicAuthRequest =
                    requestUrl === '/auth/login' ||
                    requestUrl === '/auth/verify-login-code' ||
                    requestUrl === '/auth/register';

                if (
                    error.response?.status === 401 &&
                    tokenRef.current &&
                    !isPublicAuthRequest &&
                    !sessionInvalidatedRef.current
                ) {
                    sessionInvalidatedRef.current = true;
                    void clearSession();
                }

                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(interceptorId);
        };
    }, [clearSession]);

    useEffect(() => {
        if (userId === undefined || !token) {
            return;
        }

        const registration = registerPushNotifications()
            .then(() => undefined)
            .catch((error) => {
                console.error('No se pudo registrar el token de notificaciones:', error);
            })
            .finally(() => {
                if (pushRegistrationRef.current === registration) {
                    pushRegistrationRef.current = null;
                }
            });

        pushRegistrationRef.current = registration;
    }, [userId, token]);

    // Load storage token on mount
    useEffect(() => {
        const loadStorageData = async () => {
            try {
                const storedToken = await getStorageItem('userToken');
                if (storedToken) {
                    tokenRef.current = storedToken;
                    setToken(storedToken);
                    setAuthToken(storedToken);

                    // Verify token by fetching user profile
                    const response = await api.get('/auth/profile');
                    if (response.data && response.data.success) {
                        setUser(response.data.data);
                    } else {
                        // Token is invalid/expired
                        await clearSession();
                    }
                }
            } catch (error) {
                console.warn('Error loading stored auth token:', error);
                await clearSession();
            } finally {
                setIsLoading(false);
            }
        };

        loadStorageData();
    }, [clearSession]);

    const login = async (email: string, password: string) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            if (response.data && response.data.success) {
                const loginData = response.data.data;
                if (
                    loginData?.requiresTwoFactor === true &&
                    typeof loginData.challengeId === 'string' &&
                    typeof loginData.maskedEmail === 'string'
                ) {
                    return {
                        requiresTwoFactor: true as const,
                        challengeId: loginData.challengeId,
                        maskedEmail: loginData.maskedEmail,
                    };
                }

                throw new Error('El servidor no inició el proceso de verificación de dos pasos.');
            } else {
                throw new Error(response.data?.message || 'Error al iniciar sesión');
            }
        } catch (error: any) {
            console.warn('Login error:', error);

            let errorMsg = 'Error al iniciar sesión';
            if (error.response?.data) {
                const data = error.response.data;
                if (data.message) {
                    errorMsg = data.message;
                }
                if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                    errorMsg += `: ${data.errors.map((e: any) => e.msg).join(', ')}`;
                }
            } else {
                errorMsg = error.message || 'Error de conexión';
            }
            throw new Error(errorMsg);
        }
    };

    const verifyLoginCode = async (challengeId: string, code: string) => {
        try {
            const response = await api.post('/auth/verify-login-code', { challengeId, code });
            if (response.data && response.data.success) {
                const { token: userToken, user: userData } = response.data.data;
                if (typeof userToken !== 'string' || !userData) {
                    throw new Error('El servidor devolvió una respuesta de autenticación inválida.');
                }
                await setStorageItem('userToken', userToken);
                tokenRef.current = userToken;
                sessionInvalidatedRef.current = false;
                setAuthToken(userToken);
                setToken(userToken);
                setUser(userData);
            } else {
                throw new Error(response.data?.message || 'No se pudo verificar el código.');
            }
        } catch (error: any) {
            console.warn('Login verification error:', error);

            let errorMsg = 'No se pudo verificar el código.';
            if (error.response?.data) {
                const data = error.response.data;
                if (data.message) {
                    errorMsg = data.message;
                }
                if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                    errorMsg += `: ${data.errors.map((e: any) => e.msg).join(', ')}`;
                }
            } else {
                errorMsg = error.message || 'Error de conexión';
            }
            throw new Error(errorMsg);
        }
    };

    const register = async (
        nombre: string,
        email: string,
        telefono: string,
        password: string,
        termsAccepted: boolean,
        rol?: number
    ) => {
        try {
            const response = await api.post('/auth/register', {
                nombre,
                email,
                telefono,
                password,
                termsAccepted,
                rol,
            });
            if (response.data && response.data.success) {
                return;
            } else {
                throw new Error(response.data?.message || 'Error al registrarse');
            }
        } catch (error: any) {
            console.warn('Registration error:', error);

            // Extract sub-validation errors if present from express-validator
            let errorMsg = 'Error al registrarse';
            if (error.response?.data) {
                const data = error.response.data;
                if (data.message) {
                    errorMsg = data.message;
                }
                if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                    errorMsg += `: ${data.errors.map((e: any) => e.msg).join(', ')}`;
                }
            } else {
                errorMsg = error.message || 'Error de conexión';
            }
            throw new Error(errorMsg);
        }
    };

    const logout = async () => {
        try {
            if (token) {
                if (pushRegistrationRef.current) {
                    await pushRegistrationRef.current;
                }
                try {
                    await unregisterPushNotifications();
                } catch (error) {
                    console.error('No se pudo desvincular el token de notificaciones:', error);
                }

                // Send a request to backend to logout (best-effort)
                await api.post('/auth/logout').catch((e) => {
                    console.log('Backend logout warning:', e.message);
                });
            }
        } finally {
            await clearSession();
        }
    };

    const refreshProfile = async () => {
        try {
            const response = await api.get('/auth/profile');
            if (response.data && response.data.success) {
                setUser(response.data.data);
            }
        } catch (error) {
            console.warn('Error refreshing profile:', error);
        }
    };

    const updateProfile = async (
        nombre: string,
        email: string,
        telefono: string,
        currentPassword?: string,
        newPassword?: string,
        foto_perfil?: string | null,
        peso?: number | null,
        estatura?: number | null
    ) => {
        try {
            const payload: any = { nombre, email, telefono, foto_perfil, peso, estatura };
            if (newPassword) {
                payload.currentPassword = currentPassword;
                payload.newPassword = newPassword;
            }
            const response = await api.put('/auth/profile', payload);
            if (response.data && response.data.success) {
                setUser(response.data.data);
            } else {
                throw new Error(response.data?.message || 'Error al actualizar el perfil');
            }
        } catch (error: any) {
            console.warn('Update profile error:', error);

            // Extract validation errors if present from express-validator
            let errorMsg = 'Error al actualizar el perfil';
            if (error.response?.data) {
                const data = error.response.data;
                if (data.message) {
                    errorMsg = data.message;
                }
                if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                    const subErrors = data.errors.map((e: any) => e.message || e.msg).join(', ');
                    errorMsg += `: ${subErrors}`;
                }
            } else {
                errorMsg = error.message || 'Error de conexión';
            }
            throw new Error(errorMsg);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!user,
                isLoading,
                login,
                verifyLoginCode,
                register,
                logout,
                refreshProfile,
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
