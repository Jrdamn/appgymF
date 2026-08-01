import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  TextInput,
  Platform,
  ImageBackground,
  Pressable,
  Modal,
  Image,
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

const productImages: { [key: string]: any } = {
  'agua mineral 500ml': require('@/assets/images/water_bottle.png'),
  'bebida energética shark 250ml': require('@/assets/images/energy_drink.png'),
  'bebida energética shark 600ml': require('@/assets/images/energy_drink.png'),
  'barra de proteína (chocolate)': require('@/assets/images/protein_bar.png'),
  'barra de proteína (fresa)': require('@/assets/images/protein_bar.png'),
  'proteína en polvo 1kg': require('@/assets/images/protein_powder.png'),
  'proteína en polvo 2kg': require('@/assets/images/protein_powder.png'),
  'shaker de acero 500ml': require('@/assets/images/shaker.png'),
  'shaker de acero 700ml': require('@/assets/images/shaker.png'),
};

function getProductImage(name: string) {
  const clean = name.toLowerCase().trim();
  if (productImages[clean]) {
    return productImages[clean];
  }
  if (clean.includes('agua') || clean.includes('water')) return productImages['agua mineral 500ml'];
  if (clean.includes('bebida') || clean.includes('energy') || clean.includes('shark')) return productImages['bebida energética shark 250ml'];
  if (clean.includes('barra') || clean.includes('protein bar') || clean.includes('bar')) return productImages['barra de proteína (chocolate)'];
  if (clean.includes('polvo') || clean.includes('proteína') || clean.includes('powder')) return productImages['proteína en polvo 1kg'];
  if (clean.includes('shaker') || clean.includes('mezclador') || clean.includes('vaso')) return productImages['shaker de acero 500ml'];
  return require('@/assets/images/logo-custom.png');
}

