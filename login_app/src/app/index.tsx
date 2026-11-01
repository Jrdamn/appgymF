import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import api from '@/services/api';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507398941214-572c25f4b1dc?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
];

interface ExpiringUser {
  id: number;
  nombre: string;
  email: string;
  fecha_vencimiento: string;
}

interface LowStockProduct {
  id: number;
  nombre: string;
  stock: number;
  precio: number;
}

interface StatsData {
  totalHoy: number;
  totalGeneral: number;
  checkinsHoy: number;
  porVencer: ExpiringUser[];
  stockBajo: LowStockProduct[];
}

export default function HomeScreen() {
  const { user, logout, updateProfile, refreshProfile, token } = useAuth();
  const theme = useTheme();
  const isAdmin = user?.role === 'admin';
  const isCoach = user?.role === 'coach';

  // Navigation state
  const [activeView, setActiveView] = useState<'home' | 'profile' | 'payments'>('home');
  const { view } = useLocalSearchParams<{ view?: string }>();

  useEffect(() => {
    if (view === 'profile') {
      setActiveView('profile');
    } else if (view === 'home') {
      setActiveView('home');
    } else if (view === 'payments') {
      setActiveView('payments');
    }
  }, [view]);

  // Stats data
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sales modal states
  const [salesModalVisible, setSalesModalVisible] = useState(false);
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [todaySalesLoading, setTodaySalesLoading] = useState(false);

  const fetchTodaySalesDetails = async () => {
    setTodaySalesLoading(true);
    try {
      const response = await api.get('/sales/today');
      if (response.data && response.data.success) {
        setTodaySales(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching today sales details:', err);
    } finally {
      setTodaySalesLoading(false);
    }
  };

  // Profile Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');

  const [pesoFocused, setPesoFocused] = useState(false);
  const [estaturaFocused, setEstaturaFocused] = useState(false);
  const [fotoPerfilFocused, setFotoPerfilFocused] = useState(false);

  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Payment method states
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [addMethodType, setAddMethodType] = useState<'card' | 'paypal'>('card');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardBrand, setCardBrand] = useState('Visa');
  const [paypalEmail, setPaypalEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [testingPushNotification, setTestingPushNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // In-app notifications states
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    if (isAdmin || isCoach) return;
    try {
      const response = await api.get('/users/notifications/unread');
      if (response.data && response.data.success) {
        setUnreadNotifications(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching unread notifications:', err);
    }
  };

  const handleMarkNotificationsAsRead = async () => {
    try {
      await api.post('/users/notifications/mark-read');
      setUnreadNotifications([]);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const fetchPaymentMethods = async () => {
    if (isAdmin) return [];
    setMethodsLoading(true);
    try {
      const response = await api.get('/payments/methods');
      if (response.data && response.data.success) {
        setPaymentMethods(response.data.data);
        return response.data.data;
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    } finally {
      setMethodsLoading(false);
    }
    return [];
  };

  const handleAddPaymentMethod = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      let body: any = { tipo: addMethodType === 'card' ? 'tarjeta' : 'paypal' };
      if (addMethodType === 'card') {
        if (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
          setErrorMessage('Por favor, completa todos los campos de la tarjeta.');
          setLoading(false);
          return;
        }

        // Validaciones locales de tarjeta
        const cleanNumber = cardNumber.replace(/\D/g, '');
        if (cleanNumber.length < 13 || cleanNumber.length > 19) {
          setErrorMessage('La tarjeta debe tener entre 13 y 19 dígitos.');
          setLoading(false);
          return;
        }

        // Verificar algoritmo de Luhn (suma de verificación estándar de bancos)
        let sum = 0;
        let shouldDouble = false;
        for (let i = cleanNumber.length - 1; i >= 0; i--) {
          let digit = parseInt(cleanNumber.charAt(i));
          if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
          }
          sum += digit;
          shouldDouble = !shouldDouble;
        }
        if (sum % 10 !== 0) {
          setErrorMessage('El número de tarjeta no es válido (Fallo de verificación matemática).');
          setLoading(false);
          return;
        }

        // Verificar fecha de expiración
        const expiryMatch = cardExpiry.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/);
        if (!expiryMatch) {
          setErrorMessage('La fecha de expiración debe tener el formato MM/YY.');
          setLoading(false);
          return;
        }
        const expMonth = parseInt(expiryMatch[1]);
        const expYear = parseInt('20' + expiryMatch[2]);
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
          setErrorMessage('La tarjeta ingresada ya está vencida.');
          setLoading(false);
          return;
        }

        // Verificar CVV
        const cleanCvv = cardCvv.replace(/\D/g, '');
        if (cleanCvv.length < 3 || cleanCvv.length > 4) {
          setErrorMessage('El CVV debe tener 3 o 4 dígitos.');
          setLoading(false);
          return;
        }

        body = {
          ...body,
          nombre_titular: cardHolder.trim(),
          numero_tarjeta: cardNumber.replace(/\s+/g, ''),
          fecha_expiracion: cardExpiry.trim(),
          marca: cardBrand
        };

        const response = await api.post('/payments/methods', body);
        if (response.data && response.data.success) {
          setSuccessMessage('Método de pago agregado correctamente.');
          setCardHolder('');
          setCardNumber('');
          setCardExpiry('');
          setCardCvv('');
          fetchPaymentMethods();
        }
      } else {
        const countBefore = paymentMethods.length;
        try {
          await WebBrowser.openBrowserAsync(`http://192.168.100.2:3000/api/v1/payments/link-paypal-web?userId=${user?.id || 0}`);
        } catch (browserErr) {
          console.warn('WebBrowser open failed:', browserErr);
        }
        const updatedList = await fetchPaymentMethods();
        if (updatedList && updatedList.length > countBefore) {
          setSuccessMessage('Cuenta de PayPal vinculada correctamente.');
        } else {
          setSuccessMessage(null);
        }
      }
    } catch (err: any) {
      console.error('Error adding payment method:', err);
      setErrorMessage(err.response?.data?.message || 'Error al agregar el método de pago.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaymentMethod = async (id: number) => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await api.delete(`/payments/methods/${id}`);
      if (response.data && response.data.success) {
        setSuccessMessage('Método de pago eliminado correctamente.');
        fetchPaymentMethods();
      }
    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      setErrorMessage(err.response?.data?.message || 'Error al eliminar el método de pago.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (id: number) => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await api.put(`/payments/methods/${id}/default`);
      if (response.data && response.data.success) {
        setSuccessMessage('Método de pago predeterminado actualizado.');
        fetchPaymentMethods();
      }
    } catch (err: any) {
      console.error('Error setting default payment method:', err);
      setErrorMessage(err.response?.data?.message || 'Error al establecer el método predeterminado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'payments') {
      fetchPaymentMethods();
    }
  }, [activeView]);

  // Focus states for styling
  const [nombreFocused, setNombreFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [telefonoFocused, setTelefonoFocused] = useState(false);
  const [currentPasswordFocused, setCurrentPasswordFocused] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  // Payment form focus states
  const [cardHolderFocused, setCardHolderFocused] = useState(false);
  const [cardNumberFocused, setCardNumberFocused] = useState(false);
  const [cardExpiryFocused, setCardExpiryFocused] = useState(false);
  const [cardCvvFocused, setCardCvvFocused] = useState(false);
  const [paypalEmailFocused, setPaypalEmailFocused] = useState(false);

  const [coachCheckinCount, setCoachCheckinCount] = useState(0);

  const fetchStats = async () => {
    if (isAdmin) {
      setStatsLoading(true);
      try {
        const response = await api.get('/sales/stats');
        if (response.data && response.data.success) {
          setStats(response.data.data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setStatsLoading(false);
        setRefreshing(false);
      }
    } else if (isCoach) {
      setStatsLoading(true);
      try {
        const response = await api.get('/checkins/today');
        if (response.data && response.data.success) {
          setCoachCheckinCount(response.data.data.length);
        }
      } catch (err) {
        console.error('Error fetching coach checkins:', err);
      } finally {
        setStatsLoading(false);
        setRefreshing(false);
      }
    } else {
      setRefreshing(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!token) return;
    try {
      const reportUrl = `${api.defaults.baseURL}/sales/report/pdf?token=${token}`;
      await WebBrowser.openBrowserAsync(reportUrl);
    } catch (err) {
      console.error('Error downloading report:', err);
      setErrorMessage('No se pudo descargar el reporte PDF.');
    }
  };

  const handleTestPushNotification = async () => {
    setTestingPushNotification(true);
    try {
      const response = await api.post('/notifications/test');
      Alert.alert('Solicitud enviada', response.data?.message || 'Revisa las notificaciones de Android.');
    } catch (error: any) {
      const message = error.response?.data?.message || 'No se pudo enviar la notificación de prueba.';
      Alert.alert('No se pudo probar', message);
    } finally {
      setTestingPushNotification(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      fetchNotifications();
    }, [user, isAdmin, isCoach])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isAdmin) {
      await fetchStats();
    } else {
      await refreshProfile();
      await fetchNotifications();
      setRefreshing(false);
    }
  };

  const startEditing = () => {
    setNombre(user?.nombre || '');
    setEmail(user?.email || '');
    setTelefono(user?.telefono || '');
    setPeso(user?.peso ? String(user.peso) : '');
    setEstatura(user?.estatura ? String(user.estatura) : '');
    setFotoPerfil(user?.foto_perfil || '');
    setChangePassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditing(true);
  };

  const handleSaveChanges = async () => {
    if (!nombre.trim() || !email.trim() || !telefono.trim()) {
      setErrorMessage('Por favor, completa los campos de nombre, email y teléfono.');
      return;
    }

    if (changePassword) {
      if (!currentPassword) {
        setErrorMessage('Debes ingresar tu contraseña actual para cambiarla.');
        return;
      }
      if (!newPassword) {
        setErrorMessage('Debes ingresar la nueva contraseña.');
        return;
      }
      if (newPassword.length < 8) {
        setErrorMessage('La nueva contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('La nueva contraseña y su confirmación no coinciden.');
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateProfile(
        nombre.trim(),
        email.trim(),
        telefono.trim(),
        changePassword ? currentPassword : undefined,
        changePassword ? newPassword : undefined,
        fotoPerfil.trim() || null,
        peso ? parseFloat(peso) : null,
        estatura ? parseInt(estatura, 10) : null
      );

      setSuccessMessage('¡Perfil actualizado con éxito!');
      setIsEditing(false);

      // Auto clear success message after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Ocurrió un error al actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrorMessage('Se requiere permiso para acceder a la galería.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4, // Reduce slightly to minimize base64 payload size
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedAsset = result.assets[0];
        const base64Uri = `data:image/jpeg;base64,${pickedAsset.base64}`;
        setFotoPerfil(base64Uri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setErrorMessage('Error al seleccionar la imagen de la galería.');
    }
  };

  const formatRegisterDate = (dateString?: string | null) => {
    if (!dateString) return 'No disponible';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const isMembershipActive = () => {
    if (!user?.fecha_vencimiento) return false;
    const expiry = new Date(user.fecha_vencimiento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today;
  };

  const getDaysRemaining = () => {
    if (!user?.fecha_vencimiento) return 0;
    const expiry = new Date(user.fecha_vencimiento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    if (diffTime <= 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/images/background-shark.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoiding}
        >
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                activeView === 'home' ? (
                  <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3c87f7" />
                ) : undefined
              }
            >
              <View style={styles.heroSection}>
                <AnimatedIcon />
                <ThemedText type="subtitle" style={styles.title}>
                  ¡Hola, {user?.nombre || 'Usuario'}!
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {isAdmin ? 'Panel de Control Shark Gym' : 'Miembro Oficial Shark Gym'}
                </ThemedText>
              </View>

              {/* TABS TOGGLE */}
              <View style={styles.tabToggleContainer}>
                <Pressable
                  style={[styles.tabToggleButton, activeView === 'home' && styles.tabToggleButtonActive]}
                  onPress={() => {
                    setActiveView('home');
                    setIsEditing(false);
                  }}
                >
                  <ThemedText style={[styles.tabToggleText, activeView === 'home' && styles.tabToggleTextActive]}>
                    Inicio
                  </ThemedText>
                </Pressable>
                {!isAdmin && (
                  <Pressable
                    style={[styles.tabToggleButton, activeView === 'payments' && styles.tabToggleButtonActive]}
                    onPress={() => {
                      setActiveView('payments');
                      setIsEditing(false);
                    }}
                  >
                    <ThemedText style={[styles.tabToggleText, activeView === 'payments' && styles.tabToggleTextActive]}>
                      Pagos
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.tabToggleButton, activeView === 'profile' && styles.tabToggleButtonActive]}
                  onPress={() => {
                    setActiveView('profile');
                    setIsEditing(false);
                  }}
                >
                  <ThemedText style={[styles.tabToggleText, activeView === 'profile' && styles.tabToggleTextActive]}>
                    Mi Perfil
                  </ThemedText>
                </Pressable>
              </View>

              {successMessage && (
                <View style={[styles.successBanner, { backgroundColor: '#E6F4EA', borderColor: '#B3E1C1' }]}>
                  <ThemedText style={styles.successText}>{successMessage}</ThemedText>
                </View>
              )}

              {errorMessage && (
                <View style={[styles.errorBanner, { backgroundColor: '#FDF2F2', borderColor: '#F8B4B4' }]}>
                  <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
                </View>
              )}

              {/* HOME VIEW */}
              {activeView === 'home' && (
                <View style={styles.viewSection}>
                  {isAdmin ? (
                    /* ADMIN DASHBOARD VIEW */
                    <View style={styles.adminContainer}>
                      {statsLoading && !stats ? (
                        <ActivityIndicator size="large" color="#3c87f7" style={{ marginTop: Spacing.four }} />
                      ) : (
                        <View style={styles.dashboardGrid}>
                          {/* Botón de Generar Reporte PDF */}
                          <Pressable
                            style={({ pressed }) => [
                              {
                                opacity: pressed || loading ? 0.8 : 1,
                                backgroundColor: '#208AEF',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                paddingVertical: 14,
                                borderRadius: Spacing.two,
                                marginBottom: Spacing.three,
                                gap: Spacing.two,
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                shadowColor: '#208AEF',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                elevation: 4
                              }
                            ]}
                            onPress={handleDownloadReport}
                            disabled={loading}
                          >
                            <ThemedText style={{ fontSize: 16 }}>📄</ThemedText>
                            <ThemedText style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
                              Descargar Reporte Ejecutivo PDF
                            </ThemedText>
                          </Pressable>

                          {/* Metrics Rows */}
                          <View style={styles.metricsContainer}>
                            {/* Ventas Totales (Histórico) */}
                            <Pressable
                              style={({ pressed }) => [
                                styles.metricCardGreen,
                                {
                                  opacity: pressed ? 0.8 : 1,
                                }
                              ]}
                              onPress={() => {
                                setSalesModalVisible(true);
                                fetchTodaySalesDetails();
                              }}
                            >
                              <ThemedText style={styles.metricIcon}>📊</ThemedText>
                              <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                                Ventas Totales
                              </ThemedText>
                              <ThemedText style={styles.metricValue}>
                                ₡{Math.round(stats?.totalGeneral || 0).toLocaleString('es-CR')}
                              </ThemedText>
                              <ThemedText type="small" style={{ fontSize: 11, color: '#4caf50', marginTop: Spacing.one }}>
                                🔍 Ver detalle
                              </ThemedText>
                            </Pressable>

                            {/* Check-ins de hoy */}
                            <View style={styles.metricCard}>
                              <ThemedText style={styles.metricIcon}>🏋️</ThemedText>
                              <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                                Entradas Hoy
                              </ThemedText>
                              <ThemedText style={styles.metricValue}>
                                {stats?.checkinsHoy || 0}
                              </ThemedText>
                            </View>
                          </View>

                          {/* Alertas de Stock Bajo */}
                          <View style={styles.alertPanel}>
                            <ThemedText type="smallBold" style={styles.panelTitle}>
                              ⚠️ Alertas de Stock Bajo
                            </ThemedText>
                            {(!stats?.stockBajo || stats.stockBajo.length === 0) ? (
                              <ThemedText style={styles.emptyAlertText}>
                                Todo el inventario está abastecido.
                              </ThemedText>
                            ) : (
                              stats.stockBajo.map((prod) => (
                                <View key={prod.id} style={styles.alertItemRow}>
                                  <ThemedText style={styles.alertItemName}>{prod.nombre}</ThemedText>
                                  <ThemedText style={styles.alertItemDetails}>
                                    Stock: <ThemedText style={{ color: '#ff9800', fontWeight: '700' }}>{prod.stock}</ThemedText> uds.
                                  </ThemedText>
                                </View>
                              ))
                            )}
                          </View>

                          {/* Alertas de Membresías por Vencer */}
                          <View style={styles.alertPanel}>
                            <ThemedText type="smallBold" style={styles.panelTitle}>
                              ⏳ Membresías por Vencer (Próximos 3 días)
                            </ThemedText>
                            {(!stats?.porVencer || stats.porVencer.length === 0) ? (
                              <ThemedText style={styles.emptyAlertText}>
                                Sin membresías por vencer próximamente.
                              </ThemedText>
                            ) : (
                              stats.porVencer.map((u) => (
                                <View key={u.id} style={styles.alertItemRow}>
                                  <ThemedText style={styles.alertItemName}>{u.nombre}</ThemedText>
                                  <ThemedText style={styles.alertItemDetails}>
                                    Vence el {u.fecha_vencimiento.split('T')[0]}
                                  </ThemedText>
                                </View>
                              ))
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  ) : (
                    /* CLIENT VIEW */
                    <View style={styles.clientContainer}>
                      {/* NOTIFICACIÓN DE RUTINA NUEVA */}
                      {unreadNotifications.length > 0 && (
                        <View style={{
                          backgroundColor: 'rgba(10, 10, 12, 0.88)',
                          borderColor: 'rgba(32, 138, 239, 0.5)',
                          borderWidth: 1.5,
                          borderRadius: 16,
                          padding: 16,
                          width: '100%',
                          marginBottom: Spacing.three,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          shadowColor: '#208AEF',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                          elevation: 4
                        }}>
                          <ThemedText style={{ fontSize: 24 }}>🔔</ThemedText>
                          <View style={{ flex: 1, gap: 4 }}>
                            <ThemedText style={{ color: '#208AEF', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              ¡Nueva Rutina Asignada!
                            </ThemedText>
                            <ThemedText style={{ color: '#d0d0d5', fontSize: 13, lineHeight: 18 }}>
                              {unreadNotifications[0].mensaje}
                            </ThemedText>
                          </View>
                          <Pressable
                            onPress={handleMarkNotificationsAsRead}
                            style={({ pressed }) => [
                              {
                                backgroundColor: 'rgba(32, 138, 239, 0.2)',
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 12,
                                opacity: pressed ? 0.7 : 1
                              }
                            ]}
                          >
                            <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>
                              Entendido
                            </ThemedText>
                          </Pressable>
                        </View>
                      )}
                      {/* Recuadro de Entradas para el Coach */}
                      {isCoach && (
                        <View style={[styles.metricCard, { width: '100%', marginBottom: Spacing.three, paddingVertical: Spacing.four }]}>
                          <ThemedText style={{ fontSize: 28 }}>🏋️</ThemedText>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 14 }}>
                            Entradas de Hoy (Control de Acceso)
                          </ThemedText>
                          <ThemedText style={{ fontSize: 32, fontWeight: '800', color: '#fff', marginVertical: 4 }}>
                            {coachCheckinCount}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                            Miembros entrenando o registrados hoy
                          </ThemedText>
                        </View>
                      )}

                      {/* Tarjeta de Membresía */}
                      <View style={styles.membershipCard}>
                        <View style={styles.membershipHeader}>
                          <ThemedText type="subtitle" style={styles.membershipTitle}>
                            Mi Suscripción
                          </ThemedText>
                          <View style={[
                            styles.badge,
                            { backgroundColor: isMembershipActive() ? 'rgba(46, 125, 50, 0.2)' : 'rgba(198, 40, 40, 0.2)' }
                          ]}>
                            <ThemedText style={[
                              styles.badgeText,
                              { color: isMembershipActive() ? '#2E7D32' : '#C62828' }
                            ]}>
                              {isMembershipActive() ? 'ACTIVA' : 'INACTIVA'}
                            </ThemedText>
                          </View>
                        </View>

                        {user?.membresia_id ? (
                          <View style={styles.membershipDetails}>
                            <ThemedText type="smallBold" style={styles.membershipName}>
                              Plan: {user.membresia_nombre || 'Membresía Especial'}
                            </ThemedText>
                            <ThemedText style={styles.membershipExpiry}>
                              Vence el: {formatRegisterDate(user.fecha_vencimiento)}
                            </ThemedText>
                            {isMembershipActive() && (() => {
                              const daysLeft = getDaysRemaining();
                              let totalDays = 30;
                              if (user.membresia_nombre?.toLowerCase().includes('anual')) {
                                totalDays = 365;
                              } else if (user.membresia_nombre?.toLowerCase().includes('trimestre')) {
                                totalDays = 90;
                              } else if (user.membresia_nombre?.toLowerCase().includes('diario') || user.membresia_nombre?.toLowerCase().includes('pase')) {
                                totalDays = 1;
                              }
                              const percent = totalDays > 0 ? Math.min(100, Math.max(0, (daysLeft / totalDays) * 100)) : 0;
                              return (
                                <View style={{ width: '100%', marginTop: Spacing.two }}>
                                  <ThemedText style={styles.daysLeft}>
                                    Te quedan <ThemedText style={{ color: '#208AEF', fontWeight: 'bold' }}>{daysLeft}</ThemedText> de {totalDays} días.
                                  </ThemedText>
                                  <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: daysLeft > 5 ? '#2E7D32' : '#C62828' }]} />
                                  </View>
                                </View>
                              );
                            })()}
                          </View>
                        ) : (
                          <View style={styles.noMembership}>
                            <ThemedText style={styles.noMembershipText}>
                              No tienes ninguna membresía activa registrada actualmente.
                            </ThemedText>
                            <ThemedText style={styles.noMembershipSubtitle}>
                              Acércate a la recepción del gimnasio para adquirir tu plan.
                            </ThemedText>
                          </View>
                        )}
                      </View>

                      {/* Tarjeta Digital QR */}
                      <View style={styles.qrCard}>
                        <ThemedText type="smallBold" style={styles.qrTitle}>
                          Pase Digital de Acceso
                        </ThemedText>
                        <ThemedText style={styles.qrSubtitle}>
                          Muestra este código en el lector del gimnasio para entrenar hoy
                        </ThemedText>

                        {/* Real scannable QR code block */}
                        <View style={{
                          alignSelf: 'center',
                          backgroundColor: '#ffffff',
                          padding: 12,
                          borderRadius: 16,
                          marginVertical: 18,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 5,
                          elevation: 6
                        }}>
                          <Image
                            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`http://192.168.100.2:3000/api/v1/checkins/web-scan?id=${user?.id || 0}`)}` }}
                            style={{ width: 160, height: 160 }}
                          />
                        </View>

                        <ThemedText style={styles.qrCodeLabel}>
                          CÓDIGO: SHARK-MEMBER-{user?.id || 0}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* PAYMENTS VIEW */}
              {activeView === 'payments' && (
                <View style={styles.viewSection}>
                  <ThemedView type="backgroundElement" style={styles.profileCard}>
                    <View style={styles.cardHeader}>
                      <ThemedText type="smallBold" style={styles.cardTitle}>
                        Mis Métodos de Pago
                      </ThemedText>
                    </View>

                    {methodsLoading ? (
                      <ActivityIndicator size="large" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
                    ) : paymentMethods.length === 0 ? (
                      <View style={{ padding: Spacing.three, alignItems: 'center' }}>
                        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 14 }}>
                          No tienes ningún método de pago registrado. Agrega uno abajo.
                        </ThemedText>
                      </View>
                    ) : (
                      <View style={{ gap: Spacing.three, padding: Spacing.two }}>
                        {paymentMethods.map((method) => {
                          const isCard = method.tipo === 'tarjeta';
                          return (
                            <View
                              key={method.id}
                              style={[
                                styles.paymentCardItem,
                                {
                                  backgroundColor: isCard
                                    ? (method.marca === 'Visa' ? '#1a1f3c' : (method.marca === 'Mastercard' ? '#3c2415' : '#1d352d'))
                                    : '#0f2447',
                                  borderColor: method.es_predeterminado ? '#3c87f7' : 'rgba(255,255,255,0.06)'
                                }
                              ]}
                            >
                              {/* Top row: Brand & Type */}
                              <View style={styles.paymentCardHeader}>
                                <ThemedText style={styles.paymentCardBrand}>
                                  {isCard ? `💳 ${method.marca}` : '💙 PayPal'}
                                </ThemedText>
                                {method.es_predeterminado === 1 && (
                                  <View style={styles.defaultBadge}>
                                    <ThemedText style={styles.defaultBadgeText}>★ Principal</ThemedText>
                                  </View>
                                )}
                              </View>

                              {/* Middle: Number or Email */}
                              <View style={{ marginVertical: Spacing.two }}>
                                <ThemedText style={styles.paymentCardNumber}>
                                  {isCard ? method.numero_enmascarado : method.email_paypal}
                                </ThemedText>
                              </View>

                              {/* Bottom row: Holder & Expiry */}
                              <View style={styles.paymentCardFooter}>
                                <View style={{ flex: 1, marginRight: Spacing.two }}>
                                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>TITULAR</ThemedText>
                                  <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
                                    {isCard ? method.nombre_titular : 'Cuenta PayPal'}
                                  </ThemedText>
                                </View>
                                {isCard && (
                                  <View style={{ alignItems: 'flex-end' }}>
                                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>VENCE</ThemedText>
                                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }}>{method.fecha_expiracion}</ThemedText>
                                  </View>
                                )}
                              </View>

                              {/* Actions */}
                              <View style={styles.paymentCardActions}>
                                {method.es_predeterminado === 0 && (
                                  <Pressable
                                    style={styles.cardActionButton}
                                    onPress={() => handleSetDefaultPaymentMethod(method.id)}
                                  >
                                    <ThemedText style={styles.cardActionText}>Predeterminar</ThemedText>
                                  </Pressable>
                                )}
                                <Pressable
                                  style={[styles.cardActionButton, styles.deleteCardButton]}
                                  onPress={() => handleDeletePaymentMethod(method.id)}
                                >
                                  <ThemedText style={[styles.cardActionText, { color: '#ff4d4f' }]}>Eliminar</ThemedText>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </ThemedView>

                  {/* FORM TO ADD PAYMENT METHOD */}
                  <ThemedView type="backgroundElement" style={styles.profileCard}>
                    <View style={styles.cardHeader}>
                      <ThemedText type="smallBold" style={styles.cardTitle}>
                        Agregar Método de Pago
                      </ThemedText>
                    </View>

                    {/* Selector */}
                    <View style={styles.addTypeSelector}>
                      <Pressable
                        style={[styles.addTypeButton, addMethodType === 'card' && styles.addTypeButtonActive]}
                        onPress={() => setAddMethodType('card')}
                      >
                        <ThemedText style={[styles.addTypeText, addMethodType === 'card' && styles.addTypeTextActive]}>
                          💳 Tarjeta
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.addTypeButton, addMethodType === 'paypal' && styles.addTypeButtonActive]}
                        onPress={() => setAddMethodType('paypal')}
                      >
                        <ThemedText style={[styles.addTypeText, addMethodType === 'paypal' && styles.addTypeTextActive]}>
                          💙 PayPal
                        </ThemedText>
                      </Pressable>
                    </View>

                    {addMethodType === 'card' ? (
                      /* CARD FORM */
                      <View style={{ padding: Spacing.two, gap: Spacing.two }}>
                        {/* Holder Name */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Nombre del Titular
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: cardHolderFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={cardHolder}
                            onChangeText={setCardHolder}
                            placeholder="Nombre como aparece en la tarjeta"
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setCardHolderFocused(true)}
                            onBlur={() => setCardHolderFocused(false)}
                          />
                        </View>

                        {/* Card Number */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Número de Tarjeta
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: cardNumberFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={cardNumber}
                            onChangeText={(text) => {
                              const clean = text.replace(/\D/g, '').slice(0, 16);
                              const match = clean.match(/\d{1,4}/g);
                              setCardNumber(match ? match.join(' ') : clean);
                            }}
                            keyboardType="numeric"
                            placeholder="1234 5678 1234 5678"
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setCardNumberFocused(true)}
                            onBlur={() => setCardNumberFocused(false)}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                          {/* Expiration */}
                          <View style={[styles.inputContainer, { flex: 1 }]}>
                            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                              Expiración
                            </ThemedText>
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  color: theme.text,
                                  backgroundColor: theme.background,
                                  borderColor: cardExpiryFocused ? '#3c87f7' : theme.backgroundSelected,
                                },
                              ]}
                              value={cardExpiry}
                              onChangeText={(text) => {
                                const clean = text.replace(/\D/g, '').slice(0, 4);
                                if (clean.length >= 2) {
                                  setCardExpiry(`${clean.slice(0, 2)}/${clean.slice(2)}`);
                                } else {
                                  setCardExpiry(clean);
                                }
                              }}
                              keyboardType="numeric"
                              placeholder="MM/YY"
                              placeholderTextColor={theme.textSecondary}
                              onFocus={() => setCardExpiryFocused(true)}
                              onBlur={() => setCardExpiryFocused(false)}
                            />
                          </View>

                          {/* CVV */}
                          <View style={[styles.inputContainer, { flex: 1 }]}>
                            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                              CVV / CVC
                            </ThemedText>
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  color: theme.text,
                                  backgroundColor: theme.background,
                                  borderColor: cardCvvFocused ? '#3c87f7' : theme.backgroundSelected,
                                },
                              ]}
                              value={cardCvv}
                              onChangeText={(text) => setCardCvv(text.replace(/\D/g, '').slice(0, 4))}
                              keyboardType="numeric"
                              secureTextEntry
                              placeholder="123"
                              placeholderTextColor={theme.textSecondary}
                              onFocus={() => setCardCvvFocused(true)}
                              onBlur={() => setCardCvvFocused(false)}
                            />
                          </View>
                        </View>

                        {/* Brand selection */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Marca de la Tarjeta
                          </ThemedText>
                          <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: 4 }}>
                            {['Visa', 'Mastercard', 'Amex'].map((b) => (
                              <Pressable
                                key={b}
                                style={[
                                  styles.brandSelectBtn,
                                  cardBrand === b && styles.brandSelectBtnActive,
                                  { backgroundColor: theme.background }
                                ]}
                                onPress={() => setCardBrand(b)}
                              >
                                <ThemedText style={{ color: cardBrand === b ? '#3c87f7' : theme.textSecondary, fontWeight: '700', fontSize: 12 }}>
                                  {b}
                                </ThemedText>
                              </Pressable>
                            ))}
                          </View>
                        </View>

                        <Pressable
                          style={({ pressed }) => [
                            styles.saveCardButtonFull,
                            { opacity: pressed || loading ? 0.7 : 1 }
                          ]}
                          onPress={handleAddPaymentMethod}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                              Guardar Tarjeta
                            </ThemedText>
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      /* PAYPAL FORM */
                      <View style={{ padding: Spacing.two, gap: Spacing.three, alignItems: 'center' }}>
                        <ThemedText style={{ textAlign: 'center', color: theme.textSecondary, fontSize: 13, marginVertical: Spacing.two, lineHeight: 18 }}>
                          Presiona el botón de abajo para abrir el navegador oficial de PayPal, iniciar sesión de forma segura y autorizar la vinculación con tu cuenta de Shark Gym.
                        </ThemedText>

                        <Pressable
                          style={({ pressed }) => [
                            styles.saveCardButtonFull,
                            { opacity: pressed || loading ? 0.7 : 1, backgroundColor: '#FFC439' }
                          ]}
                          onPress={handleAddPaymentMethod}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator size="small" color="#000" />
                          ) : (
                            <ThemedText style={{ color: '#003087', fontWeight: 'bold', fontSize: 14 }}>
                              Vincular cuenta PayPal
                            </ThemedText>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </ThemedView>
                </View>
              )}

              {/* PROFILE VIEW (Original code encapsulated) */}
              {activeView === 'profile' && (
                <View style={styles.viewSection}>
                  <ThemedView type="backgroundElement" style={styles.profileCard}>
                    <View style={styles.cardHeader}>
                      <ThemedText type="smallBold" style={styles.cardTitle}>
                        {isEditing ? 'Editar Perfil' : 'Datos del Perfil'}
                      </ThemedText>
                      {!isEditing && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.editButtonToggle,
                            { opacity: pressed ? 0.7 : 1 }
                          ]}
                          onPress={startEditing}
                        >
                          <ThemedText type="smallBold" style={styles.editButtonToggleText}>
                            Editar
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>

                    {!isEditing ? (
                      /* Profile View Mode */
                      <View style={styles.viewContainer}>
                        {/* Avatar Display */}
                        <View style={{ alignItems: 'center', marginVertical: Spacing.three, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)', paddingBottom: Spacing.three }}>
                          {user?.foto_perfil ? (
                            <Image source={{ uri: user.foto_perfil }} style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#3c87f7' }} />
                          ) : (
                            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#208AEF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' }}>
                              <ThemedText style={{ fontSize: 36, color: '#fff', fontWeight: 'bold' }}>
                                {user?.nombre ? user.nombre[0].toUpperCase() : 'U'}
                              </ThemedText>
                            </View>
                          )}
                          <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 10 }}>
                            {user?.nombre}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                            {user?.role === 'admin' ? '🔒 Administrador' : (user?.role === 'coach' ? '⭐ Entrenador / Coach' : '⚡ Miembro Oficial')}
                          </ThemedText>
                        </View>

                        <View style={styles.infoRow}>
                          <ThemedText type="small" themeColor="textSecondary">Nombre: </ThemedText>
                          <ThemedText type="small" style={styles.infoValue} numberOfLines={1}>{user?.nombre}</ThemedText>
                        </View>

                        <View style={styles.infoRow}>
                          <ThemedText type="small" themeColor="textSecondary">Email: </ThemedText>
                          <ThemedText type="small" style={styles.infoValue} numberOfLines={1}>{user?.email}</ThemedText>
                        </View>

                        <View style={styles.infoRow}>
                          <ThemedText type="small" themeColor="textSecondary">Teléfono: </ThemedText>
                          <ThemedText type="small" style={styles.infoValue} numberOfLines={1}>{user?.telefono}</ThemedText>
                        </View>

                        <View style={styles.infoRow}>
                          <ThemedText type="small" themeColor="textSecondary">Peso: </ThemedText>
                          <ThemedText type="small" style={styles.infoValue} numberOfLines={1}>
                            {user?.peso ? `${user.peso} kg` : 'No especificado'}
                          </ThemedText>
                        </View>

                        <View style={styles.infoRow}>
                          <ThemedText type="small" themeColor="textSecondary">Estatura: </ThemedText>
                          <ThemedText type="small" style={styles.infoValue} numberOfLines={1}>
                            {user?.estatura ? `${user.estatura} cm` : 'No especificado'}
                          </ThemedText>
                        </View>

                        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                          <ThemedText type="small" themeColor="textSecondary">Miembro desde: </ThemedText>
                          <ThemedText type="small" style={styles.infoValue} numberOfLines={1}>
                            {formatRegisterDate(user?.fecha_creacion)}
                          </ThemedText>
                        </View>
                      </View>
                    ) : (
                      /* Profile Edit Mode */
                      <View style={styles.editForm}>
                        {/* Nombre Input */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Nombre completo
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: nombreFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={nombre}
                            onChangeText={setNombre}
                            placeholder="Tu nombre"
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setNombreFocused(true)}
                            onBlur={() => setNombreFocused(false)}
                          />
                        </View>

                        {/* Email Input */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Correo electrónico
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: emailFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholder="ejemplo@correo.com"
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setEmailFocused(true)}
                            onBlur={() => setEmailFocused(false)}
                          />
                        </View>

                        {/* Telefono Input */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Teléfono
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: telefonoFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={telefono}
                            onChangeText={setTelefono}
                            keyboardType="phone-pad"
                            placeholder="+52 123 456 7890"
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setTelefonoFocused(true)}
                            onBlur={() => setTelefonoFocused(false)}
                          />
                        </View>

                        {/* Foto de Perfil */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Foto de Perfil (Elige un preset o pega una URL)
                          </ThemedText>
                          <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8, flexWrap: 'wrap' }}>
                            {AVATAR_PRESETS.map((url, i) => (
                              <Pressable
                                key={i}
                                style={{
                                  borderWidth: fotoPerfil === url ? 3 : 1,
                                  borderColor: fotoPerfil === url ? '#3c87f7' : 'rgba(255,255,255,0.15)',
                                  borderRadius: 22,
                                  overflow: 'hidden'
                                }}
                                onPress={() => setFotoPerfil(url)}
                              >
                                <Image source={{ uri: url }} style={{ width: 40, height: 40 }} />
                              </Pressable>
                            ))}
                            <Pressable
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.2)',
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                              onPress={() => setFotoPerfil('')}
                            >
                              <ThemedText style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>✕</ThemedText>
                            </Pressable>

                            {/* Option to pick from media library */}
                            <Pressable
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                borderWidth: 1.5,
                                borderColor: '#3c87f7',
                                backgroundColor: 'rgba(60, 135, 247, 0.12)',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                              onPress={handlePickImage}
                            >
                              <ThemedText style={{ fontSize: 15 }}>📷</ThemedText>
                            </Pressable>

                            {/* Preview custom selected base64/custom photo */}
                            {fotoPerfil ? (!AVATAR_PRESETS.includes(fotoPerfil) && (
                              <View style={{ position: 'relative' }}>
                                <Image source={{ uri: fotoPerfil }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#3c87f7' }} />
                                <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#3c87f7', borderRadius: 6, width: 12, height: 12, justifyContent: 'center', alignItems: 'center' }}>
                                  <ThemedText style={{ fontSize: 8, color: '#fff', fontWeight: 'bold' }}>✓</ThemedText>
                                </View>
                              </View>
                            )) : null}
                          </View>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: fotoPerfilFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={fotoPerfil}
                            onChangeText={setFotoPerfil}
                            placeholder="Pega la URL de tu imagen de perfil..."
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setFotoPerfilFocused(true)}
                            onBlur={() => setFotoPerfilFocused(false)}
                          />
                        </View>

                        {/* Peso Input */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Peso (kg)
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: pesoFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={peso}
                            onChangeText={setPeso}
                            keyboardType="numeric"
                            placeholder="Ej. 78.5"
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setPesoFocused(true)}
                            onBlur={() => setPesoFocused(false)}
                          />
                        </View>

                        {/* Estatura Input */}
                        <View style={styles.inputContainer}>
                          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                            Estatura (cm)
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: estaturaFocused ? '#3c87f7' : theme.backgroundSelected,
                              },
                            ]}
                            value={estatura}
                            onChangeText={setEstatura}
                            keyboardType="numeric"
                            placeholder="Ej. 175"
                            placeholderTextColor={theme.textSecondary}
                            onFocus={() => setEstaturaFocused(true)}
                            onBlur={() => setEstaturaFocused(false)}
                          />
                        </View>

                        {/* Toggle Change Password */}
                        <View style={styles.switchRow}>
                          <ThemedText type="smallBold" themeColor="textSecondary">
                            ¿Cambiar contraseña?
                          </ThemedText>
                          <Switch
                            value={changePassword}
                            onValueChange={setChangePassword}
                            trackColor={{ false: theme.backgroundSelected, true: '#3c87f7' }}
                            thumbColor={Platform.OS === 'ios' ? undefined : '#ffffff'}
                          />
                        </View>

                        {changePassword && (
                          <View style={styles.passwordSection}>
                            {/* Current Password */}
                            <View style={styles.inputContainer}>
                              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                                Contraseña actual
                              </ThemedText>
                              <TextInput
                                style={[
                                  styles.input,
                                  {
                                    color: theme.text,
                                    backgroundColor: theme.background,
                                    borderColor: currentPasswordFocused ? '#3c87f7' : theme.backgroundSelected,
                                  },
                                ]}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry
                                placeholder="Ingresa tu contraseña actual"
                                placeholderTextColor={theme.textSecondary}
                                onFocus={() => setCurrentPasswordFocused(true)}
                                onBlur={() => setCurrentPasswordFocused(false)}
                              />
                            </View>

                            {/* New Password */}
                            <View style={styles.inputContainer}>
                              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                                Nueva contraseña
                              </ThemedText>
                              <TextInput
                                style={[
                                  styles.input,
                                  {
                                    color: theme.text,
                                    backgroundColor: theme.background,
                                    borderColor: newPasswordFocused ? '#3c87f7' : theme.backgroundSelected,
                                  },
                                ]}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry
                                placeholder="Mínimo 8 caracteres, 1 Mayús, 1 Núm, 1 Espec."
                                placeholderTextColor={theme.textSecondary}
                                onFocus={() => setNewPasswordFocused(true)}
                                onBlur={() => setNewPasswordFocused(false)}
                              />
                            </View>

                            {/* Confirm Password */}
                            <View style={styles.inputContainer}>
                              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                                Confirmar nueva contraseña
                              </ThemedText>
                              <TextInput
                                style={[
                                  styles.input,
                                  {
                                    color: theme.text,
                                    backgroundColor: theme.background,
                                    borderColor: confirmPasswordFocused ? '#3c87f7' : theme.backgroundSelected,
                                  },
                                ]}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                placeholder="Confirma tu nueva contraseña"
                                placeholderTextColor={theme.textSecondary}
                                onFocus={() => setConfirmPasswordFocused(true)}
                                onBlur={() => setConfirmPasswordFocused(false)}
                              />
                            </View>
                          </View>
                        )}

                        {/* Edit Form Actions */}
                        <View style={styles.editActions}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.actionButton,
                              styles.cancelButton,
                              { opacity: pressed || loading ? 0.7 : 1 }
                            ]}
                            onPress={() => setIsEditing(false)}
                            disabled={loading}
                          >
                            <ThemedText type="smallBold" style={styles.cancelButtonText}>
                              Cancelar
                            </ThemedText>
                          </Pressable>

                          <Pressable
                            style={({ pressed }) => [
                              styles.actionButton,
                              styles.saveButton,
                              { opacity: pressed || loading ? 0.7 : 1 }
                            ]}
                            onPress={handleSaveChanges}
                            disabled={loading}
                          >
                            {loading ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <ThemedText type="smallBold" style={styles.saveButtonText}>
                                Guardar
                              </ThemedText>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </ThemedView>

                  {!isEditing && Platform.OS === 'android' && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.pushTestButton,
                        { opacity: pressed || testingPushNotification ? 0.7 : 1 }
                      ]}
                      onPress={handleTestPushNotification}
                      disabled={testingPushNotification}
                    >
                      {testingPushNotification ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <ThemedText type="smallBold" style={styles.pushTestButtonText}>
                          Enviar notificación de prueba
                        </ThemedText>
                      )}
                    </Pressable>
                  )}

                  {!isEditing && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.logoutButton,
                        { opacity: pressed ? 0.8 : 1 }
                      ]}
                      onPress={logout}
                    >
                      <ThemedText type="smallBold" style={styles.logoutButtonText}>
                        Cerrar Sesión
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}

              {Platform.OS === 'web' && <WebBadge />}
              <View style={styles.footerSpacing} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ImageBackground>

      {/* MODAL DETALLE DE VENTAS DE HOY */}
      <Modal
        visible={salesModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSalesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold" style={styles.modalTitle}>
                📈 Ventas del Día
              </ThemedText>
              <Pressable
                onPress={() => setSalesModalVisible(false)}
                style={({ pressed }) => [styles.modalCloseButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</ThemedText>
              </Pressable>
            </View>

            {/* Total Resumen (Hoy vs Histórico) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
              <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' }}>
                <ThemedText style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', fontWeight: '600' }}>Ventas Hoy</ThemedText>
                <ThemedText style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 4 }}>
                  ₡{Math.round(stats?.totalHoy || 0).toLocaleString('es-CR')}
                </ThemedText>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <ThemedText style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', fontWeight: '600' }}>Ventas Totales</ThemedText>
                <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#4CAF50', marginTop: 4 }}>
                  ₡{Math.round(stats?.totalGeneral || 0).toLocaleString('es-CR')}
                </ThemedText>
              </View>
            </View>

            {/* List/Loading */}
            {todaySalesLoading ? (
              <ActivityIndicator size="large" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
            ) : todaySales.length === 0 ? (
              <View style={styles.modalEmptyContainer}>
                <ThemedText style={styles.modalEmptyText} themeColor="textSecondary">
                  No hay transacciones registradas hoy.
                </ThemedText>
              </View>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {todaySales.map((sale) => {
                  const isProduct = sale.tipo === 'producto';
                  const title = isProduct ? sale.producto_nombre : sale.membresia_nombre;
                  const icon = isProduct ? '📦' : '💳';
                  const detail = isProduct
                    ? `Cant: ${sale.cantidad} • Prod: ${sale.producto_nombre}`
                    : `Cliente: ${sale.usuario_nombre || 'Socio'}`;

                  return (
                    <View key={sale.id} style={styles.saleItemRow}>
                      <View style={styles.saleItemIconContainer}>
                        <ThemedText style={{ fontSize: 18 }}>{icon}</ThemedText>
                      </View>

                      <View style={{ flex: 1, paddingRight: Spacing.two }}>
                        <ThemedText type="smallBold" style={styles.saleItemTitle}>
                          {title || 'Venta General'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.saleItemSubtitle}>
                          {detail}
                        </ThemedText>
                        <ThemedText style={styles.saleItemTime}>
                          {new Date(sale.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                      </View>

                      <View style={styles.saleItemAmountContainer}>
                        <ThemedText type="smallBold" style={styles.saleItemAmount}>
                          +₡{Math.round(sale.total).toLocaleString('es-CR')}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  keyboardAvoiding: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
    marginTop: Spacing.three,
    color: '#ffffff',
  },
  subtitle: {
    textAlign: 'center',
    color: '#cccccc',
    fontSize: 14,
  },
  tabToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Spacing.two,
    padding: 4,
    marginBottom: Spacing.two,
  },
  tabToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Spacing.two - 2,
  },
  tabToggleButtonActive: {
    backgroundColor: '#3c87f7',
  },
  tabToggleText: {
    color: '#888888',
    fontWeight: '600',
    fontSize: 14,
  },
  tabToggleTextActive: {
    color: '#ffffff',
  },
  successBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    alignSelf: 'stretch',
  },
  successText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    alignSelf: 'stretch',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewSection: {
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  adminContainer: {
    gap: Spacing.three,
  },
  dashboardGrid: {
    gap: Spacing.three,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderColor: 'rgba(32, 138, 239, 0.4)',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  metricCardGreen: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.4)',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  metricIcon: {
    fontSize: 28,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: Spacing.one,
  },
  alertPanel: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyAlertText: {
    fontSize: 13,
    color: '#888888',
    fontStyle: 'italic',
    paddingVertical: Spacing.one,
  },
  alertItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  alertItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dddddd',
  },
  alertItemDetails: {
    fontSize: 13,
    color: '#888888',
  },
  clientContainer: {
    gap: Spacing.three,
  },
  membershipCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    borderColor: 'rgba(32, 138, 239, 0.2)',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
  },
  membershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  membershipTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Spacing.one,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  membershipDetails: {
    gap: Spacing.one,
  },
  membershipName: {
    fontSize: 16,
    color: '#ffffff',
  },
  membershipExpiry: {
    fontSize: 14,
    color: '#aaaaaa',
  },
  daysLeft: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: Spacing.one,
  },
  noMembership: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  noMembershipText: {
    fontSize: 15,
    color: '#ff9800',
    fontWeight: '600',
    textAlign: 'center',
  },
  noMembershipSubtitle: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
  },
  qrCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    gap: Spacing.two,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  mockQrContainer: {
    width: 160,
    height: 160,
    backgroundColor: '#000000',
    borderWidth: 3,
    borderColor: '#3c87f7',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.two,
    overflow: 'hidden',
  },
  qrBorderLine: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#3c87f7',
    opacity: 0.5,
  },
  qrGrid: {
    width: 100,
    height: 100,
    gap: 4,
  },
  qrGridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  qrPixel: {
    flex: 1,
    backgroundColor: '#111',
  },
  qrCodeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3c87f7',
    letterSpacing: 1.5,
  },
  profileCard: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
    paddingBottom: Spacing.two,
    marginBottom: Spacing.one,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  editButtonToggle: {
    paddingVertical: Spacing.one / 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
    backgroundColor: '#3c87f7',
  },
  editButtonToggleText: {
    color: '#ffffff',
    fontSize: 12,
  },
  viewContainer: {
    gap: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
    paddingVertical: Spacing.two,
  },
  infoValue: {
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  editForm: {
    gap: Spacing.three,
  },
  inputContainer: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    marginLeft: Spacing.one,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    marginTop: Spacing.one,
  },
  passwordSection: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#888888',
  },
  cancelButtonText: {
    color: '#888888',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#3c87f7',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  pushTestButton: {
    minHeight: 48,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  pushTestButtonText: {
    color: '#ffffff',
    fontSize: 15,
  },
  logoutButton: {
    backgroundColor: '#ff4d4f',
    alignSelf: 'stretch',
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  footerSpacing: {
    height: Spacing.four,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: Spacing.two,
    marginBottom: Spacing.two,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalResumen: {
    backgroundColor: 'rgba(60, 135, 247, 0.1)',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(60, 135, 247, 0.2)',
  },
  modalResumenLabel: {
    fontSize: 12,
    color: '#aaaaaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.one / 2,
  },
  modalResumenValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#3c87f7',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    gap: Spacing.two,
  },
  modalEmptyContainer: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  saleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: Spacing.two,
  },
  saleItemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saleItemTitle: {
    color: '#ffffff',
    fontSize: 14,
  },
  saleItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  saleItemTime: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  saleItemAmountContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  saleItemAmount: {
    fontSize: 14,
    color: '#4caf50',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  hamburgerButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 25,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hamburgerIconText: {
    fontSize: 24,
    color: '#ffffff',
    lineHeight: 28,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerContent: {
    width: 280,
    height: '100%',
    padding: Spacing.four,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: -5, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 40 : 10,
    marginBottom: Spacing.three,
  },
  drawerBrand: {
    fontWeight: '800',
    color: '#ffffff',
  },
  drawerCloseButton: {
    padding: 6,
  },
  drawerProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  drawerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  drawerBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  drawerBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.two,
  },
  drawerLinksContainer: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  drawerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.01)',
    gap: Spacing.two,
  },
  drawerLinkIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  drawerLinkText: {
    fontSize: 14,
    color: '#ffffff',
  },
  paymentCardItem: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentCardBrand: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  defaultBadge: {
    backgroundColor: '#3c87f7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  paymentCardNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
    marginVertical: Spacing.one,
  },
  paymentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  paymentCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: Spacing.two,
  },
  cardActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  deleteCardButton: {
    backgroundColor: 'rgba(255,77,79,0.1)',
  },
  cardActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3c87f7',
  },
  addTypeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 3,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: Spacing.two,
  },
  addTypeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  addTypeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  addTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
  },
  addTypeTextActive: {
    color: '#ffffff',
  },
  brandSelectBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  brandSelectBtnActive: {
    borderColor: '#3c87f7',
    backgroundColor: 'rgba(60,135,247,0.08)',
  },
  saveCardButtonFull: {
    backgroundColor: '#3c87f7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
});
