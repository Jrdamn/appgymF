import React, { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/use-theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

export default function RegisterScreen({ onNavigateToLogin }: RegisterScreenProps) {
  const { register } = useAuth();
  const theme = useTheme();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const rol = 1;

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Focus states for input styling
  const [nombreFocused, setNombreFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [telefonoFocused, setTelefonoFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleRegister = async () => {
    if (!nombre || !email || !telefono || !password) {
      setErrorMessage('Por favor, completa todos los campos.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await register(nombre.trim(), email.trim(), telefono.trim(), password, rol);
      setSuccessMessage('Cuenta creada. Inicia sesión para verificar tu correo.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Error al registrar el usuario.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/background-shark.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.card}>
            {/* Botón Volver Atrás */}
            <Pressable
              onPress={onNavigateToLogin}
              style={({ pressed }) => [
                styles.backButton,
                pressed && { opacity: 0.7 }
              ]}
            >
              <ThemedText style={styles.backButtonText}>← Volver al Login</ThemedText>
            </Pressable>

            <View style={styles.header}>
              <ThemedText type="subtitle" style={styles.title}>
                Crear Cuenta
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Regístrate para comenzar
              </ThemedText>
            </View>

            {errorMessage && (
              <View style={[styles.errorBanner, { backgroundColor: '#FFEDED', borderColor: '#FFA1A1' }]}>
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {successMessage && (
              <View style={styles.successBanner}>
                <ThemedText style={styles.successText}>{successMessage}</ThemedText>
              </View>
            )}

            <View style={styles.form}>
              {/* Name Field */}
              <View style={styles.inputContainer}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  Nombre completo
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: nombreFocused ? '#3c87f7' : theme.backgroundSelected,
                    },
                  ]}
                  placeholder="Juan Pérez"
                  placeholderTextColor={theme.textSecondary}
                  value={nombre}
                  onChangeText={setNombre}
                  onFocus={() => setNombreFocused(true)}
                  onBlur={() => setNombreFocused(false)}
                />
              </View>

              {/* Email Field */}
              <View style={styles.inputContainer}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  Correo electrónico
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: emailFocused ? '#3c87f7' : theme.backgroundSelected,
                    },
                  ]}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>

              {/* Phone Field */}
              <View style={styles.inputContainer}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  Teléfono
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: telefonoFocused ? '#3c87f7' : theme.backgroundSelected,
                    },
                  ]}
                  placeholder="+1234567890"
                  placeholderTextColor={theme.textSecondary}
                  value={telefono}
                  onChangeText={setTelefono}
                  keyboardType="phone-pad"
                  onFocus={() => setTelefonoFocused(true)}
                  onBlur={() => setTelefonoFocused(false)}
                />
              </View>


              {/* Password Field */}
              <View style={styles.inputContainer}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  Contraseña
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: passwordFocused ? '#3c87f7' : theme.backgroundSelected,
                    },
                  ]}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
              </View>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: '#3c87f7', opacity: pressed || loading ? 0.8 : 1 },
                ]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <ThemedText type="smallBold" style={styles.buttonText}>
                    Registrarse
                  </ThemedText>
                )}
              </Pressable>
            </View>

            {/* Footer Navigation */}
            <View style={styles.footer}>
              <ThemedText type="small" themeColor="textSecondary">
                ¿Ya tienes una cuenta?{' '}
              </ThemedText>
              <Pressable onPress={onNavigateToLogin}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  Inicia sesión
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    maxWidth: 450,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.four,
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  subtitle: {
    textAlign: 'center',
  },
  errorBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginBottom: Spacing.four,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  successBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#A1DFA1',
    backgroundColor: '#EAF7EA',
    marginBottom: Spacing.four,
  },
  successText: {
    color: '#2E7D32',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
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
  button: {
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  linkText: {
    color: '#3c87f7',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  backButtonText: {
    color: '#3c87f7',
    fontSize: 14,
    fontWeight: '600',
  },
  roleSelectorContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  roleOption: {
    flex: 1,
    height: 48,
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
});