interface Product {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface Membership {
  id: number;
  nombre: string;
  precio: number;
  duracion_dias: number;
}

interface User {
  id: number;
  nombre: string;
  email: string;
}

export default function StoreScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user: currentUser, token } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // Screen Views
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory'>('pos');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // POS State
  const [clients, setClients] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [posType, setPosType] = useState<'producto' | 'membresia'>('producto');
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQuantity, setProductQuantity] = useState('1');
  
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null);

  // Inventory Editor State
  const [invType, setInvType] = useState<'products' | 'memberships'>('products');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null); // Product or Membership
  
  // Fields for creation/editing
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formDays, setFormDays] = useState('');

  // Client Buy States
  const [clientSelectedProduct, setClientSelectedProduct] = useState<Product | null>(null);
  const [clientQuantity, setClientQuantity] = useState('1');
  const [clientPaying, setClientPaying] = useState(false);
  const [clientSuccessSaleId, setClientSuccessSaleId] = useState<number | null>(null);
  const [clientOrderId, setClientOrderId] = useState<string | null>(null);

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

  const handleCardProductPayment = async () => {
    if (!clientSelectedProduct) return;
    const qty = parseInt(clientQuantity);
    const total = clientSelectedProduct.precio * qty;

    setClientPaying(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await api.post('/payments/process-card-payment', {
        cardId: selectedMethodId,
        usuario_id: currentUser?.id,
        producto_id: clientSelectedProduct.id,
        cantidad: qty,
        total,
        tipo: 'producto'
      });

      if (response.data && response.data.success) {
        setClientSuccessSaleId(response.data.saleId);
        setClientSelectedProduct(null);
        setClientQuantity('1');
        loadData(); // Actualizar stock
      }
    } catch (err: any) {
      console.error('Card payment error:', err);
      setErrorMessage(err.response?.data?.message || 'Error al procesar el pago con tu tarjeta.');
    } finally {
      setClientPaying(false);
    }
  };

  useEffect(() => {
    if (clientSelectedProduct) {
      fetchPaymentMethods();
    }
  }, [clientSelectedProduct]);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (isAdmin) {
        const [prodRes, membRes, usersRes] = await Promise.all([
          api.get('/products'),
          api.get('/memberships'),
          api.get('/users'),
        ]);
        
        if (prodRes.data && prodRes.data.success) setProducts(prodRes.data.data);
        if (membRes.data && membRes.data.success) setMemberships(membRes.data.data);
        if (usersRes.data && usersRes.data.success) setClients(usersRes.data.data);
      } else {
        const prodRes = await api.get('/products');
        if (prodRes.data && prodRes.data.success) setProducts(prodRes.data.data);
      }
    } catch (err: any) {
      console.error('Error loading store data:', err);
      setErrorMessage(err.response?.data?.message || 'Error de conexión al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleClientBuyProduct = async () => {
    if (!clientSelectedProduct) return;
    const qty = parseInt(clientQuantity);
    if (isNaN(qty) || qty <= 0 || qty > clientSelectedProduct.stock) {
      setErrorMessage('Cantidad no válida o excede el stock disponible');
      return;
    }

    setClientPaying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const total = clientSelectedProduct.precio * qty;

      // 1. Crear orden de PayPal
      const response = await api.post('/payments/create-paypal-order', {
        total,
        tipo: 'producto',
        producto_nombre: clientSelectedProduct.nombre,
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
          producto_id: clientSelectedProduct.id,
          cantidad: qty,
          total,
          tipo: 'producto'
        });

        if (captureRes.data && captureRes.data.success) {
          setClientSuccessSaleId(captureRes.data.saleId);
          setClientSelectedProduct(null);
          setClientQuantity('1');
          loadData(); // Actualizar stock
        } else {
          setErrorMessage('No pudimos verificar la aprobación del pago. Si lo completaste, por favor contáctanos.');
        }
      }
    } catch (err: any) {
      console.error('PayPal purchase/capture error:', err);
      setErrorMessage(err.response?.data?.message || 'El pago no ha sido completado todavía o fue cancelado.');
    } finally {
      setClientPaying(false);
    }
  };



  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [isAdmin])
  );

  const handleRegisterSale = async () => {
    if (posType === 'producto' && (!selectedProduct || !productQuantity)) {
      setErrorMessage('Selecciona un producto y cantidad válida');
      return;
    }
    if (posType === 'membresia' && (!selectedClient || !selectedMembership)) {
      setErrorMessage('Selecciona un cliente y plan de membresía');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const quantity = posType === 'producto' ? parseInt(productQuantity) : 1;
      const total = posType === 'producto' 
        ? (selectedProduct!.precio * quantity)
        : selectedMembership!.precio;

      const payload = {
        usuario_id: selectedClient?.id || null,
        producto_id: posType === 'producto' ? selectedProduct!.id : null,
        membresia_id: posType === 'membresia' ? selectedMembership!.id : null,
        cantidad: quantity,
        total,
        tipo: posType,
      };

      const response = await api.post('/sales', payload);
      if (response.data && response.data.success) {
        setSuccessMessage('¡Venta registrada exitosamente!');
        setSelectedProduct(null);
        setProductQuantity('1');
        setSelectedMembership(null);
        loadData();
      }
    } catch (err: any) {
      console.error('POS error:', err);
      setErrorMessage(err.response?.data?.message || 'Error al procesar la venta');
    } finally {
      setLoading(false);
    }
  };

  // Inventory Create/Edit Submission
  const handleSaveInventoryItem = async () => {
    if (!formName.trim() || !formPrice.trim()) {
      setErrorMessage('Por favor, ingresa el nombre y el precio.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      let response;
      if (invType === 'products') {
        const payload = {
          nombre: formName.trim(),
          precio: parseFloat(formPrice),
          stock: formStock ? parseInt(formStock) : 0
        };

        if (editingItem) {
          response = await api.put(`/products/${editingItem.id}`, payload);
        } else {
          response = await api.post('/products', payload);
        }
      } else {
        const payload = {
          nombre: formName.trim(),
          precio: parseFloat(formPrice),
          duracion_dias: formDays ? parseInt(formDays) : 30
        };

        if (editingItem) {
          setErrorMessage('Edición de planes no disponible. Crea un plan nuevo.');
          setLoading(false);
          return;
        } else {
          response = await api.post('/memberships', payload);
        }
      }

      if (response.data && response.data.success) {
        setEditorVisible(false);
        setEditingItem(null);
        loadData();
      }
    } catch (err: any) {
      console.error('Inventory save error:', err);
      setErrorMessage(err.response?.data?.message || 'Error al guardar elemento');
    } finally {
      setLoading(false);
    }
  };

  const openCreateEditor = () => {
    setEditingItem(null);
    setFormName('');
    setFormPrice('');
    setFormStock('');
    setFormDays('');
    setErrorMessage(null);
    setEditorVisible(true);
  };

  const openEditProductEditor = (prod: Product) => {
    setEditingItem(prod);
    setFormName(prod.nombre);
    setFormPrice(prod.precio.toString());
    setFormStock(prod.stock.toString());
    setErrorMessage(null);
    setEditorVisible(true);
  };

  const handleDeleteProduct = async (id: number) => {
    setLoading(true);
    try {
      const response = await api.delete(`/products/${id}`);
      if (response.data && response.data.success) {
        loadData();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Error al eliminar producto');
    } finally {
      setLoading(false);
    }
  };

  const getProductIcon = (name: string) => {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes('agua') || lowercaseName.includes('bebida') || lowercaseName.includes('shaker')) {
      return '🥤';
    }
    if (lowercaseName.includes('energ') || lowercaseName.includes('shark')) {
      return '⚡';
    }
    if (lowercaseName.includes('barra') || lowercaseName.includes('prote')) {
      return '🍫';
    }
    return '📦';
  };

  if (!isAdmin) {
    const insets = {
      ...safeAreaInsets,
      bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
    };
    
    const handleDownloadReceipt = () => {
      if (!clientSuccessSaleId) return;
      const downloadUrl = `http://192.168.100.2:3000/api/v1/sales/${clientSuccessSaleId}/pdf?token=${token}`;
      const { Linking } = require('react-native');
      Linking.openURL(downloadUrl);
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
                  Shark Store
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  Compra suplementos y bebidas para potenciar tu entrenamiento
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

              {loading && !clientPaying && (
                <ActivityIndicator size="large" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
              )}

              {/* LISTADO DE PRODUCTOS CLIENTE (Diseño en Cuadrícula E-commerce) */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' }}>
                {products.length === 0 ? (
                  <ThemedView type="backgroundElement" style={{ padding: Spacing.four, borderRadius: Spacing.two, alignItems: 'center', width: '100%' }}>
                    <ThemedText style={{ fontStyle: 'italic' }} themeColor="textSecondary">No hay productos disponibles actualmente.</ThemedText>
                  </ThemedView>
                ) : (
                  products.map((prod) => (
                    <ThemedView key={prod.id} type="backgroundElement" style={styles.productCardGrid}>
                      {/* Image Container with solid card background */}
                      <View style={styles.productImageContainer}>
                        <Image source={getProductImage(prod.nombre)} style={styles.productImage} resizeMode="contain" />
                        {/* Floating Add Button */}
                        <Pressable
                          style={({ pressed }) => [
                            styles.productAddBtn,
                            { 
                              backgroundColor: prod.stock > 0 ? '#208AEF' : '#444',
                              opacity: pressed && prod.stock > 0 ? 0.8 : 1
                            }
                          ]}
                          disabled={prod.stock <= 0}
                          onPress={() => {
                            setClientSelectedProduct(prod);
                            setClientQuantity('1');
                            setErrorMessage(null);
                          }}
                        >
                          <ThemedText style={{ color: prod.stock > 0 ? '#ffffff' : '#888', fontSize: 18, fontWeight: '700', lineHeight: Platform.OS === 'ios' ? 22 : 20, textAlign: 'center' }}>+</ThemedText>
                        </Pressable>
                      </View>

                      {/* Details */}
                      <View style={styles.productDetailsContainer}>
                        <ThemedText type="smallBold" style={styles.productPriceText}>
                          ₡{Math.round(prod.precio).toLocaleString('es-CR')}
                        </ThemedText>
                        <ThemedText type="smallBold" numberOfLines={2} style={styles.productTitleText}>
                          {prod.nombre}
                        </ThemedText>
                        <ThemedText style={[
                          styles.productStockText,
                          { color: prod.stock > 0 ? '#888' : '#ff4444' }
                        ]}>
                          {prod.stock > 0 ? `${prod.stock} disponibles` : 'Agotado'}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  ))
                )}
              </View>
            </View>
          </ScrollView>
        </ImageBackground>

        {/* MODAL DE DETALLE Y COMPRA */}
        <Modal
          visible={clientSelectedProduct !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setClientSelectedProduct(null)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Confirmar Compra
              </ThemedText>

              {clientSelectedProduct && (
                <View style={{ gap: Spacing.three, marginVertical: Spacing.two }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 80, height: 80, backgroundColor: '#ffffff', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.two }}>
                      <Image source={getProductImage(clientSelectedProduct.nombre)} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                    </View>
                    <View style={{ height: 4 }} />
                    <ThemedText type="smallBold" style={{ fontSize: 18, textAlign: 'center' }}>
                      {clientSelectedProduct.nombre}
                    </ThemedText>
                     <ThemedText themeColor="textSecondary" style={{ marginTop: 2 }}>
                       Precio unitario: ₡{Math.round(clientSelectedProduct.precio).toLocaleString('es-CR')}
                     </ThemedText>
                  </View>

                  {/* Selector de cantidad */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three, marginTop: Spacing.two }}>
                    <Pressable
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }}
                      onPress={() => {
                        const val = parseInt(clientQuantity) - 1;
                        if (val >= 1) setClientQuantity(val.toString());
                      }}
                    >
                      <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>-</ThemedText>
                    </Pressable>

                    <TextInput
                      style={{ width: 60, height: 40, backgroundColor: '#222', color: '#fff', textAlign: 'center', borderRadius: 6, fontSize: 16 }}
                      keyboardType="number-pad"
                      value={clientQuantity}
                      onChangeText={(text) => {
                        const val = parseInt(text);
                        if (!isNaN(val) && val >= 1 && val <= clientSelectedProduct.stock) {
                          setClientQuantity(text);
                        } else if (!text) {
                          setClientQuantity('');
                        }
                      }}
                    />

                    <Pressable
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }}
                      onPress={() => {
                        const val = parseInt(clientQuantity) + 1;
                        if (val <= clientSelectedProduct.stock) setClientQuantity(val.toString());
                      }}
                    >
                      <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>+</ThemedText>
                    </Pressable>
                  </View>

                  {/* Total */}
                  <View style={{ borderTopWidth: 1, borderColor: '#333', paddingTop: Spacing.two, marginTop: Spacing.one, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText themeColor="textSecondary">Total a pagar:</ThemedText>
                    <ThemedText type="smallBold" style={{ fontSize: 20, color: '#4caf50' }}>
                      ₡{Math.round(clientSelectedProduct.precio * (parseInt(clientQuantity) || 1)).toLocaleString('es-CR')}
                    </ThemedText>
                  </View>
                </View>
              )}

              {clientPaying ? (
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
                      {/* PayPal option (default or fallback) */}
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
                          opacity: pressed || clientPaying ? 0.8 : 1,
                          flexDirection: 'row',
                          gap: 8
                        }
                      ]}
                      onPress={handleClientBuyProduct}
                      disabled={clientPaying}
                    >
                      {clientPaying ? (
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
                          opacity: pressed || clientPaying ? 0.8 : 1,
                        }
                      ]}
                      onPress={handleCardProductPayment}
                      disabled={clientPaying}
                    >
                      {clientPaying ? (
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
                    onPress={() => setClientSelectedProduct(null)}
                    disabled={clientPaying}
                  >
                    <ThemedText style={{ color: '#aaa', textAlign: 'center' }}>Cancelar</ThemedText>
                  </Pressable>
                </View>
              )}
            </ThemedView>
          </View>
        </Modal>

        {/* MODAL DE ÉXITO DE COMPRA CLIENTE */}
        <Modal
          visible={clientSuccessSaleId !== null}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setClientSuccessSaleId(null)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText style={{ fontSize: 50, textAlign: 'center' }}>🎉</ThemedText>
              <ThemedText type="subtitle" style={{ textAlign: 'center', color: '#4caf50', fontWeight: '700' }}>
                ¡Compra Exitosa!
              </ThemedText>
              <ThemedText style={{ textAlign: 'center', marginVertical: Spacing.two }} themeColor="textSecondary">
                Tu pago se completó con éxito. Hemos enviado el comprobante PDF a tu correo electrónico.
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
                  onPress={() => setClientSuccessSaleId(null)}
                >
                  <ThemedText style={{ color: '#aaa', textAlign: 'center' }}>Entendido</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </Modal>
      </View>
    );
  }

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

  // Filter clients list for dropdown search
  const filteredClients = clients.filter(c => 
    c.nombre.toLowerCase().includes(searchClientQuery.toLowerCase())
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
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <ThemedText type="subtitle" style={styles.title}>
                Shark Store
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Punto de Venta e Inventario
              </ThemedText>
            </View>

            {/* Navigation Tabs */}
            <View style={styles.tabToggleContainer}>
              <Pressable
                style={[styles.tabToggleButton, activeTab === 'pos' && styles.tabToggleButtonActive]}
                onPress={() => {
                  setActiveTab('pos');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                <ThemedText style={[styles.tabToggleText, activeTab === 'pos' && styles.tabToggleTextActive]}>
                  Registrar Venta (POS)
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.tabToggleButton, activeTab === 'inventory' && styles.tabToggleButtonActive]}
                onPress={() => {
                  setActiveTab('inventory');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                <ThemedText style={[styles.tabToggleText, activeTab === 'inventory' && styles.tabToggleTextActive]}>
                  Inventario y Planes
                </ThemedText>
              </Pressable>
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

            {loading && (
              <ActivityIndicator size="large" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
            )}

            {/* POS VIEW */}
            {activeTab === 'pos' && !loading && (
              <View style={styles.formContainer}>
                {/* 1. Seleccionar Cliente */}
                <ThemedView type="backgroundElement" style={styles.formCard}>
                  <ThemedText type="smallBold" style={styles.formCardTitle}>
                    1. Seleccionar Cliente
                  </ThemedText>
                  
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="Escribe para buscar cliente..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchClientQuery}
                    onChangeText={(text) => {
                      setSearchClientQuery(text);
                      if (selectedClient && !text) setSelectedClient(null);
                    }}
                  />

                  {searchClientQuery && !selectedClient && (
                    <View style={styles.dropdownList}>
                      {filteredClients.slice(0, 4).map(c => (
                        <Pressable
                          key={c.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedClient(c);
                            setSearchClientQuery(c.nombre);
                          }}
                        >
                          <ThemedText style={{ color: '#fff' }}>{c.nombre} ({c.email})</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {selectedClient && (
                    <View style={styles.selectionInfo}>
                      <ThemedText style={styles.selectionText}>
                        Cliente Seleccionado: <ThemedText style={{ color: '#3c87f7', fontWeight: 'bold' }}>{selectedClient.nombre}</ThemedText>
                      </ThemedText>
                    </View>
                  )}
                </ThemedView>

                {/* 2. Seleccionar Tipo de Venta */}
                <ThemedView type="backgroundElement" style={styles.formCard}>
                  <ThemedText type="smallBold" style={styles.formCardTitle}>
                    2. Tipo de Compra
                  </ThemedText>
                  <View style={styles.typeSelector}>
                    <Pressable
                      style={[styles.typeButton, posType === 'producto' && styles.typeButtonActive]}
                      onPress={() => setPosType('producto')}
                    >
                      <ThemedText style={[styles.typeButtonText, posType === 'producto' && styles.typeButtonTextActive]}>
                        Suplemento / Bebida
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={[styles.typeButton, posType === 'membresia' && styles.typeButtonActive]}
                      onPress={() => setPosType('membresia')}
                    >
                      <ThemedText style={[styles.typeButtonText, posType === 'membresia' && styles.typeButtonTextActive]}>
                        Membresía
                      </ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>

                {/* 3. Selección y Pago */}
                <ThemedView type="backgroundElement" style={styles.formCard}>
                  <ThemedText type="smallBold" style={styles.formCardTitle}>
                    3. Detalles y Registro
                  </ThemedText>

                  {posType === 'producto' ? (
                    /* PRODUCT SALE DETAILS */
                    <View style={{ gap: Spacing.two }}>
                      <ThemedText type="small" themeColor="textSecondary">Producto:</ThemedText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {products.map(p => (
                          <Pressable
                            key={p.id}
                            style={[
                              styles.scrollCard,
                              selectedProduct?.id === p.id && styles.scrollCardActive,
                              { borderColor: selectedProduct?.id === p.id ? '#3c87f7' : theme.backgroundSelected }
                            ]}
                            onPress={() => setSelectedProduct(p)}
                          >
                            <ThemedText style={styles.scrollCardName}>{p.nombre}</ThemedText>
                            <ThemedText style={styles.scrollCardPrice}>₡{Math.round(p.precio).toLocaleString('es-CR')}</ThemedText>
                            <ThemedText style={styles.scrollCardStock}>Stock: {p.stock}</ThemedText>
                          </Pressable>
                        ))}
                      </ScrollView>

                      <View style={{ marginTop: Spacing.one }}>
                        <ThemedText type="small" themeColor="textSecondary">Cantidad:</ThemedText>
                        <TextInput
                          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, marginTop: 4 }]}
                          keyboardType="numeric"
                          value={productQuantity}
                          onChangeText={setProductQuantity}
                        />
                      </View>
                    </View>
                  ) : (
                    /* MEMBERSHIP SALE DETAILS */
                    <View style={{ gap: Spacing.two }}>
                      <ThemedText type="small" themeColor="textSecondary">Plan de Membresía:</ThemedText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {memberships.map(m => (
                          <Pressable
                            key={m.id}
                            style={[
                              styles.scrollCard,
                              selectedMembership?.id === m.id && styles.scrollCardActive,
                              { borderColor: selectedMembership?.id === m.id ? '#ff9800' : theme.backgroundSelected }
                            ]}
                            onPress={() => setSelectedMembership(m)}
                          >
                            <ThemedText style={styles.scrollCardName}>{m.nombre}</ThemedText>
                            <ThemedText style={styles.scrollCardPrice}>₡{Math.round(m.precio).toLocaleString('es-CR')}</ThemedText>
                            <ThemedText style={styles.scrollCardStock}>{m.duracion_dias} días</ThemedText>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* total and submit */}
                  <View style={styles.posFooter}>
                    <View>
                      <ThemedText type="small" themeColor="textSecondary">Total a pagar:</ThemedText>
                      <ThemedText style={styles.posTotal}>
                        ₡{posType === 'producto' 
                          ? Math.round(Number(selectedProduct?.precio || 0) * (parseInt(productQuantity) || 1)).toLocaleString('es-CR')
                          : Math.round(Number(selectedMembership?.precio || 0)).toLocaleString('es-CR')
                        }
                      </ThemedText>
                    </View>
                    <Pressable style={styles.posSubmitButton} onPress={handleRegisterSale}>
                      <ThemedText style={styles.posSubmitText}>Completar Venta</ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              </View>
            )}

            {/* INVENTORY & PLANS VIEW */}
            {activeTab === 'inventory' && !loading && (
              <View style={styles.formContainer}>
                {/* Switch sub-editor */}
                <View style={styles.typeSelector}>
                  <Pressable
                    style={[styles.typeButton, invType === 'products' && styles.typeButtonActive]}
                    onPress={() => setInvType('products')}
                  >
                    <ThemedText style={[styles.typeButtonText, invType === 'products' && styles.typeButtonTextActive]}>
                      Productos
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.typeButton, invType === 'memberships' && styles.typeButtonActive]}
                    onPress={() => setInvType('memberships')}
                  >
                    <ThemedText style={[styles.typeButtonText, invType === 'memberships' && styles.typeButtonTextActive]}>
                      Planes (Membresías)
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Add New Button */}
                <Pressable style={styles.createBtn} onPress={openCreateEditor}>
                  <ThemedText style={styles.createBtnText}>
                    + Registrar {invType === 'products' ? 'Producto' : 'Plan de Membresía'}
                  </ThemedText>
                </Pressable>

                {/* Listing */}
                <View style={styles.listGrid}>
                  {invType === 'products' ? (
                    products.map(p => (
                      <ThemedView key={p.id} type="backgroundElement" style={styles.listItemCard}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <ThemedText type="smallBold" style={{ fontSize: 16 }}>{p.nombre}</ThemedText>
                          <ThemedText style={{ color: '#3c87f7', fontWeight: 'bold' }}>₡{Math.round(p.precio).toLocaleString('es-CR')}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">Stock actual: {p.stock} unidades</ThemedText>
                        </View>
                        <View style={styles.listItemActions}>
                          <Pressable style={styles.actionBtnEdit} onPress={() => openEditProductEditor(p)}>
                            <ThemedText style={{ color: '#3c87f7', fontSize: 12 }}>Editar</ThemedText>
                          </Pressable>
                          <Pressable style={styles.actionBtnDelete} onPress={() => handleDeleteProduct(p.id)}>
                            <ThemedText style={{ color: '#ff4444', fontSize: 12 }}>Borrar</ThemedText>
                          </Pressable>
                        </View>
                      </ThemedView>
                    ))
                  ) : (
                    memberships.map(m => (
                      <ThemedView key={m.id} type="backgroundElement" style={styles.listItemCard}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <ThemedText type="smallBold" style={{ fontSize: 16 }}>{m.nombre}</ThemedText>
                          <ThemedText style={{ color: '#ff9800', fontWeight: 'bold' }}>₡{Math.round(m.precio).toLocaleString('es-CR')}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">Duración: {m.duracion_dias} días</ThemedText>
                        </View>
                      </ThemedView>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </ImageBackground>

      {/* CREATION/EDIT MODAL DIALOG */}
      {editorVisible && (
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {editingItem ? 'Editar Producto' : `Nuevo ${invType === 'products' ? 'Producto' : 'Plan'}`}
            </ThemedText>

            <View style={{ gap: Spacing.two }}>
              <View style={styles.modalInputGroup}>
                <ThemedText type="smallBold" themeColor="textSecondary">Nombre completo</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.modalInputGroup}>
                <ThemedText type="smallBold" themeColor="textSecondary">Precio (₡)</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={formPrice}
                  keyboardType="numeric"
                  onChangeText={setFormPrice}
                />
              </View>

              {invType === 'products' ? (
                <View style={styles.modalInputGroup}>
                  <ThemedText type="smallBold" themeColor="textSecondary">Stock inicial / actual</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    value={formStock}
                    keyboardType="numeric"
                    onChangeText={setFormStock}
                  />
                </View>
              ) : (
                <View style={styles.modalInputGroup}>
                  <ThemedText type="smallBold" themeColor="textSecondary">Duración en días</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    value={formDays}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={theme.textSecondary}
                    onChangeText={setFormDays}
                  />
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnCancel} onPress={() => setEditorVisible(false)}>
                <ThemedText style={{ color: '#aaa', fontWeight: '600' }}>Cancelar</ThemedText>
              </Pressable>
              <Pressable style={styles.modalBtnSave} onPress={handleSaveInventoryItem}>
                <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Guardar</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      )}
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
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  deniedCard: {
    padding: Spacing.five,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 400,
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#442222',
  },
  deniedIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ff4444',
    textAlign: 'center',
  },
  deniedMessage: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 22,
  },
  tabToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Spacing.two,
    padding: 4,
  },
  tabToggleButton: {
    flex: 1,
    paddingVertical: 12,
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
  formContainer: {
    gap: Spacing.three,
  },
  formCard: {
    padding: Spacing.four,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  formCardTitle: {
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
  selectionInfo: {
    marginTop: Spacing.one,
    padding: Spacing.two,
    backgroundColor: 'rgba(60, 135, 247, 0.1)',
    borderRadius: Spacing.one,
  },
  selectionText: {
    fontSize: 14,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  typeButton: {
    flex: 1,
    height: 44,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  typeButtonActive: {
    borderColor: '#3c87f7',
    backgroundColor: 'rgba(60, 135, 247, 0.15)',
  },
  typeButtonText: {
    color: '#888888',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#3c87f7',
  },
  horizontalScroll: {
    flexDirection: 'row',
    paddingVertical: Spacing.one,
  },
  scrollCard: {
    width: 120,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginRight: Spacing.two,
    gap: 4,
  },
  scrollCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  scrollCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  scrollCardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3c87f7',
  },
  scrollCardStock: {
    fontSize: 11,
    color: '#888',
  },
  posFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  posTotal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2e7d32',
  },
  posSubmitButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Spacing.two,
  },
  posSubmitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  createBtn: {
    height: 48,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listGrid: {
    gap: Spacing.two,
  },
  listItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  listItemActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtnEdit: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3c87f7',
    backgroundColor: 'rgba(60, 135, 247, 0.05)',
  },
  actionBtnDelete: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ff4444',
    backgroundColor: 'rgba(255, 68, 68, 0.05)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalInputGroup: {
    gap: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Spacing.one,
    borderWidth: 1,
    borderColor: '#555',
  },
  modalBtnSave: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Spacing.one,
    backgroundColor: '#3c87f7',
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
  productCardGrid: {
    width: '47.5%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
  },
  productImageContainer: {
    height: 130,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productImage: {
    width: '75%',
    height: '75%',
  },
  productAddBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  productDetailsContainer: {
    padding: 10,
    gap: 3,
  },
  productPriceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4caf50',
  },
  productTitleText: {
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 16,
    height: 32,
  },
  productStockText: {
    fontSize: 10,
    marginTop: 2,
  },
});
