import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  Pressable,
  ImageBackground,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface Membership {
  id: number;
  nombre: string;
  precio: number;
  duracion_dias: number;
}

export default function PlansScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user: currentUser, token, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Membership[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Purchase States
  const [selectedPlan, setSelectedPlan] = useState<Membership | null>(null);
  const [paying, setPaying] = useState(false);
  const [successSaleId, setSuccessSaleId] = useState<number | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Saved Payment Selection States
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<number | 'paypal'>('paypal');
  const [methodsLoading, setMethodsLoading] = useState(false);

  const fetchPaymentMethods = async () => {
    setMethodsLoading(true);
    try {
      const response = await api.get('/payments/methods');
      if (response.data && response.data.success) {
        const list = response.data.data;
        setPaymentMethods(list);
        // Find default method if exists
        const defaultMethod = list.find((m: any) => m.es_predeterminado === 1);
        if (defaultMethod) {
          setSelectedMethodId(defaultMethod.id);
        } else if (list.length > 0) {
          setSelectedMethodId(list[0].id);
        } else {
          setSelectedMethodId('paypal');
        }
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    } finally {
      setMethodsLoading(false);
    }
  };

  const handleCardPlanPayment = async () => {
    if (!selectedPlan) return;
    const total = parseFloat(selectedPlan.precio.toString());

    setPaying(true);
    setErrorMessage(null);
    try {
      const response = await api.post('/payments/process-card-payment', {
        cardId: selectedMethodId,
        usuario_id: currentUser?.id,
        membresia_id: selectedPlan.id,
        cantidad: 1,
        total,
        tipo: 'membresia'
      });

      if (response.data && response.data.success) {
        setSuccessSaleId(response.data.saleId);
        setSelectedPlan(null);
        setPaying(false);
        await refreshProfile(); // Actualizar membresía en tiempo real en la app
      }
    } catch (err: any) {
      console.error('Card payment error:', err);
      setErrorMessage(err.response?.data?.message || 'Error al procesar el pago con tu tarjeta.');
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    if (selectedPlan) {
      fetchPaymentMethods();
    }
  }, [selectedPlan]);

  const loadPlans = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get('/memberships');
      if (response.data && response.data.success) {
        setPlans(response.data.data);
      }
    } catch (err: any) {
      console.error('Error loading plans:', err);
      setErrorMessage(err.response?.data?.message || 'Error de conexión al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [])
  );

  const handleBuyPlan = async () => {
    if (!selectedPlan) return;
    setPaying(true);
    setErrorMessage(null);

    try {
      // 1. Crear la orden de PayPal
      const response = await api.post('/payments/create-paypal-order', {
        total: parseFloat(selectedPlan.precio.toString()),
        tipo: 'membresia',
        membresia_nombre: selectedPlan.nombre,
        redirectUrl: Linking.createURL('/')
      });

      if (response.data && response.data.success) {
        const { orderId, approveUrl } = response.data;

        // 2. Abrir navegador con fallback robusto
        try {
          await WebBrowser.dismissBrowser();
          await WebBrowser.openBrowserAsync(approveUrl);
        } catch (browserErr) {
          console.warn('WebBrowser error, falling back to Linking:', browserErr);
          const { Linking } = require('react-native');
          await Linking.openURL(approveUrl);
        }

        // 3. Capturar automáticamente al regresar
        setErrorMessage(null);
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const captureRes = await api.post('/payments/capture-paypal-order', {
          orderId,
          usuario_id: currentUser?.id,
          membresia_id: selectedPlan.id,
          cantidad: 1,
          total: parseFloat(selectedPlan.precio.toString()),
          tipo: 'membresia'
        });

        if (captureRes.data && captureRes.data.success) {
          setSuccessSaleId(captureRes.data.saleId);
          setSelectedPlan(null);
          await refreshProfile(); // Actualizar membresía en tiempo real en la app
        } else {
          setErrorMessage('No pudimos verificar la aprobación del pago. Si lo completaste, por favor contáctanos.');
        }
      }
    } catch (err: any) {
      console.error('PayPal purchase/capture error:', err);
      setErrorMessage(err.response?.data?.message || 'El pago no ha sido completado todavía o fue cancelado.');
    } finally {
      setPaying(false);
    }
  };

  const handleCancelMembership = async () => {
    const { Alert } = require('react-native');
    Alert.alert(
      'Cancelar Membresía',
      '¿Estás seguro de que deseas cancelar tu membresía activa? Perderás el acceso al gimnasio de inmediato.',
      [
        { text: 'No, conservar', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await api.post('/auth/cancel-membership', {});
              if (res.data && res.data.success) {
                Alert.alert('Membresía Cancelada', 'Tu membresía ha sido cancelada correctamente.');
                await refreshProfile(); // Recargar datos locales del usuario
              }
            } catch (e: any) {
              console.error(e);
              Alert.alert('Error', e.response?.data?.message || 'No se pudo cancelar la membresía. Inténtalo más tarde.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDownloadReceipt = () => {
    if (!successSaleId) return;
    const downloadUrl = `http://192.168.100.2:3000/api/v1/sales/${successSaleId}/pdf?token=${token}`;
    const { Linking } = require('react-native');
    Linking.openURL(downloadUrl);
  };

  const getPlanDurationLabel = (days: number) => {
    if (days === 1) return 'Pase por 1 Día';
    if (days === 30) return 'Acceso por 30 Días';
    if (days === 90) return 'Acceso por 3 Meses';
    if (days === 365) return 'Acceso por 1 Año';
    return `Acceso por ${days} Días`;
  };

  const getPlanBenefits = (days: number) => {
    const base = [
      '🏋️ Acceso libre a área de pesas',
      '💧 Estación de hidratación gratis',
      '📱 Pase digital rápido QR'
    ];
    if (days >= 30) {
      base.push('🤝 1 sesión de asesoría de rutina');
    }
    if (days >= 90) {
      base.push('🧴 Acceso a casillero privado');
    }
    if (days >= 365) {
      base.push('🔥 10% Descuento en Shark Store');
      base.push('🥋 Clases grupales incluidas');
    }
    return base;
  };

  const isMembershipActive = () => {
    if (!currentUser?.fecha_vencimiento) return false;
    const expiry = new Date(currentUser.fecha_vencimiento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today;
  };

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  return (
    <View style={styles.containerRoot}>
      <ImageBackground
        source={require('@/assets/images/background-shark.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            {
              paddingTop: Platform.OS === 'android' ? insets.top + Spacing.three : Spacing.four,
              paddingBottom: insets.bottom,
              paddingHorizontal: Spacing.four,
            }
          ]}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <ThemedText type="subtitle" style={styles.title}>
                Planes de Membresía
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Adquiere o renueva tu membresía pagando de forma segura
              </ThemedText>
            </View>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {loading && !paying && (
              <ActivityIndicator size="large" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
            )}

            {/* LISTADO DE PLANES */}
            <View style={{ gap: Spacing.four, width: '100%' }}>
              {plans.length === 0 && !loading ? (
                <ThemedView type="backgroundElement" style={{ padding: Spacing.four, borderRadius: Spacing.two, alignItems: 'center' }}>
                  <ThemedText style={{ fontStyle: 'italic' }} themeColor="textSecondary">
                    Cargando planes del gimnasio...
                  </ThemedText>
                </ThemedView>
              ) : (
                plans.map((plan) => {
                  const isCurrentActivePlan = isMembershipActive() && Number(currentUser?.membresia_id) === Number(plan.id);
                  return (
                    <ThemedView 
                      key={plan.id} 
                      type="backgroundElement" 
                      style={[
                        styles.planCard,
                        isCurrentActivePlan && { borderColor: '#2E7D32', borderWidth: 2, backgroundColor: 'rgba(46, 125, 50, 0.08)' }
                      ]}
                    >
                      {isCurrentActivePlan && (
                        <View style={[styles.bestValueBadge, { backgroundColor: '#2E7D32' }]}>
                          <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>TU PLAN ACTUAL</ThemedText>
                        </View>
                      )}

                      {plan.duracion_dias >= 365 && !isCurrentActivePlan && (
                        <View style={styles.bestValueBadge}>
                          <ThemedText style={styles.bestValueText}>MEJOR VALOR</ThemedText>
                        </View>
                      )}
                      
                      <ThemedText type="subtitle" style={styles.planTitle}>{plan.nombre}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                        {getPlanDurationLabel(plan.duracion_dias)}
                      </ThemedText>

                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginVertical: Spacing.two }}>
                        <ThemedText style={styles.currency}>₡</ThemedText>
                        <ThemedText style={styles.price}>{Math.round(plan.precio).toLocaleString('es-CR')}</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.duration}> Colones</ThemedText>
                      </View>

                      <View style={{ gap: 6, marginVertical: Spacing.two }}>
                        {getPlanBenefits(plan.duracion_dias).map((benefit, idx) => (
                          <ThemedText key={idx} style={{ fontSize: 13, color: '#ddd' }}>{benefit}</ThemedText>
                        ))}
                      </View>

                      {isCurrentActivePlan ? (
                        <View style={{ gap: 8, marginTop: Spacing.two }}>
                          <View
                            style={[
                              styles.buyButton,
                              {
                                backgroundColor: '#2E7D32',
                                opacity: 1,
                              }
                            ]}
                          >
                            <ThemedText type="smallBold" style={{ color: '#fff' }}>
                              Plan Activo ✅
                            </ThemedText>
                          </View>
                          <Pressable
                            style={({ pressed }) => [
                              styles.cancelButton,
                              {
                                opacity: pressed ? 0.7 : 1,
                              }
                            ]}
                            onPress={handleCancelMembership}
                            disabled={loading}
                          >
                            <ThemedText style={{ color: '#E53935', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                              Cancelar Membresía
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.buyButton,
                            {
                              backgroundColor: plan.duracion_dias >= 365 ? '#FFC439' : '#208AEF',
                              opacity: pressed ? 0.8 : 1,
                              marginTop: Spacing.two
                            }
                          ]}
                          onPress={() => {
                            if (isMembershipActive()) {
                              const { Alert } = require('react-native');
                              Alert.alert(
                                'Membresía Activa',
                                `Ya tienes la membresía activa "${currentUser?.membresia_nombre || 'Plan Gym'}". Para adquirir un plan diferente, primero debes cancelar tu plan activo actual.`
                              );
                              return;
                            }
                            setSelectedPlan(plan);
                            setErrorMessage(null);
                          }}
                        >
                          <ThemedText type="smallBold" style={{ color: plan.duracion_dias >= 365 ? '#003087' : '#fff' }}>
                            Seleccionar Plan
                          </ThemedText>
                        </Pressable>
                      )}
                    </ThemedView>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      </ImageBackground>

      {/* MODAL DE CONFIRMACIÓN Y CHECKOUT PAYPAL */}
      <Modal
        visible={selectedPlan !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedPlan(null)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Pagar Membresía
            </ThemedText>

            {selectedPlan && (
              <View style={{ gap: Spacing.two, marginVertical: Spacing.two }}>
                <View style={{ padding: Spacing.three, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, borderWidth: 1, borderColor: '#333' }}>
                  <ThemedText type="smallBold" style={{ fontSize: 16 }}>{selectedPlan.nombre}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
                    Duración: {selectedPlan.duracion_dias} días de acceso continuo.
                  </ThemedText>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two, borderTopWidth: 1, borderColor: '#333', paddingTop: Spacing.one }}>
                    <ThemedText themeColor="textSecondary">Monto Total:</ThemedText>
                    <ThemedText type="smallBold" style={{ fontSize: 18, color: '#4caf50' }}>
                      ₡{Math.round(selectedPlan.precio).toLocaleString('es-CR')}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={{ fontSize: 12, textAlign: 'center', marginHorizontal: Spacing.two }} themeColor="textSecondary">
                  La renovación se aplicará de inmediato y extenderá la fecha de vencimiento actual.
                </ThemedText>
              </View>
            )}

            {paying ? (
              <View style={{ gap: Spacing.three, padding: Spacing.four, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3c87f7" />
                <ThemedText style={{ textAlign: 'center', fontSize: 14, color: '#fff', fontWeight: '600' }}>
                  Procesando tu transacción...
                </ThemedText>
                <ThemedText style={{ textAlign: 'center', fontSize: 12, color: '#888' }}>
                  Por favor, completa el pago en el navegador si has seleccionado PayPal.
                </ThemedText>
              </View>
            ) : (
              <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                  Selecciona tu Método de Pago:
                </ThemedText>

                {methodsLoading ? (
                  <ActivityIndicator size="small" color="#3c87f7" style={{ marginVertical: Spacing.two }} />
                ) : (
                  <View style={{ gap: 8, marginBottom: Spacing.two }}>
                    {/* PayPal option */}
                    <Pressable
                      style={[
                        styles.checkoutMethodItem,
                        selectedMethodId === 'paypal' && styles.checkoutMethodItemActive
                      ]}
                      onPress={() => setSelectedMethodId('paypal')}
                    >
                      <ThemedText style={{ fontSize: 18 }}>💙</ThemedText>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }}>PayPal</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>Nueva transacción en el navegador</ThemedText>
                      </View>
                      <View style={[styles.checkbox, selectedMethodId === 'paypal' && styles.checkboxActive]} />
                    </Pressable>

                    {/* Saved Cards & PayPal accounts */}
                    {paymentMethods.map((method) => {
                      const isCard = method.tipo === 'tarjeta';
                      const isSelected = selectedMethodId === method.id;
                      const title = isCard ? `${method.marca} •••• ${method.numero_enmascarado.slice(-4)}` : `PayPal (${method.email_paypal})`;
                      const subtitle = isCard ? `Vence: ${method.fecha_expiracion}` : 'Cuenta vinculada';
                      const icon = isCard ? '💳' : '💙';

                      return (
                        <Pressable
                          key={method.id}
                          style={[
                            styles.checkoutMethodItem,
                            isSelected && styles.checkoutMethodItemActive
                          ]}
                          onPress={() => setSelectedMethodId(method.id)}
                        >
                          <ThemedText style={{ fontSize: 18 }}>{icon}</ThemedText>
                          <View style={{ flex: 1 }}>
                            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }}>{title}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>{subtitle}</ThemedText>
                          </View>
                          <View style={[styles.checkbox, isSelected && styles.checkboxActive]} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {selectedMethodId === 'paypal' || (paymentMethods.find(m => m.id === selectedMethodId)?.tipo === 'paypal') ? (
                  /* PayPal Button */
                  <Pressable
                    style={({ pressed }) => [
                      {
                        backgroundColor: '#FFC439', // PayPal Yellow
                        height: 48,
                        borderRadius: 8,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: pressed || paying ? 0.8 : 1,
                        flexDirection: 'row',
                        gap: 8
                      }
                    ]}
                    onPress={handleBuyPlan}
                    disabled={paying}
                  >
                    {paying ? (
                      <ActivityIndicator color="#003087" size="small" />
                    ) : (
                      <>
                        <ThemedText style={{ color: '#003087', fontWeight: '800', fontSize: 15, fontStyle: 'italic' }}>PayPal</ThemedText>
                        <ThemedText style={{ color: '#003087', fontWeight: 'bold', fontSize: 14 }}>Pagar ahora</ThemedText>
                      </>
                    )}
                  </Pressable>
                ) : (
                  /* Card Button */
                  <Pressable
                    style={({ pressed }) => [
                      {
                        backgroundColor: '#208AEF',
                        height: 48,
                        borderRadius: 8,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: pressed || paying ? 0.8 : 1,
                      }
                    ]}
                    onPress={handleCardPlanPayment}
                    disabled={paying}
                  >
                    {paying ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 14 }}>
                        Pagar con Tarjeta Guardada
                      </ThemedText>
                    )}
                  </Pressable>
                )}

                <Pressable
                  style={styles.modalBtnCancel}
                  onPress={() => setSelectedPlan(null)}
                  disabled={paying}
                >
                  <ThemedText style={{ color: '#aaa', textAlign: 'center' }}>Cancelar</ThemedText>
                </Pressable>
              </View>
            )}
          </ThemedView>
        </View>
      </Modal>

      {/* MODAL DE ÉXITO DE PAGO PLAN */}
      <Modal
        visible={successSaleId !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSuccessSaleId(null)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText style={{ fontSize: 50, textAlign: 'center' }}>🏆</ThemedText>
            <ThemedText type="subtitle" style={{ textAlign: 'center', color: '#4caf50', fontWeight: '700' }}>
              ¡Membresía Activada!
            </ThemedText>
            <ThemedText style={{ textAlign: 'center', marginVertical: Spacing.two }} themeColor="textSecondary">
              Tu pago ha sido procesado exitosamente. Ya tienes acceso activo a las instalaciones del gimnasio.
            </ThemedText>

            <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
              <Pressable
                style={({ pressed }) => [
                  {
                    backgroundColor: '#208AEF',
                    height: 44,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pressed ? 0.8 : 1
                  }
                ]}
                onPress={handleDownloadReceipt}
              >
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  Descargar Recibo PDF
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.modalBtnCancel}
                onPress={() => setSuccessSaleId(null)}
              >
                <ThemedText style={{ color: '#aaa', textAlign: 'center' }}>Volver</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
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
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: Spacing.four,
    width: '100%',
  },
  header: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
  },
  errorBanner: {
    padding: Spacing.three,
    backgroundColor: '#FFEDED',
    borderColor: '#FFA1A1',
    borderWidth: 1,
    borderRadius: Spacing.two,
    width: '100%',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  successBanner: {
    padding: Spacing.three,
    backgroundColor: '#EAF7EA',
    borderColor: '#A1DFA1',
    borderWidth: 1,
    borderRadius: Spacing.two,
    width: '100%',
  },
  successText: {
    color: '#2E7D32',
    fontSize: 14,
    textAlign: 'center',
  },
  planCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFC439',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  bestValueText: {
    color: '#003087',
    fontSize: 10,
    fontWeight: '800',
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  currency: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#208AEF',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  price: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 44,
  },
  duration: {
    fontSize: 14,
  },
  buyButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E53935',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBtnCancel: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  checkoutMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: 12,
  },
  checkoutMethodItemActive: {
    borderColor: '#3c87f7',
    backgroundColor: 'rgba(60, 135, 247, 0.1)',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: '#3c87f7',
    backgroundColor: '#3c87f7',
  },
});
