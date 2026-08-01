import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  ImageBackground,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  telefono: string;
  rol?: number;
  role?: 'admin' | 'user';
}

export default function UserManagementScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRol, setFormRol] = useState<number>(1); // Default to Rol 1 (Normal)

  // Delete Confirm Modal States
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Routines Modal States
  const [routinesModalVisible, setRoutinesModalVisible] = useState(false);
  const [selectedRoutineUser, setSelectedRoutineUser] = useState<User | null>(null);
  const [userRoutines, setUserRoutines] = useState<any[]>([]);
  const [routinesLoading, setRoutinesLoading] = useState(false);
  const [routineModalError, setRoutineModalError] = useState<string | null>(null);
  const [formRoutineNombre, setFormRoutineNombre] = useState('');
  const [formRoutineDescripcion, setFormRoutineDescripcion] = useState('');
  const [routineActionLoading, setRoutineActionLoading] = useState(false);

  const fetchUsers = async (search = '') => {
    try {
      setError(null);
      const response = await api.get('/users', {
        params: search ? { search } : {},
      });
      if (response.data && response.data.success) {
        setUsers(response.data.data);
      } else {
        setError('Error al obtener la lista de usuarios');
      }
    } catch (err: any) {
      console.error('Fetch users error:', err);
      setError(err.response?.data?.message || err.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers(searchQuery);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setLoading(true);
    fetchUsers(text);
  };

  // Open modal for creating new user
  const openCreateModal = () => {
    setEditingUser(null);
    setFormNombre('');
    setFormEmail('');
    setFormTelefono('');
    setFormPassword('');
    setFormRol(1); // Default is Usuario Normal
    setModalError(null);
    setModalVisible(true);
  };

  // Open modal for editing existing user
  const openEditModal = (userItem: User) => {
    setEditingUser(userItem);
    setFormNombre(userItem.nombre);
    setFormEmail(userItem.email);
    setFormTelefono(userItem.telefono);
    setFormRol(userItem.rol !== undefined ? userItem.rol : (userItem.role === 'admin' ? 2 : 1));
    setFormPassword('');
    setModalError(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingUser(null);
  };

  // Submit Create or Edit form
  const handleSubmit = async () => {
    if (!formNombre.trim() || !formEmail.trim() || !formTelefono.trim()) {
      setModalError('Por favor, completa nombre, email y teléfono.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const payload: any = {
        nombre: formNombre.trim(),
        email: formEmail.trim(),
        telefono: formTelefono.trim(),
        rol: formRol,
      };

      if (!editingUser && formPassword.trim()) {
        payload.password = formPassword;
      }

      let response;
      if (editingUser) {
        // Update user
        response = await api.put(`/users/${editingUser.id}`, payload);
      } else {
        // Create user
        response = await api.post('/users', payload);
      }

      if (response.data && response.data.success) {
        closeModal();
        fetchUsers(searchQuery); // Refresh list
      } else {
        setModalError(response.data?.message || 'Error al guardar los datos del usuario.');
      }
    } catch (err: any) {
      console.error('Submit user error:', err);
      let errorMsg = 'Error de conexión con el servidor';
      if (err.response?.data) {
        const data = err.response.data;
        if (data.message) {
          errorMsg = data.message;
        }
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          errorMsg += `: ${data.errors.map((e: any) => e.msg).join(', ')}`;
        }
      } else {
        errorMsg = err.message || errorMsg;
      }
      setModalError(errorMsg);
    } finally {
      setModalLoading(false);
    }
  };

  // Open confirmation for deleting a user
  const openDeleteConfirm = (userItem: User) => {
    setDeletingUser(userItem);
    setDeleteConfirmVisible(true);
  };

  // Confirm and call API to delete user
  const confirmDelete = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      const response = await api.delete(`/users/${deletingUser.id}`);
      if (response.data && response.data.success) {
        setDeleteConfirmVisible(false);
        setDeletingUser(null);
        fetchUsers(searchQuery); // Refresh list
      } else {
        setError(response.data?.message || 'Error al eliminar el usuario.');
        setDeleteConfirmVisible(false);
      }
    } catch (err: any) {
      console.error('Delete user error:', err);
      setError(err.response?.data?.message || err.message || 'Error de conexión con el servidor');
      setDeleteConfirmVisible(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchUserRoutines = async (userId: number) => {
    setRoutinesLoading(true);
    setRoutineModalError(null);
    try {
      const response = await api.get(`/routines/user/${userId}`);
      if (response.data && response.data.success) {
        setUserRoutines(response.data.data || []);
      } else {
        setRoutineModalError('Error al cargar las rutinas');
      }
    } catch (err: any) {
      console.error('Error fetching user routines:', err);
      setRoutineModalError(err.response?.data?.message || 'Error de conexión al cargar rutinas');
    } finally {
      setRoutinesLoading(false);
    }
  };

  const openRoutinesModal = (userItem: User) => {
    setSelectedRoutineUser(userItem);
    setUserRoutines([]);
    setFormRoutineNombre('');
    setFormRoutineDescripcion('');
    setRoutineModalError(null);
    setRoutinesModalVisible(true);
    fetchUserRoutines(userItem.id);
  };

  const handleCreateRoutine = async () => {
    if (!selectedRoutineUser) return;
    if (!formRoutineNombre.trim() || !formRoutineDescripcion.trim()) {
      setRoutineModalError('Por favor completa el nombre y descripción de la rutina');
      return;
    }

    setRoutineActionLoading(true);
    setRoutineModalError(null);
    try {
      const response = await api.post('/routines', {
        usuario_id: selectedRoutineUser.id,
        nombre: formRoutineNombre.trim(),
        descripcion: formRoutineDescripcion.trim(),
      });
      if (response.data && response.data.success) {
        setFormRoutineNombre('');
        setFormRoutineDescripcion('');
        fetchUserRoutines(selectedRoutineUser.id);
      } else {
        setRoutineModalError(response.data?.message || 'Error al asignar rutina');
      }
    } catch (err: any) {
      console.error('Error creating routine:', err);
      setRoutineModalError(err.response?.data?.message || 'Error de conexión al asignar rutina');
    } finally {
      setRoutineActionLoading(false);
    }
  };

  const handleDeleteRoutine = async (routineId: number) => {
    if (!selectedRoutineUser) return;
    setRoutineActionLoading(true);
    setRoutineModalError(null);
    try {
      const response = await api.delete(`/routines/${routineId}`);
      if (response.data && response.data.success) {
        fetchUserRoutines(selectedRoutineUser.id);
      } else {
        setRoutineModalError(response.data?.message || 'Error al eliminar rutina');
      }
    } catch (err: any) {
      console.error('Error deleting routine:', err);
      setRoutineModalError(err.response?.data?.message || 'Error de conexión al eliminar rutina');
    } finally {
      setRoutineActionLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
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

  if (!isAdmin) {
    return (
      <View style={styles.containerRoot}>
        <ImageBackground
          source={require('@/assets/images/background-shark.jpg')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', flex: 1, padding: Spacing.four, alignSelf: 'center' }]}>
            <ThemedView type="backgroundElement" style={styles.deniedCard}>
              <ThemedText style={styles.deniedIcon}>🔒</ThemedText>
              <ThemedText type="subtitle" style={styles.deniedTitle}>Acceso Denegado</ThemedText>
              <ThemedText style={styles.deniedMessage}>
                Esta sección es exclusiva para administradores. No tienes permisos para ver el listado de usuarios.
              </ThemedText>
            </ThemedView>
          </View>
        </ImageBackground>
      </View>
    );
  }

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
                Shark Users
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Gestión de Usuarios
              </ThemedText>
            </View>

            {/* Create User Button (Admin only) */}
            {isAdmin && (
              <Pressable 
                style={[
                  styles.createBtn, 
                  { backgroundColor: '#3c87f7' }
                ]} 
                onPress={openCreateModal}
              >
                <ThemedText style={styles.createBtnText}>+ Nuevo Usuario</ThemedText>
              </Pressable>
            )}

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}
                placeholder="Buscar usuarios por nombre..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}

            {/* Loading Spinner */}
            {loading && !refreshing ? (
              <ActivityIndicator size="large" color="#3c87f7" style={styles.loader} />
            ) : (
              <View style={styles.listContainer}>
                {users.length === 0 ? (
                  <ThemedText style={styles.emptyText} themeColor="textSecondary">
                    No se encontraron usuarios.
                  </ThemedText>
                ) : (
                  users.map((userItem) => (
                    <ThemedView
                      key={userItem.id}
                      type="backgroundElement"
                      style={styles.userCard}
                    >
                      {/* Circle Initial Avatar */}
                      <View style={[styles.avatar, { backgroundColor: '#3c87f7' }]}>
                        <ThemedText style={styles.avatarText}>
                          {getInitials(userItem.nombre)}
                        </ThemedText>
                      </View>

                      {/* User details */}
                      <View style={styles.detailsContainer}>
                        <View style={styles.nameRow}>
                          <ThemedText type="smallBold" style={styles.userName}>
                            {userItem.nombre}
                          </ThemedText>
                          <View style={[
                            styles.roleTag,
                            { backgroundColor: (userItem.rol === 2 || userItem.role === 'admin') ? 'rgba(255, 152, 0, 0.2)' : 'rgba(60, 135, 247, 0.2)' }
                          ]}>
                            <ThemedText style={[
                              styles.roleTagText,
                              { color: (userItem.rol === 2 || userItem.role === 'admin') ? '#ff9800' : '#3c87f7' }
                            ]}>
                              {(userItem.rol === 2 || userItem.role === 'admin') ? 'Admin' : 'Normal'}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {userItem.email}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {userItem.telefono}
                        </ThemedText>
                      </View>

                      {/* Admin controls */}
                      {isAdmin && (
                        <View style={styles.actionsContainer}>
                          <Pressable 
                            style={[styles.actionBtn, styles.editBtn]} 
                            onPress={() => openEditModal(userItem)}
                          >
                            <ThemedText style={styles.editBtnText}>Editar</ThemedText>
                          </Pressable>
                          {userItem.role !== 'admin' && userItem.rol !== 2 && (
                            <Pressable 
                              style={[styles.actionBtn, styles.routineBtn]} 
                              onPress={() => openRoutinesModal(userItem)}
                            >
                              <ThemedText style={styles.routineBtnText}>Rutinas</ThemedText>
                            </Pressable>
                          )}
                          <Pressable 
                            style={[styles.actionBtn, styles.deleteBtn]} 
                            onPress={() => openDeleteConfirm(userItem)}
                          >
                            <ThemedText style={styles.deleteBtnText}>Borrar</ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </ThemedView>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </ImageBackground>

      {/* ROUTINES MANAGEMENT MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={routinesModalVisible}
        onRequestClose={() => setRoutinesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={[styles.modalContent, { maxHeight: '90%', padding: Spacing.four }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)', paddingBottom: Spacing.two }}>
              <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: '700', color: theme.text, flex: 1 }}>
                Rutinas: {selectedRoutineUser?.nombre}
              </ThemedText>
              <Pressable onPress={() => setRoutinesModalVisible(false)} style={{ padding: 6 }}>
                <ThemedText style={{ color: '#aaa', fontSize: 18 }}>✕</ThemedText>
              </Pressable>
            </View>

            {routineModalError && (
              <View style={[styles.modalErrorBanner, { marginBottom: Spacing.two }]}>
                <ThemedText style={styles.modalErrorText}>{routineModalError}</ThemedText>
              </View>
            )}

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
            >
              {/* SECTION: RUTINAS ASIGNADAS */}
              <View style={{ marginBottom: Spacing.three }}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.two, fontSize: 13 }}>
                  Rutinas Asignadas:
                </ThemedText>

                {routinesLoading ? (
                  <ActivityIndicator size="small" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
                ) : userRoutines.length === 0 ? (
                  <View style={{ padding: Spacing.three, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, alignItems: 'center' }}>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic', textAlign: 'center' }}>
                      Este cliente no tiene rutinas asignadas.
                    </ThemedText>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.two }}>
                    {userRoutines.map((routine) => (
                      <View 
                        key={routine.id} 
                        style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          padding: Spacing.two, 
                          backgroundColor: 'rgba(255,255,255,0.03)', 
                          borderRadius: 8, 
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.06)',
                          justifyContent: 'space-between' 
                        }}
                      >
                        <View style={{ flex: 1, marginRight: Spacing.two }}>
                          <ThemedText type="smallBold" style={{ fontSize: 14, color: theme.text }}>
                            {routine.nombre}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4, fontSize: 12 }}>
                            {routine.descripcion}
                          </ThemedText>
                        </View>
                        <Pressable 
                          style={{ padding: 8, backgroundColor: 'rgba(255,68,68,0.1)', borderRadius: 6 }}
                          onPress={() => handleDeleteRoutine(routine.id)}
                          disabled={routineActionLoading}
                        >
                          <ThemedText style={{ color: '#ff4444', fontSize: 14 }}>🗑️</ThemedText>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginVertical: Spacing.two }} />

              {/* SECTION: ASIGNAR NUEVA RUTINA */}
              <View style={{ gap: Spacing.two, marginTop: Spacing.one }}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 13 }}>
                  Asignar Nueva Rutina:
                </ThemedText>
                
                <View style={styles.modalInputGroup}>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: 'rgba(0,0,0,0.2)' }]}
                    value={formRoutineNombre}
                    onChangeText={setFormRoutineNombre}
                    placeholder="Nombre del día (ej: Pectoral / Tríceps)"
                    placeholderTextColor={theme.textSecondary}
                    editable={!routineActionLoading}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <TextInput
                    style={[
                      styles.modalInput, 
                      { 
                        color: theme.text, 
                        borderColor: theme.backgroundSelected, 
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        height: 90,
                        textAlignVertical: 'top',
                        paddingTop: Spacing.two
                      }
                    ]}
                    value={formRoutineDescripcion}
                    onChangeText={setFormRoutineDescripcion}
                    placeholder="Ejercicios, series, repeticiones..."
                    placeholderTextColor={theme.textSecondary}
                    multiline={true}
                    numberOfLines={4}
                    editable={!routineActionLoading}
                  />
                </View>

                <Pressable
                  style={[
                    styles.actionButton,
                    styles.saveButton,
                    { marginTop: Spacing.one, opacity: routineActionLoading ? 0.7 : 1, height: 44 }
                  ]}
                  onPress={handleCreateRoutine}
                  disabled={routineActionLoading}
                >
                  {routineActionLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <ThemedText style={styles.saveButtonText}>Asignar Rutina</ThemedText>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* CREATE & EDIT DIALOG MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </ThemedText>
            
            {modalError && (
              <View style={styles.modalErrorBanner}>
                <ThemedText style={styles.modalErrorText}>{modalError}</ThemedText>
              </View>
            )}
            
            <View style={styles.modalForm}>
              {/* Nombre */}
              <View style={styles.modalInputGroup}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.modalLabel}>
                  Nombre completo
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={formNombre}
                  onChangeText={setFormNombre}
                  placeholder="Nombre"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              {/* Email */}
              <View style={styles.modalInputGroup}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.modalLabel}>
                  Correo electrónico
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={formEmail}
                  onChangeText={setFormEmail}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Teléfono */}
              <View style={styles.modalInputGroup}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.modalLabel}>
                  Teléfono
                </ThemedText>
                <TextInput
                  style={[styles.modalInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={formTelefono}
                  onChangeText={setFormTelefono}
                  placeholder="+52 55 1234 5678"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Selector de Rol */}
              <View style={styles.modalInputGroup}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.modalLabel}>
                  Rol de Usuario
                </ThemedText>
                <View style={styles.roleSelectorContainer}>
                  <Pressable
                    style={[
                      styles.roleOption,
                      formRol === 1 && styles.roleOptionSelected,
                      { borderColor: formRol === 1 ? '#3c87f7' : theme.backgroundSelected }
                    ]}
                    onPress={() => setFormRol(1)}
                  >
                    <ThemedText style={[styles.roleOptionText, formRol === 1 && styles.roleOptionTextSelected]}>
                      Usuario Normal
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.roleOption,
                      formRol === 2 && styles.roleOptionSelected,
                      { borderColor: formRol === 2 ? '#ff9800' : theme.backgroundSelected }
                    ]}
                    onPress={() => setFormRol(2)}
                  >
                    <ThemedText style={[styles.roleOptionText, formRol === 2 && { color: '#ff9800' }]}>
                      Administrador
                    </ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Password (only if creating) */}
              {!editingUser && (
                <View style={styles.modalInputGroup}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.modalLabel}>
                    Contraseña (Opcional)
                  </ThemedText>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    value={formPassword}
                    onChangeText={setFormPassword}
                    placeholder="Password123! (por defecto)"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.modalButtonCancel]} onPress={closeModal}>
                <ThemedText style={styles.modalButtonCancelText}>Cancelar</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonSubmit]} onPress={handleSubmit}>
                {modalLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <ThemedText style={styles.modalButtonSubmitText}>Guardar</ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* DELETE CONFIRM DIALOG MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteConfirmVisible}
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.confirmContent}>
            <ThemedText type="subtitle" style={styles.confirmTitle}>
              ¿Eliminar Usuario?
            </ThemedText>
            <ThemedText style={styles.confirmMessage}>
              ¿Estás seguro de que deseas eliminar a {deletingUser?.nombre}? Esta acción no se puede deshacer.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonCancel]} 
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <ThemedText style={styles.modalButtonCancelText}>Cancelar</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonDelete]} 
                onPress={confirmDelete}
              >
                {deleteLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <ThemedText style={styles.modalButtonDeleteText}>Eliminar</ThemedText>
                )}
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
  createBtn: {
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.one,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: Spacing.two,
  },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  errorBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#FFEDED',
    borderWidth: 1,
    borderColor: '#FFA1A1',
    marginBottom: Spacing.three,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },
  loader: {
    marginTop: Spacing.six,
  },
  listContainer: {
    gap: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.five,
    fontSize: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  detailsContainer: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: Spacing.one,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  actionBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  editBtn: {
    borderColor: '#3c87f7',
    backgroundColor: 'rgba(60, 135, 247, 0.1)',
  },
  editBtnText: {
    color: '#3c87f7',
    fontSize: 12,
    fontWeight: '600',
  },
  routineBtn: {
    borderColor: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  routineBtnText: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    borderColor: '#ff4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  deleteBtnText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '600',
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
    maxWidth: 450,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#333333',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  modalForm: {
    gap: Spacing.two,
  },
  modalInputGroup: {
    gap: Spacing.one,
  },
  modalLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  modalInput: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  roleSelectorContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  roleOption: {
    flex: 1,
    height: 44,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  roleOptionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '600',
  },
  roleOptionTextSelected: {
    color: '#3c87f7',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#555555',
  },
  modalButtonCancelText: {
    color: '#aaaaaa',
    fontWeight: '600',
  },
  modalButtonSubmit: {
    backgroundColor: '#3c87f7',
  },
  modalButtonSubmitText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalButtonDelete: {
    backgroundColor: '#ff4444',
  },
  modalButtonDeleteText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalErrorBanner: {
    padding: Spacing.two,
    borderRadius: Spacing.one,
    backgroundColor: '#FFEDED',
    borderWidth: 1,
    borderColor: '#FFA1A1',
  },
  modalErrorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  confirmContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#442222',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ff4444',
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    color: '#dddddd',
    textAlign: 'center',
    lineHeight: 22,
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
});
