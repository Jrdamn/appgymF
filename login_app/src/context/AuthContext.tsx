import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import api, { setAuthToken } from '../services/api';

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
    login: (email: string, password: string) => Promise<void>;
    register: (nombre: string, email: string, telefono: string, password: string, rol?: number) => Promise<void>;
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

    // Load storage token on mount
    useEffect(() => {
        const loadStorageData = async () => {
            try {
                const storedToken = await getStorageItem('userToken');
                if (storedToken) {
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
    }, []);

    const clearSession = async () => {
        try {
            await deleteStorageItem('userToken');
        } catch (e) {
            console.warn('Error deleting stored token:', e);
        }
        setAuthToken(null);
        setUser(null);
        setToken(null);
    };

    const login = async (email: string, password: string) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            if (response.data && response.data.success) {
                const { token: userToken, user: userData } = response.data.data;
                await setStorageItem('userToken', userToken);
                setAuthToken(userToken);
                setToken(userToken);
                setUser(userData);
            } else {
                throw new Error(response.data?.message || 'Error al iniciar sesión');
            }
        } catch (error: any) {
            console.warn('Login error:', error);

            // Extract sub-validation errors if present from express-validator
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

    const register = async (nombre: string, email: string, telefono: string, password: string, rol?: number) => {
        try {
            const response = await api.post('/auth/register', { nombre, email, telefono, password, rol });
            if (response.data && response.data.success) {
                const { token: userToken, user: userData } = response.data.data;
                await setStorageItem('userToken', userToken);
                setAuthToken(userToken);
                setToken(userToken);
                setUser(userData);
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
