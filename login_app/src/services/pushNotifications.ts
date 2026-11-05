import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import api from './api';

const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

const getWebPushSubscription = async (requestPermission: boolean): Promise<PushSubscription | null> => {
    if (
        Platform.OS !== 'web' ||
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window) ||
        !window.isSecureContext
    ) {
        return null;
    }

    const publicKey = process.env.EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY;
    if (!publicKey) {
        if (requestPermission) {
            throw new Error('Las notificaciones web aún no están configuradas en el sitio.');
        }
        return null;
    }

    let permission = Notification.permission;
    if (permission !== 'granted' && requestPermission) {
        permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    await api.post('/notifications/web-subscription', {
        subscription: subscription.toJSON(),
    });
    return subscription;
};

const urlBase64ToUint8Array = (value: string): Uint8Array => {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
};

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerPushNotifications(): Promise<void> {
    if (Platform.OS === 'web') {
        await getWebPushSubscription(false);
        return;
    }

    if (Platform.OS !== 'android') {
        return;
    }

    await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones de Shark Gym',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
    });

    const permission = await Notifications.getPermissionsAsync();
    let status = permission.status;
    if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') {
        console.warn('El usuario no concedió permiso para recibir notificaciones.');
        return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
        throw new Error('No se encontró el projectId de EAS para obtener el token push.');
    }

    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.post('/notifications/push-token', { expoPushToken });
    await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, expoPushToken);
}

export async function activateWebPushNotifications(): Promise<boolean> {
    const subscription = await getWebPushSubscription(true);
    return subscription !== null;
}

export async function unregisterPushNotifications(): Promise<void> {
    if (Platform.OS === 'web') {
        if (!('serviceWorker' in navigator)) return;
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
            await api.delete('/notifications/web-subscription', {
                data: { endpoint: subscription.endpoint },
            });
        }
        return;
    }

    if (Platform.OS !== 'android') {
        return;
    }

    const expoPushToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
    if (!expoPushToken) {
        return;
    }

    await api.delete('/notifications/push-token', { data: { expoPushToken } });
    await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
}
