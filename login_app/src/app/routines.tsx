import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  TextInput,
  Pressable,
  ImageBackground,
  Modal,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import exercisesDataset from '@/constants/exercises_dataset.json';

interface CustomRoutine {
  id: string;
  nombre: string;
  descripcion: string;
  ejercicios: string[];
  fecha_creacion: string;
}

interface Routine {
  id: number;
  usuario_id: number;
  nombre: string;
  descripcion: string;
  fecha_creacion: string;
}

interface User {
  id: number;
  nombre: string;
  email: string;
}

export default function RoutinesScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isCoach = currentUser?.role === 'coach';

  const [loading, setLoading] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Admin Search & Select Client States
  const [clients, setClients] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<User | null>(null);

  // Add Routine Form States
  const [editorVisible, setEditorVisible] = useState(false);
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineDesc, setRoutineDesc] = useState('');

  // Expandable Card state (Client View)
  const [expandedRoutineId, setExpandedRoutineId] = useState<number | null>(null);

  // --- CLIENT CUSTOM ROUTINES STATES ---
  const [clientTab, setClientTab] = useState<'coach' | 'custom' | 'assign'>('coach');
  const [customRoutines, setCustomRoutines] = useState<CustomRoutine[]>([]);
  const [creatorVisible, setCreatorVisible] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [editingCustomRoutineId, setEditingCustomRoutineId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState('Todos');
  const [expandedCustomId, setExpandedCustomId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Workout Player States
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playerRoutine, setPlayerRoutine] = useState<CustomRoutine | null>(null);
  const [playerCurrentIndex, setPlayerCurrentIndex] = useState(0);
  const [workoutCompletedVisible, setWorkoutCompletedVisible] = useState(false);

  const getCustomRoutinesKey = () => `custom_routines_user_${currentUser?.id || 0}`;

  const loadCustomRoutines = async () => {
    try {
      const key = getCustomRoutinesKey();
      const val = await SecureStore.getItemAsync(key);
      if (val) {
        setCustomRoutines(JSON.parse(val));
      } else {
        setCustomRoutines([]);
      }
    } catch (err) {
      console.error('Error loading custom routines:', err);
    }
  };

  const saveCustomRoutines = async (newRoutines: CustomRoutine[]) => {
    try {
      const key = getCustomRoutinesKey();
      await SecureStore.setItemAsync(key, JSON.stringify(newRoutines));
      setCustomRoutines(newRoutines);
    } catch (err) {
      console.error('Error saving custom routines:', err);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (isAdmin || isCoach) {
        // Cargar lista de clientes
        const response = await api.get('/users');
        if (response.data && response.data.success) {
          setClients(response.data.data);
        }
      }
      
      if (!isAdmin) {
        // Cargar rutinas de este cliente (coaches y clientes normales)
        const response = await api.get('/routines/my-routines');
        if (response.data && response.data.success) {
          setRoutines(response.data.data);
        }
        await loadCustomRoutines();
      }
    } catch (err: any) {
      console.error('Error loading routines screen data:', err);
      setErrorMessage(err.response?.data?.message || 'Error de conexión al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [isAdmin, isCoach])
  );

  const loadUserRoutines = async (userId: number) => {
    setLoading(true);
    try {
      const response = await api.get(`/routines/user/${userId}`);
      if (response.data && response.data.success) {
        setRoutines(response.data.data);
      }
    } catch (err: any) {
      console.error('Error loading user routines:', err);
      setErrorMessage('Error al cargar rutinas del usuario seleccionado');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: User) => {
    setSelectedClient(client);
    setSearchQuery(client.nombre);
    setErrorMessage(null);
    setSuccessMessage(null);
    loadUserRoutines(client.id);
  };

  const handleSaveRoutine = async () => {
    if (!selectedClient || !routineTitle.trim() || !routineDesc.trim()) {
      setErrorMessage('Por favor, completa todos los campos de la rutina.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      let finalDesc = routineDesc.trim();
      if (selectedExerciseIds.length > 0) {
        finalDesc = JSON.stringify({
          es_visual: true,
          descripcion: routineDesc.trim(),
          ejercicios: selectedExerciseIds
        });
      }

      const response = await api.post('/routines', {
        usuario_id: selectedClient.id,
        nombre: routineTitle.trim(),
        descripcion: finalDesc
      });

      if (response.data && response.data.success) {
        setSuccessMessage('💪 Rutina asignada con éxito');
        setRoutineTitle('');
        setRoutineDesc('');
        setSelectedExerciseIds([]);
        setEditorVisible(false);
        loadUserRoutines(selectedClient.id); // Recargar rutinas
      }
    } catch (err: any) {
      console.error('Error saving routine:', err);
      setErrorMessage(err.response?.data?.message || 'Error al guardar la rutina');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoutine = async (id: number) => {
    const confirmDelete = async () => {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const response = await api.delete(`/routines/${id}`);
        if (response.data && response.data.success) {
          setSuccessMessage('🗑️ Rutina eliminada correctamente');
          if (selectedClient) loadUserRoutines(selectedClient.id);
        }
      } catch (err: any) {
        console.error('Error deleting routine:', err);
        setErrorMessage(err.response?.data?.message || 'Error al eliminar rutina');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const accept = window.confirm('¿Estás seguro de que deseas eliminar esta rutina?');
      if (accept) confirmDelete();
    } else {
      Alert.alert(
        'Confirmar eliminación',
        '¿Estás seguro de que deseas eliminar esta rutina?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: confirmDelete }
        ]
      );
    }
  };

  const filteredClients = clients.filter(c =>
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const toggleExpandRoutine = (id: number) => {
    if (expandedRoutineId === id) {
      setExpandedRoutineId(null);
    } else {
      setExpandedRoutineId(id);
    }
  };

  // --- CLIENT CUSTOM ROUTINES HANDLERS ---
  const handleToggleExerciseSelection = (exerciseId: string) => {
    if (selectedExerciseIds.includes(exerciseId)) {
      setSelectedExerciseIds(selectedExerciseIds.filter(id => id !== exerciseId));
    } else {
      setSelectedExerciseIds([...selectedExerciseIds, exerciseId]);
    }
  };

  const handleOpenCreator = (routine?: CustomRoutine) => {
    if (routine) {
      setEditingCustomRoutineId(routine.id);
      setCustomTitle(routine.nombre);
      setCustomDesc(routine.descripcion);
      setSelectedExerciseIds(routine.ejercicios);
    } else {
      setEditingCustomRoutineId(null);
      setCustomTitle('');
      setCustomDesc('');
      setSelectedExerciseIds([]);
    }
    setSelectedGroup('Todos');
    setExerciseSearch('');
    setCreatorVisible(true);
  };

  const handleSaveCustomRoutine = async () => {
    if (!customTitle.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para la rutina.');
      return;
    }
    if (selectedExerciseIds.length === 0) {
      Alert.alert('Error', 'Por favor selecciona al menos un ejercicio.');
      return;
    }

    let updated: CustomRoutine[];
    if (editingCustomRoutineId) {
      updated = customRoutines.map(r => r.id === editingCustomRoutineId ? {
        ...r,
        nombre: customTitle.trim(),
        descripcion: customDesc.trim(),
        ejercicios: selectedExerciseIds,
      } : r);
      setSuccessMessage('💪 Rutina personalizada actualizada.');
    } else {
      const newRoutine: CustomRoutine = {
        id: `custom-${Date.now()}`,
        nombre: customTitle.trim(),
        descripcion: customDesc.trim(),
        ejercicios: selectedExerciseIds,
        fecha_creacion: new Date().toISOString(),
      };
      updated = [newRoutine, ...customRoutines];
      setSuccessMessage('💪 Rutina personalizada creada con éxito.');
    }
    await saveCustomRoutines(updated);
    setCreatorVisible(false);

    // Reset form
    setCustomTitle('');
    setCustomDesc('');
    setSelectedExerciseIds([]);
    setEditingCustomRoutineId(null);

    // Auto dismiss success banner after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteCustomRoutine = async (id: string) => {
    const confirmDelete = async () => {
      const updated = customRoutines.filter(r => r.id !== id);
      await saveCustomRoutines(updated);
      setSuccessMessage('🗑️ Rutina eliminada.');
      setTimeout(() => setSuccessMessage(null), 3000);
    };

    if (Platform.OS === 'web') {
      const accept = window.confirm('¿Estás seguro de que deseas eliminar esta rutina?');
      if (accept) confirmDelete();
    } else {
      Alert.alert(
        'Eliminar Rutina',
        '¿Estás seguro de que deseas eliminar esta rutina?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: confirmDelete }
        ]
      );
    }
  };

  // --- WORKOUT PLAYER HANDLERS ---
  const handleStartWorkout = (routine: CustomRoutine) => {
    setPlayerRoutine(routine);
    setPlayerCurrentIndex(0);
    setPlayerVisible(true);
  };

  const handleNextExercise = () => {
    if (!playerRoutine) return;
    if (playerCurrentIndex < playerRoutine.ejercicios.length - 1) {
      setPlayerCurrentIndex(playerCurrentIndex + 1);
    } else {
      // Finalizar entrenamiento
      setPlayerVisible(false);
      setPlayerRoutine(null);
      setWorkoutCompletedVisible(true);
    }
  };

  const handlePrevExercise = () => {
    if (playerCurrentIndex > 0) {
      setPlayerCurrentIndex(playerCurrentIndex - 1);
    }
  };

  const getRoutineExercises = (exerciseIds: string[]) => {
    return exercisesDataset.filter((ex: any) => exerciseIds.includes(ex.id));
  };

  const parseRoutineDescription = (desc: string) => {
    try {
      if (desc && desc.trim().startsWith('{')) {
        const parsed = JSON.parse(desc);
        if (parsed && parsed.es_visual) {
          return {
            esVisual: true,
            descripcion: parsed.descripcion,
            ejercicios: parsed.ejercicios || []
          };
        }
      }
    } catch (e) {
      // Ignorar error, retornar texto plano
    }
    return {
      esVisual: false,
      descripcion: desc,
      ejercicios: []
    };
  };

  // Filtered exercises list in the editor
  const filteredExercises = exercisesDataset.filter((ex: any) => {
    const matchesGroup = selectedGroup === 'Todos' || ex.grupo_muscular === selectedGroup;
    const matchesSearch = !exerciseSearch.trim() || 
      ex.nombre.toLowerCase().includes(exerciseSearch.toLowerCase()) || 
      ex.nombre_original.toLowerCase().includes(exerciseSearch.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  // Muscle groups for categories filtering
  const muscleGroups = ['Todos', ...new Set(exercisesDataset.map(ex => ex.grupo_muscular))];

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
                Shark Workout
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                {isAdmin ? 'Gestión de Rutinas para Miembros' : 'Mis Rutinas y Entrenamientos Asignados'}
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

            {loading && !editorVisible && (
              <ActivityIndicator size="large" color="#3c87f7" style={{ marginVertical: Spacing.four }} />
            )}

            {/* ADIMINISTRADOR VIEW */}
            {isAdmin && (
              <View style={{ gap: Spacing.four, width: '100%' }}>
                {/* Selector de Cliente */}
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold" style={styles.cardTitle}>
                    1. Seleccionar Cliente
                  </ThemedText>
                  
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="Escribe para buscar cliente..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      if (selectedClient && !text) {
                        setSelectedClient(null);
                        setRoutines([]);
                      }
                    }}
                  />

                  {searchQuery && !selectedClient && (
                    <View style={styles.dropdownList}>
                      {filteredClients.slice(0, 4).map(c => (
                        <Pressable
                          key={c.id}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectClient(c)}
                        >
                          <ThemedText style={{ color: '#fff' }}>{c.nombre} ({c.email})</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {selectedClient && (
                    <View style={styles.selectionInfo}>
                      <ThemedText style={styles.selectionText}>
                        Cliente: <ThemedText style={{ color: '#3c87f7', fontWeight: 'bold' }}>{selectedClient.nombre}</ThemedText>
                      </ThemedText>
                    </View>
                  )}
                </ThemedView>

                {/* Listado de Rutinas del Cliente */}
                {selectedClient && (
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two }}>
                      <ThemedText type="smallBold" style={styles.cardTitle}>
                        2. Rutinas Asignadas
                      </ThemedText>
                      <Pressable
                        style={({ pressed }) => [
                          styles.addButton,
                          { opacity: pressed ? 0.7 : 1 }
                        ]}
                        onPress={() => {
                          setSelectedExerciseIds([]);
                          setSelectedGroup('Todos');
                          setExerciseSearch('');
                          setEditorVisible(true);
                        }}
                      >
                        <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>+ Asignar</ThemedText>
                      </Pressable>
                    </View>

                    {routines.length === 0 ? (
                      <ThemedText style={styles.emptyText} themeColor="textSecondary">
                        Este cliente no tiene rutinas asignadas.
                      </ThemedText>
                    ) : (
                      <View style={{ gap: Spacing.two }}>
                        {routines.map((routine) => {
                          const parsed = parseRoutineDescription(routine.descripcion);
                          return (
                            <View key={routine.id} style={styles.routineListItem}>
                              <View style={{ flex: 1, paddingRight: Spacing.two }}>
                                <ThemedText type="smallBold" style={{ fontSize: 15 }}>{routine.nombre}</ThemedText>
                                <ThemedText style={{ fontSize: 12, marginTop: 4, color: '#aaa' }} numberOfLines={2}>
                                  {parsed.descripcion}
                                </ThemedText>
                                {parsed.esVisual && (
                                  <ThemedText style={{ fontSize: 11, color: '#208AEF', fontWeight: 'bold', marginTop: 4 }}>
                                    ✓ Rutina Visual • {parsed.ejercicios.length} ejercicios asignados
                                  </ThemedText>
                                )}
                              </View>
                              <Pressable
                                style={styles.deleteButton}
                                onPress={() => handleDeleteRoutine(routine.id)}
                              >
                                <ThemedText style={{ color: '#ff4444', fontWeight: 'bold' }}>✕</ThemedText>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </ThemedView>
                )}
              </View>
            )}

            {/* CLIENT VIEW */}
            {!isAdmin && (
              <View style={{ gap: Spacing.three, width: '100%' }}>
                {/* TABS DE SELECCIÓN */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={{ gap: 8, paddingBottom: Spacing.two }}
                  style={{ marginBottom: Spacing.one }}
                >
                  <Pressable
                    style={[
                      styles.tabCapsule,
                      clientTab === 'coach' && styles.tabCapsuleActive
                    ]}
                    onPress={() => setClientTab('coach')}
                  >
                    <ThemedText style={[styles.tabCapsuleText, clientTab === 'coach' && styles.tabCapsuleTextActive]}>
                      Asignadas por Coach
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.tabCapsule,
                      clientTab === 'custom' && styles.tabCapsuleActive
                    ]}
                    onPress={() => setClientTab('custom')}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText style={[styles.tabCapsuleText, clientTab === 'custom' && styles.tabCapsuleTextActive]}>
                        Mi Creador
                      </ThemedText>
                      <View style={{ backgroundColor: '#208AEF', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <ThemedText style={{ fontSize: 9, color: '#fff', fontWeight: 'bold' }}>PRO</ThemedText>
                      </View>
                    </View>
                  </Pressable>

                  {isCoach && (
                    <Pressable
                      style={[
                        styles.tabCapsule,
                        clientTab === 'assign' && styles.tabCapsuleActiveCoach
                      ]}
                      onPress={() => setClientTab('assign')}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText style={[styles.tabCapsuleText, clientTab === 'assign' && styles.tabCapsuleTextActive]}>
                          Asignar Clientes
                        </ThemedText>
                        <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <ThemedText style={{ fontSize: 9, color: '#f59e0b', fontWeight: 'bold' }}>COACH</ThemedText>
                        </View>
                      </View>
                    </Pressable>
                  )}
                </ScrollView>

                {/* TAB 1: ASIGNADAS POR COACH */}
                {clientTab === 'coach' && (
                  <View style={{ gap: Spacing.three, width: '100%' }}>
                    {routines.length === 0 ? (
                      <View style={styles.glassCardEmpty}>
                        <ThemedText style={{ fontSize: 32 }}>💪</ThemedText>
                        <ThemedText type="smallBold" style={{ fontSize: 16, textAlign: 'center', color: '#fff', marginTop: Spacing.one }}>Sin Rutinas Asignadas</ThemedText>
                        <ThemedText style={{ textAlign: 'center', fontSize: 13, color: '#aaa', marginTop: Spacing.one }}>
                          Pregunta a tu entrenador de Shark Gym para que te planifique tu rutina diaria en la app.
                        </ThemedText>
                      </View>
                    ) : (
                      routines.map((routine) => {
                        const isExpanded = expandedRoutineId === routine.id;
                        const parsed = parseRoutineDescription(routine.descripcion);
                        const exerciseList = getRoutineExercises(parsed.ejercicios);
                        return (
                          <View key={routine.id} style={styles.clientGlassCard}>
                            <Pressable onPress={() => toggleExpandRoutine(routine.id)} style={styles.clientCardHeader}>
                              <View style={{ flex: 1 }}>
                                <ThemedText type="subtitle" style={styles.clientCardTitle}>{routine.nombre}</ThemedText>
                                <ThemedText style={{ fontSize: 11, color: parsed.esVisual ? '#f59e0b' : '#208AEF', marginTop: 2 }}>
                                  {parsed.esVisual ? `Asignación Visual • ${parsed.ejercicios.length} ejercicios` : `Asignado: ${new Date(routine.fecha_creacion).toLocaleDateString('es-ES')}`}
                                </ThemedText>
                              </View>
                              <ThemedText style={{ fontSize: 18, color: parsed.esVisual ? '#f59e0b' : '#208AEF' }}>
                                {isExpanded ? '▲' : '▼'}
                              </ThemedText>
                            </Pressable>

                            {isExpanded && (
                              <View style={styles.clientCardBody}>
                                <ThemedText style={[styles.clientCardDesc, parsed.esVisual && { marginBottom: Spacing.two }]}>
                                  {parsed.descripcion}
                                </ThemedText>

                                {parsed.esVisual && (
                                  <>
                                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13, marginBottom: 8, marginTop: 10 }}>
                                      Ejercicios asignados por coach:
                                    </ThemedText>
                                    <View style={{ gap: 8, marginBottom: Spacing.three }}>
                                      {exerciseList.map((ex: any, idx) => (
                                        <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                                          <Image source={{ uri: ex.imagen_url }} style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#fff' }} />
                                          <View style={{ flex: 1 }}>
                                            <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                                              {idx + 1}. {ex.nombre}
                                            </ThemedText>
                                            <ThemedText style={{ color: '#888', fontSize: 11 }}>
                                              Músculo: {ex.musculo_objetivo} • Equipamiento: {ex.equipamiento}
                                            </ThemedText>
                                          </View>
                                        </View>
                                      ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingTop: Spacing.two }}>
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.playWorkoutBtn,
                                          { opacity: pressed ? 0.8 : 1 }
                                        ]}
                                        onPress={() => handleStartWorkout({
                                          id: String(routine.id),
                                          nombre: routine.nombre,
                                          descripcion: parsed.descripcion,
                                          ejercicios: parsed.ejercicios,
                                          fecha_creacion: routine.fecha_creacion
                                        })}
                                      >
                                        <ThemedText style={{ fontSize: 13 }}>▶️</ThemedText>
                                        <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Iniciar Entrenamiento</ThemedText>
                                      </Pressable>
                                    </View>
                                  </>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* TAB 2: MI CREADOR (RUTINAS PERSONALIZADAS LOCALES) */}
                {clientTab === 'custom' && (
                  <View style={{ gap: Spacing.three, width: '100%' }}>
                    {/* Botón Crear Nueva Rutina */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.createCustomRoutineBtn,
                        { opacity: pressed ? 0.8 : 1 }
                      ]}
                      onPress={() => handleOpenCreator()}
                    >
                      <ThemedText style={{ fontSize: 16 }}>💪</ThemedText>
                      <ThemedText style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
                        Crear Nueva Rutina
                      </ThemedText>
                    </Pressable>

                    {customRoutines.length === 0 ? (
                      <View style={styles.glassCardEmpty}>
                        <ThemedText style={{ fontSize: 32 }}>🏋️‍♀️</ThemedText>
                        <ThemedText type="smallBold" style={{ fontSize: 16, textAlign: 'center', color: '#fff', marginTop: Spacing.one }}>Tu Creador está vacío</ThemedText>
                        <ThemedText style={{ textAlign: 'center', fontSize: 13, color: '#aaa', marginTop: Spacing.one }}>
                          ¡Diseña tu propio entrenamiento! Toca el botón de arriba para seleccionar ejercicios y armar tu rutina diaria con animaciones.
                        </ThemedText>
                      </View>
                    ) : (
                      customRoutines.map((routine) => {
                        const isExpanded = expandedCustomId === routine.id;
                        const exerciseList = getRoutineExercises(routine.ejercicios);
                        return (
                          <View key={routine.id} style={styles.clientGlassCard}>
                            <Pressable 
                              onPress={() => setExpandedCustomId(isExpanded ? null : routine.id)} 
                              style={styles.clientCardHeader}
                            >
                              <View style={{ flex: 1 }}>
                                <ThemedText type="subtitle" style={styles.clientCardTitle}>{routine.nombre}</ThemedText>
                                <ThemedText style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>
                                  Rutina Personal • {routine.ejercicios.length} ejercicios
                                </ThemedText>
                              </View>
                              <ThemedText style={{ fontSize: 18, color: '#f59e0b' }}>
                                {isExpanded ? '▲' : '▼'}
                              </ThemedText>
                            </Pressable>

                            {isExpanded && (
                              <View style={styles.clientCardBody}>
                                {routine.descripcion ? (
                                  <ThemedText style={[styles.clientCardDesc, { marginBottom: Spacing.two }]}>
                                    {routine.descripcion}
                                  </ThemedText>
                                ) : null}

                                <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}>
                                  Ejercicios a realizar:
                                </ThemedText>

                                {/* List of exercises */}
                                <View style={{ gap: 8, marginBottom: Spacing.three }}>
                                  {exerciseList.map((ex: any, idx) => (
                                    <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                                      <Image source={{ uri: ex.imagen_url }} style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#fff' }} />
                                      <View style={{ flex: 1 }}>
                                        <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                                          {idx + 1}. {ex.nombre}
                                        </ThemedText>
                                        <ThemedText style={{ color: '#888', fontSize: 11 }}>
                                          Músculo: {ex.musculo_objetivo} • Equipamiento: {ex.equipamiento}
                                        </ThemedText>
                                      </View>
                                    </View>
                                  ))}
                                </View>

                                {/* Actions: Play Workout & Edit / Delete */}
                                <View style={{ flexDirection: 'row', gap: Spacing.two, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingTop: Spacing.two }}>
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.playWorkoutBtn,
                                      { opacity: pressed ? 0.8 : 1 }
                                    ]}
                                    onPress={() => handleStartWorkout(routine)}
                                  >
                                    <ThemedText style={{ fontSize: 13 }}>▶️</ThemedText>
                                    <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Iniciar Entrenamiento</ThemedText>
                                  </Pressable>

                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.actionIconBtn,
                                      { backgroundColor: 'rgba(255,255,255,0.06)', opacity: pressed ? 0.8 : 1 }
                                    ]}
                                    onPress={() => handleOpenCreator(routine)}
                                  >
                                    <ThemedText style={{ color: '#fff', fontSize: 12 }}>✏️</ThemedText>
                                  </Pressable>

                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.actionIconBtn,
                                      { backgroundColor: 'rgba(244,67,54,0.1)', borderColor: 'rgba(244,67,54,0.2)', borderWidth: 1, opacity: pressed ? 0.8 : 1 }
                                    ]}
                                    onPress={() => handleDeleteCustomRoutine(routine.id)}
                                  >
                                    <ThemedText style={{ color: '#ff4444', fontSize: 12 }}>🗑️</ThemedText>
                                  </Pressable>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* TAB 3: ASIGNAR A CLIENTES (SOLO PARA COACHES) */}
                {isCoach && clientTab === 'assign' && (
                  <View style={{ gap: Spacing.four, width: '100%' }}>
                    {/* Selector de Cliente */}
                    <ThemedView type="backgroundElement" style={styles.card}>
                      <ThemedText type="smallBold" style={styles.cardTitle}>
                        1. Seleccionar Cliente
                      </ThemedText>
                      
                      <TextInput
                        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                        placeholder="Escribe para buscar cliente..."
                        placeholderTextColor={theme.textSecondary}
                        value={searchQuery}
                        onChangeText={(text) => {
                          setSearchQuery(text);
                          if (selectedClient && !text) {
                            setSelectedClient(null);
                            setRoutines([]);
                          }
                        }}
                      />

                      {searchQuery && !selectedClient && (
                        <View style={styles.dropdownList}>
                          {filteredClients.slice(0, 4).map(c => (
                            <Pressable
                              key={c.id}
                              style={styles.dropdownItem}
                              onPress={() => handleSelectClient(c)}
                            >
                              <ThemedText style={{ color: '#fff' }}>{c.nombre} ({c.email})</ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      )}

                      {selectedClient && (
                        <View style={styles.selectionInfo}>
                          <ThemedText style={styles.selectionText}>
                            Cliente: <ThemedText style={{ color: '#3c87f7', fontWeight: 'bold' }}>{selectedClient.nombre}</ThemedText>
                          </ThemedText>
                        </View>
                      )}
                    </ThemedView>

                    {/* Listado de Rutinas del Cliente */}
                    {selectedClient && (
                      <ThemedView type="backgroundElement" style={styles.card}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two }}>
                          <ThemedText type="smallBold" style={styles.cardTitle}>
                            2. Rutinas Asignadas
                          </ThemedText>
                          <Pressable
                            style={({ pressed }) => [
                              styles.addButton,
                              { opacity: pressed ? 0.7 : 1 }
                            ]}
                            onPress={() => {
                              setSelectedExerciseIds([]);
                              setSelectedGroup('Todos');
                              setExerciseSearch('');
                              setEditorVisible(true);
                            }}
                          >
                            <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>+ Asignar</ThemedText>
                          </Pressable>
                        </View>

                        {routines.length === 0 ? (
                          <ThemedText style={styles.emptyText} themeColor="textSecondary">
                            Este cliente no tiene rutinas asignadas.
                          </ThemedText>
                        ) : (
                          <View style={{ gap: Spacing.two }}>
                            {routines.map((routine) => {
                              const parsed = parseRoutineDescription(routine.descripcion);
                              return (
                                <View key={routine.id} style={styles.routineListItem}>
                                  <View style={{ flex: 1, paddingRight: Spacing.two }}>
                                    <ThemedText type="smallBold" style={{ fontSize: 15 }}>{routine.nombre}</ThemedText>
                                    <ThemedText style={{ fontSize: 12, marginTop: 4, color: '#aaa' }} numberOfLines={2}>
                                      {parsed.descripcion}
                                    </ThemedText>
                                    {parsed.esVisual && (
                                      <ThemedText style={{ fontSize: 11, color: '#208AEF', fontWeight: 'bold', marginTop: 4 }}>
                                        ✓ Rutina Visual • {parsed.ejercicios.length} ejercicios asignados
                                      </ThemedText>
                                    )}
                                  </View>
                                  <Pressable
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteRoutine(routine.id)}
                                  >
                                    <ThemedText style={{ color: '#ff4444', fontWeight: 'bold' }}>✕</ThemedText>
                                  </Pressable>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </ThemedView>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </ImageBackground>

      {/* MODAL ASIGNAR RUTINA (ADMIN) */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Asignar Rutina
            </ThemedText>

            {selectedClient && (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: -Spacing.one, marginBottom: 8 }}>
                Para: {selectedClient.nombre}
              </ThemedText>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ gap: Spacing.three, marginVertical: Spacing.two }}>
                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Título de la rutina
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="Ej: Día de Pierna"
                    placeholderTextColor={theme.textSecondary}
                    value={routineTitle}
                    onChangeText={setRoutineTitle}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Indicaciones / Repeticiones (Opcional)
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                        height: 90,
                        paddingTop: Spacing.two,
                        textAlignVertical: 'top'
                      }
                    ]}
                    placeholder="Ej: Realizar 4 series de 12 repeticiones descansando 1 min."
                    placeholderTextColor={theme.textSecondary}
                    value={routineDesc}
                    onChangeText={setRoutineDesc}
                    multiline={true}
                    numberOfLines={4}
                  />
                </View>

                {/* Buscador de Ejercicios */}
                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Buscar Ejercicios por Nombre
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="Ej: Bench press, sentadilla, curl..."
                    placeholderTextColor={theme.textSecondary}
                    value={exerciseSearch}
                    onChangeText={setExerciseSearch}
                  />
                </View>

                {/* Filtro de Grupos Musculares */}
                <View style={{ marginTop: Spacing.two }}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.label, { marginBottom: 6 }]}>
                    Filtrar Ejercicios por Zona (Opcional)
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {muscleGroups.map(g => (
                      <Pressable
                        key={g}
                        style={[
                          styles.muscleFilterBtn,
                          selectedGroup === g && styles.muscleFilterBtnActive
                        ]}
                        onPress={() => setSelectedGroup(g)}
                      >
                        <ThemedText style={[
                          styles.muscleFilterText,
                          selectedGroup === g && styles.muscleFilterTextActive
                        ]}>
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Listado de Ejercicios para Seleccionar */}
                <View style={{ marginTop: Spacing.two }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                      Asignar Guía Visual de Ejercicios ({selectedExerciseIds.length})
                    </ThemedText>
                  </View>

                  <View style={{ gap: 8 }}>
                    {filteredExercises.slice(0, 40).map(ex => {
                      const isSelected = selectedExerciseIds.includes(ex.id);
                      return (
                        <Pressable
                          key={ex.id}
                          style={[
                            styles.exerciseSelectRow,
                            isSelected && styles.exerciseSelectRowSelected
                          ]}
                          onPress={() => handleToggleExerciseSelection(ex.id)}
                        >
                          <Image source={{ uri: ex.imagen_url }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#fff' }} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                              {ex.nombre}
                            </ThemedText>
                            <ThemedText style={{ color: '#aaa', fontSize: 11 }}>
                              Categoría: {ex.grupo_muscular} • {ex.equipamiento}
                            </ThemedText>
                          </View>
                          <View style={[
                            styles.checkboxCircle,
                            isSelected && styles.checkboxCircleActive
                          ]}>
                            {isSelected && <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</ThemedText>}
                          </View>
                        </Pressable>
                      );
                    })}

                    {filteredExercises.length > 40 && (
                      <ThemedText style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 10, textAlign: 'center' }}>
                        * Mostrando 40 de {filteredExercises.length} ejercicios. Usa el buscador o filtros arriba para ver más.
                      </ThemedText>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
              <Pressable
                style={({ pressed }) => [
                  styles.buyButton,
                  {
                    backgroundColor: '#208AEF',
                    opacity: pressed ? 0.8 : 1
                  }
                ]}
                onPress={handleSaveRoutine}
              >
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  Guardar Rutina
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.modalBtnCancel}
                onPress={() => {
                  setEditorVisible(false);
                  setRoutineTitle('');
                  setRoutineDesc('');
                  setSelectedExerciseIds([]);
                }}
              >
                <ThemedText style={{ color: '#aaa', textAlign: 'center' }}>Cancelar</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* MODAL CREADOR DE RUTINAS (CLIENTE) */}
      <Modal
        visible={creatorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreatorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {editingCustomRoutineId ? 'Editar Rutina' : 'Crear Rutina Personalizada'}
            </ThemedText>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ gap: Spacing.three, marginVertical: Spacing.two }}>
                {/* Nombre */}
                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Nombre de la Rutina
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="Ej: Día de Pecho / Tríceps"
                    placeholderTextColor={theme.textSecondary}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                  />
                </View>

                {/* Descripción */}
                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Descripción / Notas (Opcional)
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="Ej: Enfocarse en press inclinado y aperturas"
                    placeholderTextColor={theme.textSecondary}
                    value={customDesc}
                    onChangeText={setCustomDesc}
                  />
                </View>

                {/* Buscador de Ejercicios */}
                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Buscar Ejercicios por Nombre
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="Ej: Bench press, sentadilla, curl..."
                    placeholderTextColor={theme.textSecondary}
                    value={exerciseSearch}
                    onChangeText={setExerciseSearch}
                  />
                </View>

                {/* Filtro de Grupos Musculares */}
                <View style={{ marginTop: Spacing.two }}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.label, { marginBottom: 6 }]}>
                    Filtrar Ejercicios por Zona
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {muscleGroups.map(g => (
                      <Pressable
                        key={g}
                        style={[
                          styles.muscleFilterBtn,
                          selectedGroup === g && styles.muscleFilterBtnActive
                        ]}
                        onPress={() => setSelectedGroup(g)}
                      >
                        <ThemedText style={[
                          styles.muscleFilterText,
                          selectedGroup === g && styles.muscleFilterTextActive
                        ]}>
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Listado de Ejercicios para Seleccionar */}
                <View style={{ marginTop: Spacing.two }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                      Selecciona los Ejercicios ({selectedExerciseIds.length} seleccionados)
                    </ThemedText>
                  </View>

                  <View style={{ gap: 8 }}>
                    {filteredExercises.slice(0, 40).map(ex => {
                      const isSelected = selectedExerciseIds.includes(ex.id);
                      return (
                        <Pressable
                          key={ex.id}
                          style={[
                            styles.exerciseSelectRow,
                            isSelected && styles.exerciseSelectRowSelected
                          ]}
                          onPress={() => handleToggleExerciseSelection(ex.id)}
                        >
                          <Image source={{ uri: ex.imagen_url }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#fff' }} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                              {ex.nombre}
                            </ThemedText>
                            <ThemedText style={{ color: '#aaa', fontSize: 11 }}>
                              Categoría: {ex.grupo_muscular} • {ex.equipamiento}
                            </ThemedText>
                          </View>
                          <View style={[
                            styles.checkboxCircle,
                            isSelected && styles.checkboxCircleActive
                          ]}>
                            {isSelected && <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</ThemedText>}
                          </View>
                        </Pressable>
                      );
                    })}

                    {filteredExercises.length > 40 && (
                      <ThemedText style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 10, textAlign: 'center' }}>
                        * Mostrando 40 de {filteredExercises.length} ejercicios. Usa el buscador o filtros arriba para ver más.
                      </ThemedText>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Acciones */}
            <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
              <Pressable
                style={({ pressed }) => [
                  styles.buyButton,
                  {
                    backgroundColor: '#208AEF',
                    opacity: pressed ? 0.8 : 1
                  }
                ]}
                onPress={handleSaveCustomRoutine}
              >
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  Guardar Rutina
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.modalBtnCancel}
                onPress={() => setCreatorVisible(false)}
              >
                <ThemedText style={{ color: '#aaa', textAlign: 'center' }}>Cancelar</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* MODAL REPRODUCTOR DE ENTRENAMIENTO (WORKOUT PLAYER) */}
      <Modal
        visible={playerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          Alert.alert(
            'Salir del Entrenamiento',
            '¿Seguro que deseas salir del entrenamiento actual? Tu progreso de hoy no se guardará.',
            [
              { text: 'Continuar Entrenando', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: () => setPlayerVisible(false) }
            ]
          );
        }}
      >
        <ImageBackground
          source={require('@/assets/images/background-shark.jpg')}
          style={[styles.backgroundImage, { flex: 1 }]}
          resizeMode="cover"
        >
          {playerRoutine && (() => {
            const exercises = getRoutineExercises(playerRoutine.ejercicios);
            const currentEx = exercises[playerCurrentIndex];
            if (!currentEx) return null;

            return (
              <View style={[styles.playerContainer, { paddingTop: safeAreaInsets.top + 10, paddingBottom: safeAreaInsets.bottom + 10 }]}>
                {/* Header */}
                <View style={styles.playerHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.playerRoutineName} type="smallBold">
                      {playerRoutine.nombre}
                    </ThemedText>
                    <ThemedText style={styles.playerProgressText}>
                      Ejercicio {playerCurrentIndex + 1} de {exercises.length}
                    </ThemedText>
                  </View>
                  <Pressable 
                    style={styles.playerCloseBtn} 
                    onPress={() => {
                      Alert.alert(
                        'Salir del Entrenamiento',
                        '¿Deseas salir del entrenamiento actual?',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Salir', style: 'destructive', onPress: () => setPlayerVisible(false) }
                        ]
                      );
                    }}
                  >
                    <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</ThemedText>
                  </Pressable>
                </View>

                {/* Progress Bar indicator */}
                <View style={styles.playerProgressBarBg}>
                  <View style={[styles.playerProgressBarFill, { width: `${((playerCurrentIndex + 1) / exercises.length) * 100}%` }]} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.playerScrollContent}>
                  {/* GIF Animation Area */}
                  <View style={styles.playerGifContainer}>
                    <Image 
                      source={{ uri: currentEx.gif_url }} 
                      style={styles.playerGifImage} 
                      resizeMode="contain" 
                    />
                  </View>

                  {/* Info Box */}
                  <View style={styles.playerInfoBox}>
                    <ThemedText type="subtitle" style={styles.playerExerciseName}>
                      {currentEx.nombre}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                      <View style={styles.playerTag}>
                        <ThemedText style={styles.playerTagText}>💪 {currentEx.grupo_muscular.toUpperCase()}</ThemedText>
                      </View>
                      <View style={[styles.playerTag, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                        <ThemedText style={styles.playerTagText}>⚙️ {currentEx.equipamiento.toUpperCase()}</ThemedText>
                      </View>
                    </View>
                  </View>

                  {/* Step-by-Step Instructions */}
                  <View style={styles.playerInstructionsContainer}>
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 15, marginBottom: Spacing.two }}>
                      Instrucciones de Ejecución:
                    </ThemedText>
                    {currentEx.instrucciones.map((step: string, idx: number) => (
                      <View key={idx} style={styles.instructionStepRow}>
                        <View style={styles.stepNumberCircle}>
                          <ThemedText style={styles.stepNumberText}>{idx + 1}</ThemedText>
                        </View>
                        <ThemedText style={styles.stepDescriptionText}>{step}</ThemedText>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {/* Navigation Buttons footer */}
                <View style={styles.playerFooter}>
                  <Pressable
                    style={[
                      styles.playerNavBtn,
                      playerCurrentIndex === 0 && { opacity: 0.3 }
                    ]}
                    disabled={playerCurrentIndex === 0}
                    onPress={handlePrevExercise}
                  >
                    <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>◀ Anterior</ThemedText>
                  </Pressable>

                  <Pressable
                    style={[styles.playerNavBtn, styles.playerNavBtnNext]}
                    onPress={handleNextExercise}
                  >
                    <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>
                      {playerCurrentIndex === exercises.length - 1 ? '¡Finalizar! 🏆' : 'Siguiente ▶'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </ImageBackground>
      </Modal>

      {/* MODAL ENTRENAMIENTO COMPLETADO */}
      <Modal
        visible={workoutCompletedVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setWorkoutCompletedVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={[styles.modalContent, { alignItems: 'center', padding: Spacing.five }]}>
            <ThemedText style={{ fontSize: 64, lineHeight: 76, height: 76, textAlign: 'center', marginBottom: Spacing.two }}>🏆</ThemedText>
            <ThemedText type="subtitle" style={{ color: '#4caf50', textAlign: 'center', marginBottom: Spacing.one }}>
              ¡Entrenamiento Completado!
            </ThemedText>
            <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.two }}>
              ¡Excelente trabajo de entrenamiento de hoy!
            </ThemedText>
            <ThemedText style={{ color: '#aaa', fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: Spacing.four }}>
              Completaste todos los ejercicios de tu rutina personalizada. Entrenar diariamente te acerca más a tu objetivo. ¡Sigue siendo un tiburón! 🦈
            </ThemedText>

            <Pressable
              style={({ pressed }) => [
                styles.buyButton,
                {
                  backgroundColor: '#4caf50',
                  width: '100%',
                  opacity: pressed ? 0.8 : 1
                }
              ]}
              onPress={() => setWorkoutCompletedVisible(false)}
            >
              <ThemedText type="smallBold" style={{ color: '#fff', textAlign: 'center' }}>
                ¡Entendido!
              </ThemedText>
            </Pressable>
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
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    width: '100%',
  },
  cardTitle: {
    fontSize: 16,
    color: '#ffffff',
  },
  inputContainer: {
    gap: Spacing.one,
    width: '100%',
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
    width: '100%',
  },
  dropdownList: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 4,
    width: '100%',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  selectionInfo: {
    marginTop: Spacing.two,
    padding: 10,
    backgroundColor: 'rgba(60, 135, 247, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(60, 135, 247, 0.2)',
  },
  selectionText: {
    fontSize: 14,
  },
  emptyText: {
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  addButton: {
    backgroundColor: '#208AEF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  routineListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  // Client routines css
  clientCard: {
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    width: '100%',
    overflow: 'hidden',
  },
  clientCardHeader: {
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clientCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  clientCardBody: {
    padding: Spacing.four,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  clientCardDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#ddd',
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
  buyButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancel: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  tabCapsule: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCapsuleActive: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  tabCapsuleActiveCoach: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  tabCapsuleText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '700',
  },
  tabCapsuleTextActive: {
    color: '#fff',
  },
  glassCardEmpty: {
    padding: Spacing.five,
    borderRadius: Spacing.three,
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: Spacing.one,
  },
  clientGlassCard: {
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    width: '100%',
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  createCustomRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: Spacing.one,
  },
  playWorkoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  actionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  muscleFilterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 6,
  },
  muscleFilterBtnActive: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  muscleFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#aaa',
  },
  muscleFilterTextActive: {
    color: '#fff',
  },
  exerciseSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  exerciseSelectRowSelected: {
    borderColor: '#208AEF',
    backgroundColor: 'rgba(32, 138, 239, 0.1)',
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircleActive: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  playerContainer: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
  },
  playerRoutineName: {
    fontSize: 16,
    color: '#f59e0b',
  },
  playerProgressText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  playerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerProgressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  playerProgressBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  playerScrollContent: {
    paddingBottom: 30,
    gap: Spacing.three,
  },
  playerGifContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginVertical: Spacing.two,
  },
  playerGifImage: {
    width: '95%',
    height: '95%',
  },
  playerInfoBox: {
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  playerExerciseName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  playerTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  playerTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  playerInstructionsContainer: {
    padding: Spacing.four,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  instructionStepRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 6,
    alignItems: 'flex-start',
  },
  stepNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#208AEF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepDescriptionText: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  playerFooter: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  playerNavBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  playerNavBtnNext: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
