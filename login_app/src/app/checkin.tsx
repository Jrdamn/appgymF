import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  TextInput,
  Platform,
  ImageBackground,
  Pressable,
  RefreshControl,
  Alert,
  Modal,
  Vibration,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface User {
  id: number;
  nombre: string;
  email: string;
  fecha_vencimiento?: string;
}

interface TodayCheckin {
  id: number;
  usuario_nombre: string;
  usuario_email: string;
  usuario_telefono: string;
  fecha: string;
}

export default function CheckinScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isCoach = currentUser?.role === 'coach';

  const isMembershipActive = () => {
    if (!currentUser?.fecha_vencimiento) return false;
    const expiry = new Date(currentUser.fecha_vencimiento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today;
  };

  const getActiveCheckin = () => {
    if (!clientHistory || clientHistory.length === 0) return null;
    const latest = clientHistory[0];
    const latestDate = new Date(latest.fecha);
    const today = new Date();
    const isToday = latestDate.toDateString() === today.toDateString();
    
    if (isToday && !latest.fecha_salida) {
      return latest;
    }
    return null;
  };

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search client (for manual entry)
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<User[]>([]);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);

  // Today's entry log list
  const [todayEntries, setTodayEntries] = useState<TodayCheckin[]>([]);
  const [clientHistory, setClientHistory] = useState<any[]>([]);

  // QR Scanner States
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleOpenScanner = async () => {
    setScanned(false);
    if (!permission || !permission.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permiso Denegado', 'Se requiere acceso a la cámara para escanear códigos QR.');
        return;
      }
    }
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    let clientId = 0;

    if (data.startsWith('SHARK-MEMBER-')) {
      const clientIdStr = data.replace('SHARK-MEMBER-', '');
      clientId = parseInt(clientIdStr, 10);
    } else if (data.includes('/checkins/web-scan?id=')) {
      const parts = data.split('?id=');
      if (parts.length > 1) {
        clientId = parseInt(parts[1], 10);
      }
    }
    
    if (!clientId || isNaN(clientId) || clientId <= 0) {
      Alert.alert(
        'Código no válido',
        'Este código QR no pertenece al sistema de pases de Shark Gym.',
        [{ text: 'Escanear de nuevo', onPress: () => setScanned(false) }]
      );
      return;
    }

    setScannerVisible(false);
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await api.post('/checkins', { usuario_id: clientId });
      if (response.data && response.data.success) {
        Vibration.vibrate(200);
        if (response.data.tipo === 'salida') {
          setSuccessMessage(`🚪 Salida Registrada: ¡Hasta luego, ${response.data.usuario_nombre}!`);
        } else {
          setSuccessMessage(`✅ Acceso Permitido: ¡Bienvenido, ${response.data.usuario_nombre}!`);
        }
        loadData();
      }
    } catch (err: any) {
      console.error('Scan checkin error:', err);
      Vibration.vibrate([100, 100, 100]);
      setErrorMessage(err.response?.data?.message || 'Error al procesar el acceso del código escaneado');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (isAdmin || isCoach) {
        const [usersRes, entriesRes] = await Promise.all([
          api.get('/users'),
          api.get('/checkins/today')
        ]);
        if (usersRes.data && usersRes.data.success) setClients(usersRes.data.data);
        if (entriesRes.data && entriesRes.data.success) setTodayEntries(entriesRes.data.data);
      }
      if (currentUser) {
        const res = await api.get(`/checkins/history/${currentUser.id}`);
        if (res.data && res.data.success) {
          setClientHistory(res.data.data);
        }
      }
    } catch (err: any) {
      console.error('Error loading checkin screen data:', err);
      setErrorMessage(err.response?.data?.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRegisterCheckin = async (client: User) => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await api.post('/checkins', { usuario_id: client.id });
      if (response.data && response.data.success) {
        if (response.data.tipo === 'salida') {
          setSuccessMessage(`🚪 Salida Registrada: ¡Hasta luego, ${response.data.usuario_nombre}!`);
        } else {
          setSuccessMessage(`✅ Acceso Permitido: ¡Bienvenido, ${response.data.usuario_nombre}!`);
        }
        setSelectedClient(null);
        setSearchQuery('');
        // Refresh today checkins list
        loadData();
      }
    } catch (err: any) {
      console.error('Checkin error:', err);
      setErrorMessage(err.response?.data?.message || 'Error al procesar el acceso del cliente');
    } finally {
      setLoading(false);
    }
  };

  const handlePressEntry = (entry: any) => {
    const isTraining = !entry.fecha_salida;

    const confirmDelete = async () => {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const response = await api.delete(`/checkins/${entry.id}`);
        if (response.data && response.data.success) {
          setSuccessMessage(`✅ Entrada de ${entry.usuario_nombre} de hoy eliminada.`);
          loadData();
        }
      } catch (err: any) {
        console.error('Delete checkin error:', err);
        setErrorMessage(err.response?.data?.message || 'Error al eliminar el check-in');
      } finally {
        setLoading(false);
      }
    };

    const handleManualCheckout = async () => {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const response = await api.put(`/checkins/${entry.id}/checkout`, {});
        if (response.data && response.data.success) {
          setSuccessMessage(`🚪 Salida Registrada manualmente: ¡Hasta luego, ${entry.usuario_nombre}!`);
          loadData();
        }
      } catch (err: any) {
        console.error('Manual checkout error:', err);
        setErrorMessage(err.response?.data?.message || 'Error al registrar la salida');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (isTraining) {
        const action = window.confirm(`Presiona ACEPTAR para Registrar Salida (Terminar Sesión).\nPresiona CANCELAR si deseas Eliminar el Registro.`);
        if (action) {
          handleManualCheckout();
        } else {
          const checkDelete = window.confirm(`¿Estás seguro de que deseas ELIMINAR el registro de ${entry.usuario_nombre}?`);
          if (checkDelete) confirmDelete();
        }
      } else {
        const checkDelete = window.confirm(`¿Estás seguro de que deseas ELIMINAR el registro de ${entry.usuario_nombre}?`);
        if (checkDelete) confirmDelete();
      }
    } else {
      if (isTraining) {
        Alert.alert(
          'Opciones de Registro',
          `¿Qué deseas hacer con la sesión activa de ${entry.usuario_nombre}?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Terminar Sesión', 
              onPress: handleManualCheckout 
            },
            { 
              text: 'Eliminar Registro', 
              style: 'destructive', 
              onPress: () => {
                Alert.alert(
                  'Confirmar Eliminación',
                  `¿Estás seguro de que deseas borrar este registro de acceso?`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: confirmDelete }
                  ]
                );
              } 
            }
          ]
        );
      } else {
        Alert.alert(
          'Confirmar eliminación',
          `¿Estás seguro de que deseas eliminar el registro de ${entry.usuario_nombre}?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: confirmDelete }
          ]
        );
      }
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top + Spacing.three,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four,
    },
  });

  const filteredClients = clients.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.containerRoot}>
      <ImageBackground
        source={require('@/assets/images/background-shark.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3c87f7" />
          }
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <ThemedText type="subtitle" style={styles.title}>
                Shark Access
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Control de Entrada y Registro
              </ThemedText>
            </View>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {successMessage && (
              <View style={styles.successBanner}>
                <ThemedText style={styles.successText}>{successMessage}</ThemedText>
              </View>
            )}

            {loading && !refreshing && (
              <ActivityIndicator size="large" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
            )}

            {(isAdmin || isCoach) ? (
              /* ADMIN INTERFACE: ACCESS SCAN & LOG */
              <View style={styles.adminContainer}>
                
                {/* 1. Registrar entrada buscador */}
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two }}>
                    <ThemedText type="smallBold" style={styles.cardTitle}>
                      Escanear o Buscar Cliente
                    </ThemedText>
                    <Pressable
                      style={({ pressed }) => [
                        {
                          backgroundColor: '#208AEF',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          opacity: pressed ? 0.8 : 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6
                        }
                      ]}
                      onPress={handleOpenScanner}
                    >
                      <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                        📷 Escanear QR
                      </ThemedText>
                    </Pressable>
                  </View>
                  
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="Escribe el nombre del cliente..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      if (selectedClient && !text) setSelectedClient(null);
                    }}
                  />

                  {searchQuery && !selectedClient && (
                    <View style={styles.dropdownList}>
                      {filteredClients.slice(0, 5).map(c => (
                        <Pressable
                          key={c.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedClient(c);
                            setSearchQuery(c.nombre);
                          }}
                        >
                          <ThemedText style={{ color: '#fff' }}>{c.nombre}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {selectedClient && (
                    <View style={styles.selectedContainer}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold" style={{ fontSize: 16 }}>{selectedClient.nombre}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{selectedClient.email}</ThemedText>
                      </View>
                      <Pressable 
                        style={styles.checkinButton}
                        onPress={() => handleRegisterCheckin(selectedClient)}
                      >
                        <ThemedText style={styles.checkinButtonText}>Permitir Acceso</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </ThemedView>

                {/* 2. Log de entradas de hoy */}
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold" style={styles.cardTitle}>
                    🏋️ Clientes Entrenando Hoy
                  </ThemedText>
                  
                  {todayEntries.length === 0 ? (
                    <ThemedText style={styles.emptyText} themeColor="textSecondary">
                      Aún no se han registrado entradas el día de hoy.
                    </ThemedText>
                  ) : (
                    <View style={styles.historyList}>
                      {todayEntries.map((entry: any) => {
                        const isTraining = !entry.fecha_salida;
                        return (
                          <Pressable 
                            key={entry.id} 
                            style={({ pressed }) => [
                              styles.historyItem, 
                              { 
                                opacity: pressed ? 0.7 : 1,
                                borderColor: isTraining ? 'rgba(76, 175, 80, 0.25)' : 'rgba(255,255,255,0.03)',
                                borderWidth: 1,
                                paddingVertical: 12,
                                borderRadius: 10,
                                marginBottom: 8,
                                paddingHorizontal: 10,
                                backgroundColor: isTraining ? 'rgba(76, 175, 80, 0.04)' : 'rgba(255, 255, 255, 0.01)'
                              }
                            ]}
                            onPress={() => handlePressEntry(entry)}
                          >
                            <View style={[
                              styles.historyDot, 
                              { backgroundColor: isTraining ? '#4caf50' : '#888', marginTop: 4 }
                            ]} />
                            <View style={{ flex: 1, paddingRight: Spacing.two }}>
                              <ThemedText style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{entry.usuario_nombre}</ThemedText>
                              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 1 }}>
                                {entry.usuario_email}
                              </ThemedText>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                <View style={{
                                  backgroundColor: isTraining ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                  borderRadius: 4,
                                  paddingHorizontal: 6,
                                  paddingVertical: 1
                                }}>
                                  <ThemedText style={{
                                    color: isTraining ? '#4caf50' : '#bbb',
                                    fontSize: 8,
                                    fontWeight: 'bold'
                                  }}>
                                    {isTraining ? 'ENTRENANDO' : 'COMPLETADO'}
                                  </ThemedText>
                                </View>
                                <ThemedText style={{ color: '#888', fontSize: 10 }}>
                                  {isTraining ? `Entrada: ${formatTime(entry.fecha)}` : `Horas: ${formatTime(entry.fecha)} - ${formatTime(entry.fecha_salida)}`}
                                </ThemedText>
                              </View>
                            </View>
                            <View style={{ justifyContent: 'center', paddingLeft: 8 }}>
                              <ThemedText style={{ color: '#ff4d4f', fontSize: 14, fontWeight: 'bold' }}>✕</ThemedText>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </ThemedView>

              </View>
            ) : (
              /* CLIENT INTERFACE: MY QR ACCES PASS */
              <View style={styles.clientContainer}>
                {isMembershipActive() ? (
                  <View style={{ gap: Spacing.three }}>
                    {/* Status Info Card */}
                    {(() => {
                      const activeCheckin = getActiveCheckin();
                      return activeCheckin ? (
                        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: '#4caf50', borderWidth: 1.5, padding: Spacing.three, alignItems: 'center' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4caf50' }} />
                            <ThemedText style={{ color: '#4caf50', fontWeight: 'bold', fontSize: 15 }}>
                              DENTRO DEL GIMNASIO (ENTRENANDO)
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                            Ingresaste hoy a las {formatTime(activeCheckin.fecha)}. Muestra tu código al salir para registrar tu salida. ¡Buen entreno!
                          </ThemedText>
                        </ThemedView>
                      ) : (
                        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: '#ff9800', borderWidth: 1.5, padding: Spacing.three, alignItems: 'center' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff9800' }} />
                            <ThemedText style={{ color: '#ff9800', fontWeight: 'bold', fontSize: 15 }}>
                              FUERA DEL GIMNASIO
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                            Muestra este código al recepcionista para registrar tu entrada y comenzar a entrenar.
                          </ThemedText>
                        </ThemedView>
                      );
                    })()}

                    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5 }]}>
                      <ThemedText type="smallBold" style={[styles.qrCardTitle, { color: '#fff', textAlign: 'center' }]}>
                        Mi Pase Digital de Acceso
                      </ThemedText>
                      <ThemedText style={[styles.qrCardSubtitle, { textAlign: 'center' }]}>
                        Muestra este código en recepción para entrar o salir
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
                          source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`http://192.168.100.2:3000/api/v1/checkins/web-scan?id=${currentUser?.id || 0}`)}` }}
                          style={{ width: 160, height: 160 }}
                        />
                      </View>

                      <ThemedText style={styles.qrCodeText}>
                        CÓDIGO: SHARK-MEMBER-{currentUser?.id || 0}
                      </ThemedText>
                    </ThemedView>
                  </View>
                ) : (
                  <ThemedView type="backgroundElement" style={[styles.card, { borderColor: '#ff4d4f', borderWidth: 1.5, alignItems: 'center', padding: Spacing.four }]}>
                    <ThemedText style={{ fontSize: 50 }}>🔒</ThemedText>
                    <ThemedText type="subtitle" style={{ color: '#ff4d4f', fontWeight: '700', marginTop: Spacing.two }}>
                      Pase de Acceso Inactivo
                    </ThemedText>
                    <ThemedText style={{ textAlign: 'center', marginVertical: Spacing.three }} themeColor="textSecondary">
                      Tu membresía ha vencido o no tienes un plan activo asignado. Renueva tu plan para desbloquear tu pase digital.
                    </ThemedText>
                    <Pressable
                      style={({ pressed }) => [
                        {
                          backgroundColor: '#208AEF',
                          paddingVertical: 12,
                          paddingHorizontal: 24,
                          borderRadius: 8,
                          opacity: pressed ? 0.8 : 1,
                          width: '100%'
                        }
                      ]}
                      onPress={() => router.push('/plans')}
                    >
                      <ThemedText type="smallBold" style={{ color: '#fff', textAlign: 'center' }}>
                        Ver Planes de Membresía
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                )}
              </View>
             )}
          </View>
        </ScrollView>
      </ImageBackground>

      {/* Scanner QR Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? 55 : 20,
            paddingHorizontal: 20,
            paddingBottom: 15,
            backgroundColor: '#121214',
            borderBottomWidth: 1,
            borderBottomColor: '#202024'
          }}>
            <ThemedText type="smallBold" style={{ fontSize: 16, color: '#fff' }}>
              Escanear Pase de Acceso (QR)
            </ThemedText>
            <Pressable 
              onPress={() => setScannerVisible(false)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 8
              }}
            >
              <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                Cancelar
              </ThemedText>
            </Pressable>
          </View>

          {/* Camera View */}
          {permission && permission.granted ? (
            <View style={{ flex: 1, position: 'relative' }}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />
              
              {/* Overlay styling for target scanner */}
              <View style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.6)'
              }}>
                <View style={{
                  width: 250,
                  height: 250,
                  borderWidth: 3,
                  borderColor: '#208AEF',
                  borderRadius: 16,
                  backgroundColor: 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {/* Subtle target viewfinder corner hints */}
                  <View style={{ position: 'absolute', top: 10, left: 10, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#fff' }} />
                  <View style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#fff' }} />
                  <View style={{ position: 'absolute', bottom: 10, left: 10, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#fff' }} />
                  <View style={{ position: 'absolute', bottom: 10, right: 10, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#fff' }} />
                </View>
                <ThemedText style={{ color: '#fff', marginTop: 24, fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(10,10,12,0.85)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  Apunta al código QR del cliente
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#121214' }}>
              <ThemedText style={{ color: '#ff4d4f', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                No se cuenta con permisos de cámara para realizar escaneo en tiempo real.
              </ThemedText>
              <Pressable 
                onPress={requestPermission}
                style={{
                  backgroundColor: '#208AEF',
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8
                }}
              >
                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>
                  Conceder Permiso de Cámara
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Desktop Simulator Overlay / Helper Panel */}
          <View style={{
            padding: 15,
            backgroundColor: '#121214',
            borderTopWidth: 1,
            borderTopColor: '#202024'
          }}>
            <ThemedText type="smallBold" style={{ color: '#bbb', fontSize: 13, marginBottom: 10 }}>
              💻 Simular Escaneo (Prueba rápida de QR):
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 5 }}>
              {clients.map((c) => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [
                    {
                      backgroundColor: 'rgba(32, 138, 239, 0.12)',
                      borderColor: '#208AEF',
                      borderWidth: 1,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: pressed ? 0.7 : 1
                    }
                  ]}
                  onPress={() => handleBarcodeScanned({ data: `SHARK-MEMBER-${c.id}` })}
                >
                  <ThemedText style={{ color: '#208AEF', fontSize: 12, fontWeight: 'bold' }}>
                    QR: {c.nombre.split(' ')[0]} ({c.id})
                  </ThemedText>
                </Pressable>
              ))}
              {clients.length === 0 && (
                <ThemedText style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>
                  No hay clientes cargados para simular.
                </ThemedText>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  containerRoot: {
    flex: 1,
    backgroundColor: '#121212',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: Spacing.three,
    width: '100%',
  },
  header: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 18,
    marginTop: Spacing.half,
    color: '#cccccc',
  },
  errorBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#FFEDED',
    borderWidth: 1,
    borderColor: '#FFA1A1',
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },
  successBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#B3E1C1',
  },
  successText: {
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: '600',
  },
  adminContainer: {
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: Spacing.one,
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dropdownList: {
    backgroundColor: '#1a1a1a',
    borderRadius: Spacing.one,
    padding: Spacing.one,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownItem: {
    padding: Spacing.two,
    borderRadius: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Spacing.one,
    marginTop: Spacing.one,
  },
  checkinButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Spacing.one,
  },
  checkinButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
    fontStyle: 'italic',
  },
  historyList: {
    gap: Spacing.two,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
    gap: Spacing.two,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
  },
  historyTime: {
    color: '#888',
    fontSize: 13,
  },
  clientContainer: {
    alignItems: 'center',
  },
  qrCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrCardSubtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
  mockQrContainer: {
    width: 200,
    height: 200,
    backgroundColor: '#000',
    borderWidth: 3,
    borderColor: '#3c87f7',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.three,
    overflow: 'hidden',
    alignSelf: 'center',
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
    width: 140,
    height: 140,
    gap: 6,
  },
  qrGridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  qrPixel: {
    flex: 1,
    backgroundColor: '#111',
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3c87f7',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
});
