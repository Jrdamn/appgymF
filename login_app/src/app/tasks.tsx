import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import api from '@/services/api';

interface Task {
  id: number;
  titulo: string;
  completada: number | boolean;
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get('/tasks');
      if (response.data?.success && Array.isArray(response.data.data)) {
        setTasks(response.data.data);
      } else {
        throw new Error('La respuesta de tareas no tiene el formato esperado');
      }
    } catch (error: any) {
      console.error('Error al cargar tareas:', error);
      setErrorMessage(error.response?.data?.message || 'No se pudieron cargar tus tareas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const handleCreateTask = async () => {
    const titulo = newTask.trim();
    if (!titulo) {
      setErrorMessage('Escribe una tarea antes de agregarla.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const response = await api.post('/tasks', { titulo });
      if (!response.data?.success || !response.data.data) {
        throw new Error('No se pudo confirmar la creación de la tarea');
      }
      setTasks((currentTasks) => [response.data.data, ...currentTasks]);
      setNewTask('');
      Keyboard.dismiss();
    } catch (error: any) {
      console.error('Error al crear tarea:', error);
      setErrorMessage(error.response?.data?.message || 'No se pudo agregar la tarea.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    const completada = !Boolean(task.completada);
    setBusyTaskId(task.id);
    setErrorMessage(null);
    try {
      await api.put(`/tasks/${task.id}`, { completada });
      setTasks((currentTasks) => currentTasks.map((item) =>
        item.id === task.id ? { ...item, completada } : item
      ));
    } catch (error: any) {
      console.error('Error al actualizar tarea:', error);
      setErrorMessage(error.response?.data?.message || 'No se pudo actualizar la tarea.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    setBusyTaskId(task.id);
    setErrorMessage(null);
    try {
      await api.delete(`/tasks/${task.id}`);
      setTasks((currentTasks) => currentTasks.filter((item) => item.id !== task.id));
    } catch (error: any) {
      console.error('Error al eliminar tarea:', error);
      setErrorMessage(error.response?.data?.message || 'No se pudo eliminar la tarea.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const confirmDeleteTask = (task: Task) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar la tarea «${task.titulo}»?`)) {
        void handleDeleteTask(task);
      }
      return;
    }

    Alert.alert('Eliminar tarea', `¿Eliminar «${task.titulo}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void handleDeleteTask(task) },
    ]);
  };

  const completedCount = tasks.filter((task) => Boolean(task.completada)).length;

  return (
    <ThemedView type="background" style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, Spacing.four) + 52,
            paddingBottom: Math.max(insets.bottom, Spacing.four) + 96,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>Mi lista</ThemedText>
          <ThemedText themeColor="textSecondary">
            Organiza tus pendientes y marca tu progreso.
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.addCard}>
          <TextInput
            value={newTask}
            onChangeText={(value) => {
              setNewTask(value);
              if (errorMessage) setErrorMessage(null);
            }}
            onSubmitEditing={handleCreateTask}
            placeholder="¿Qué necesitas hacer?"
            placeholderTextColor={theme.textSecondary}
            maxLength={255}
            returnKeyType="done"
            accessibilityLabel="Nueva tarea"
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleCreateTask}
            disabled={saving}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed, saving && styles.disabled]}
          >
            {saving
              ? <ActivityIndicator color="#ffffff" />
              : <ThemedText type="smallBold" style={styles.buttonText}>Agregar tarea</ThemedText>}
          </Pressable>
        </ThemedView>

        {errorMessage ? (
          <ThemedText accessibilityRole="alert" style={styles.error}>{errorMessage}</ThemedText>
        ) : null}

        <View style={styles.listHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Pendientes</ThemedText>
          {!loading && (
            <ThemedText type="small" themeColor="textSecondary">
              {completedCount} de {tasks.length} completadas
            </ThemedText>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#208AEF" style={styles.loader} />
        ) : tasks.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText style={styles.emptyIcon}>📝</ThemedText>
            <ThemedText type="smallBold">Aún no tienes tareas</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Agrega una arriba para empezar tu lista.
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.taskList}>
            {tasks.map((task) => {
              const isCompleted = Boolean(task.completada);
              const isBusy = busyTaskId === task.id;
              return (
                <ThemedView key={task.id} type="backgroundElement" style={styles.taskCard}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isCompleted, disabled: isBusy }}
                    accessibilityLabel={`Marcar ${task.titulo} como ${isCompleted ? 'pendiente' : 'completada'}`}
                    onPress={() => handleToggleTask(task)}
                    disabled={isBusy}
                    style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
                  >
                    {isBusy
                      ? <ActivityIndicator size="small" color="#208AEF" />
                      : <ThemedText style={[styles.checkmark, isCompleted && styles.checkmarkChecked]}>
                          {isCompleted ? '✓' : ''}
                        </ThemedText>}
                  </Pressable>
                  <ThemedText
                    style={[styles.taskTitle, isCompleted && styles.taskTitleCompleted]}
                  >
                    {task.titulo}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar ${task.titulo}`}
                    onPress={() => confirmDeleteTask(task)}
                    disabled={isBusy}
                    hitSlop={8}
                    style={styles.deleteButton}
                  >
                    <ThemedText style={styles.deleteIcon}>×</ThemedText>
                  </Pressable>
                </ThemedView>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  title: { fontSize: 36, lineHeight: 42, fontWeight: '800', color: '#208AEF' },
  addCard: { padding: Spacing.three, borderRadius: 18, gap: Spacing.two },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  addButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
    paddingHorizontal: Spacing.three,
  },
  buttonText: { color: '#ffffff' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  error: { color: '#ff6b6b', fontSize: 14 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  loader: { marginTop: Spacing.five },
  emptyCard: { alignItems: 'center', padding: Spacing.five, borderRadius: 18, gap: Spacing.two },
  emptyIcon: { fontSize: 38 },
  taskList: { gap: Spacing.two },
  taskCard: {
    minHeight: 68,
    borderRadius: 14,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#208AEF' },
  checkmark: { fontSize: 19, lineHeight: 24, color: '#208AEF', fontWeight: '800' },
  checkmarkChecked: { color: '#ffffff' },
  taskTitle: { flex: 1, fontSize: 16, lineHeight: 22 },
  taskTitleCompleted: { textDecorationLine: 'line-through', opacity: 0.55 },
  deleteButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: { fontSize: 28, lineHeight: 32, color: '#ff6b6b' },
});
