import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  View,
  ImageBackground,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '../hooks/use-theme';
import { Spacing } from '../constants/theme';
import api from '../services/api';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export default function LoginScreen({ onNavigateToRegister }: LoginScreenProps) {
  const { login, verifyLoginCode } = useAuth();
  const theme = useTheme();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // Focus states for input styling
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  // Recovery password states
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1 = request code, 2 = reset password
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  const resetRecoveryState = () => {
    setRecoveryStep(1);
    setRecoveryCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryLoading(false);
    setRecoveryError(null);
    setRecoverySuccess(null);
  };

  const handleRequestCode = async () => {
    if (!recoveryEmail.trim()) {
      setRecoveryError('Por favor, ingresa tu correo.');
      return;
    }
    setRecoveryError(null);
    setRecoverySuccess(null);
    setRecoveryLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: recoveryEmail.trim() });
      if (response.data && response.data.success) {
        setRecoveryStep(2);
        setRecoverySuccess('Código de verificación enviado a tu correo.');
      }
    } catch (err: any) {
      setRecoveryError(err.response?.data?.message || 'Error al enviar código. Verifica tu correo.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!recoveryCode.trim() || !newPassword || !confirmNewPassword) {
      setRecoveryError('Por favor, completa todos los campos.');
      return;
    }
    if (newPassword.length < 8) {
      setRecoveryError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError('Las contraseñas no coinciden.');
      return;
    }

    setRecoveryError(null);
    setRecoverySuccess(null);
    setRecoveryLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        email: recoveryEmail.trim(),
        code: recoveryCode.trim(),
        newPassword
      });
      if (response.data && response.data.success) {
        setRecoverySuccess('¡Contraseña restablecida con éxito!');
        setTimeout(() => {
          setForgotModalVisible(false);
          resetRecoveryState();
        }, 2000);
      }
    } catch (err: any) {
      setRecoveryError(err.response?.data?.message || 'Error al restablecer la contraseña. Verifica el código.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Por favor, completa todos los campos.');
      return;
    }
    
    setErrorMessage(null);
    setLoading(true);
    
    try {
      const result = await login(email.trim(), password);
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error al iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginCode = async () => {
    if (!challengeId || !/^\d{6}$/.test(verificationCode)) {
      setErrorMessage('Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);
    try {
      await verifyLoginCode(challengeId, verificationCode);
    } catch (error: any) {
      setErrorMessage(error.message || 'No se pudo verificar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAccount = () => {
    setChallengeId(null);
    setMaskedEmail('');
    setVerificationCode('');
    setErrorMessage(null);
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
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {challengeId ? 'Verifica tu correo' : 'Bienvenido Shark'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {challengeId ? 'Ingresa el código para completar el inicio de sesión' : 'Inicia sesión para continuar'}
            </ThemedText>
          </View>

          {errorMessage && (
            <View style={[styles.errorBanner, { backgroundColor: '#FFEDED', borderColor: '#FFA1A1' }]}>
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          )}

          <View style={styles.form}>
            {challengeId ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                  Enviamos un código de 6 dígitos a {maskedEmail}. Vence en 10 minutos.
                </ThemedText>
                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Código de verificación
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundElement,
                        borderColor: codeFocused ? '#3c87f7' : theme.backgroundSelected,
                      },
                    ]}
                    placeholder="123456"
                    placeholderTextColor={theme.textSecondary}
                    value={verificationCode}
                    onChangeText={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="one-time-code"
                    onFocus={() => setCodeFocused(true)}
                    onBlur={() => setCodeFocused(false)}
                  />
                </View>
                <Pressable onPress={handleChangeAccount} style={{ alignSelf: 'flex-end' }}>
                  <ThemedText type="small" style={styles.linkText}>
                    Usar otra cuenta
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
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
                    placeholder="••••••••"
                    placeholderTextColor={theme.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                </View>

                <Pressable
                  onPress={() => setForgotModalVisible(true)}
                  style={{ alignSelf: 'flex-end', marginTop: -Spacing.one }}
                >
                  <ThemedText type="small" style={styles.linkText}>
                    ¿Olvidaste tu contraseña?
                  </ThemedText>
                </Pressable>
              </>
            )}

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: '#3c87f7', opacity: pressed || loading ? 0.8 : 1 },
              ]}
              onPress={challengeId ? handleVerifyLoginCode : handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {challengeId ? 'Verificar código' : 'Iniciar Sesión'}
                </ThemedText>
              )}
            </Pressable>
          </View>

          {/* Footer Navigation */}
          {!challengeId && (
            <View style={styles.footer}>
              <ThemedText type="small" themeColor="textSecondary">
                ¿No tienes una cuenta?{' '}
              </ThemedText>
              <Pressable onPress={onNavigateToRegister}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  Regístrate
                </ThemedText>
              </Pressable>
            </View>
          )}

          {!challengeId && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setTermsVisible(true)}
              style={({ pressed }) => [styles.termsLink, { opacity: pressed ? 0.7 : 1 }]}
            >
              <ThemedText type="small" style={styles.linkText}>
                Términos y condiciones
              </ThemedText>
            </Pressable>
          )}
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={termsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTermsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={[styles.modalCard, styles.termsModalCard]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Términos y condiciones
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar términos y condiciones"
                onPress={() => setTermsVisible(false)}
                style={styles.closeButton}
              >
                <ThemedText style={{ color: '#aaa', fontSize: 20 }}>✕</ThemedText>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator
              contentContainerStyle={styles.termsContent}
            >
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsNotice}>
                Documento base para Shark Gym. Debe revisarse y completarse con las políticas oficiales del gimnasio antes de su uso legal.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>1. Aceptación y alcance</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                Al crear una cuenta o utilizar la aplicación Shark Gym, aceptas estos términos. La aplicación ofrece herramientas para consultar información de membresía, rutinas de ejercicio, productos, pagos y accesos al gimnasio. El uso de las instalaciones y los servicios presenciales también está sujeto a las reglas comunicadas por Shark Gym.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>2. Cuenta y seguridad</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                Debes proporcionar información correcta y mantenerla actualizada, proteger tus credenciales y no compartir tu cuenta. Eres responsable de la actividad realizada desde ella. Si sospechas de un acceso no autorizado, contacta al personal de Shark Gym.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>3. Membresías, productos y pagos</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                Los precios, duración, vigencia y condiciones aplicables se muestran antes de confirmar cada compra o son comunicados por Shark Gym. La compra queda sujeta a la confirmación del proveedor de pago y del sistema. Las consultas sobre cobros, renovaciones, cancelaciones o reembolsos deben dirigirse a Shark Gym y se atenderán conforme a las condiciones de compra y la legislación aplicable.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>4. Rutinas y actividad física</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                Las rutinas y contenidos de ejercicio son informativos y no sustituyen la valoración ni el consejo de un profesional de salud. Realiza los ejercicios según tu condición física, detente si sientes dolor o malestar y consulta a un profesional antes de comenzar si tienes dudas sobre tu salud. Sigue las instrucciones del personal y utiliza el equipo de forma segura.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>5. Uso permitido</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                No debes utilizar la aplicación para actividades ilegales, interferir con su funcionamiento, intentar acceder a cuentas o datos ajenos ni publicar información engañosa o dañina. El acceso a funciones administrativas está limitado a las personas autorizadas por Shark Gym.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>6. Disponibilidad y notificaciones</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                Algunas funciones requieren conexión a internet y permisos del dispositivo. La entrega de notificaciones depende de la configuración del dispositivo, la red y los servicios de terceros; por ello, no se garantiza que cada aviso llegue inmediatamente. Shark Gym puede actualizar o interrumpir funciones para mantenimiento o mejoras.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>7. Privacidad</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                El tratamiento de datos personales debe explicarse en un aviso de privacidad separado. Estos términos no sustituyen dicho aviso. Antes de publicar la aplicación, Shark Gym debe completar y poner a disposición su política de privacidad y los medios de contacto correspondientes.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.termsHeading}>8. Cambios y contacto</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsParagraph}>
                Shark Gym puede actualizar estos términos; la versión vigente estará disponible en la aplicación. Para consultas sobre la cuenta, pagos o estos términos, comunícate directamente con el personal de Shark Gym por los canales oficiales del gimnasio.
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary" style={styles.termsUpdated}>
                Última actualización: 31 de octubre de 2026.
              </ThemedText>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA */}
      <Modal
        visible={forgotModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setForgotModalVisible(false);
          resetRecoveryState();
        }}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Recuperar Contraseña
              </ThemedText>
              <Pressable 
                onPress={() => {
                  setForgotModalVisible(false);
                  resetRecoveryState();
                }} 
                style={styles.closeButton}
              >
                <ThemedText style={{ color: '#aaa', fontSize: 20 }}>✕</ThemedText>
              </Pressable>
            </View>

            {recoveryError && (
              <View style={[styles.errorBanner, { backgroundColor: '#FFEDED', borderColor: '#FFA1A1', marginBottom: Spacing.three }]}>
                <ThemedText style={styles.errorText}>{recoveryError}</ThemedText>
              </View>
            )}

            {recoverySuccess && (
              <View style={[styles.successBanner, { backgroundColor: '#EAF7EA', borderColor: '#A1DFA1', padding: Spacing.two, borderRadius: Spacing.one, marginBottom: Spacing.three }]}>
                <ThemedText style={{ color: '#2E7D32', fontSize: 13, textAlign: 'center' }}>{recoverySuccess}</ThemedText>
              </View>
            )}

            {recoveryStep === 1 ? (
              // PASO 1: Ingresar Correo
              <View style={{ gap: Spacing.three }}>
                <ThemedText type="small" themeColor="textSecondary">
                  Ingresa tu correo registrado y te enviaremos un código de seguridad para restablecer tu contraseña.
                </ThemedText>
                
                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Correo electrónico
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor={theme.textSecondary}
                    value={recoveryEmail}
                    onChangeText={setRecoveryEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: '#3c87f7', opacity: pressed || recoveryLoading ? 0.8 : 1 },
                  ]}
                  onPress={handleRequestCode}
                  disabled={recoveryLoading}
                >
                  {recoveryLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      Enviar Código
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            ) : (
              // PASO 2: Ingresar Código y Nueva Contraseña
              <View style={{ gap: Spacing.three }}>
                <ThemedText type="small" themeColor="textSecondary">
                  Ingresa el código de 6 dígitos enviado a tu correo y tu nueva contraseña.
                </ThemedText>

                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Código de verificación
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, textAlign: 'center', letterSpacing: 5 }]}
                    placeholder="123456"
                    placeholderTextColor={theme.textSecondary}
                    value={recoveryCode}
                    onChangeText={setRecoveryCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Nueva contraseña
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor={theme.textSecondary}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Confirmar nueva contraseña
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    placeholder="Repite la contraseña"
                    placeholderTextColor={theme.textSecondary}
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: '#3c87f7', opacity: pressed || recoveryLoading ? 0.8 : 1 },
                  ]}
                  onPress={handleResetPassword}
                  disabled={recoveryLoading}
                >
                  {recoveryLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      Restablecer Contraseña
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            )}
          </ThemedView>
        </View>
      </Modal>
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
  termsLink: {
    alignSelf: 'flex-start',
    marginTop: Spacing.three,
    paddingVertical: Spacing.one,
  },
  linkText: {
    color: '#3c87f7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  termsModalCard: {
    maxHeight: '88%',
  },
  termsContent: {
    paddingBottom: Spacing.three,
  },
  termsNotice: {
    marginBottom: Spacing.three,
    fontStyle: 'italic',
  },
  termsHeading: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  termsParagraph: {
    lineHeight: 21,
  },
  termsUpdated: {
    marginTop: Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
});
