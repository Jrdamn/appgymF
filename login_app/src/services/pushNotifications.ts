import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import api from './api';

const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerPushNotifications(): Promise<void> {
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

export async function unregisterPushNotifications(): Promise<void> {
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
