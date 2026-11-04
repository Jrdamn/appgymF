import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Spacing } from '../constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface TermsAndConditionsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TermsAndConditionsModal({
  visible,
  onClose,
}: TermsAndConditionsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Términos y condiciones
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar términos y condiciones"
              onPress={onClose}
              style={styles.closeButton}
            >
              <ThemedText style={{ color: '#aaa', fontSize: 20 }}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={styles.content}
          >
            <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
              Documento base para Shark Gym. Debe revisarse y completarse con las políticas oficiales del gimnasio antes de su uso legal.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>1. Aceptación y alcance</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              Al crear una cuenta o utilizar la aplicación Shark Gym, aceptas estos términos. La aplicación ofrece herramientas para consultar información de membresía, rutinas de ejercicio, productos, pagos y accesos al gimnasio. El uso de las instalaciones y los servicios presenciales también está sujeto a las reglas comunicadas por Shark Gym.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>2. Cuenta y seguridad</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              Debes proporcionar información correcta y mantenerla actualizada, proteger tus credenciales y no compartir tu cuenta. Eres responsable de la actividad realizada desde ella. Si sospechas de un acceso no autorizado, contacta al personal de Shark Gym.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>3. Membresías, productos y pagos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              Los precios, duración, vigencia y condiciones aplicables se muestran antes de confirmar cada compra o son comunicados por Shark Gym. La compra queda sujeta a la confirmación del proveedor de pago y del sistema. Las consultas sobre cobros, renovaciones, cancelaciones o reembolsos deben dirigirse a Shark Gym y se atenderán conforme a las condiciones de compra y la legislación aplicable.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>4. Rutinas y actividad física</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              Las rutinas y contenidos de ejercicio son informativos y no sustituyen la valoración ni el consejo de un profesional de salud. Realiza los ejercicios según tu condición física, detente si sientes dolor o malestar y consulta a un profesional antes de comenzar si tienes dudas sobre tu salud. Sigue las instrucciones del personal y utiliza el equipo de forma segura.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>5. Uso permitido</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              No debes utilizar la aplicación para actividades ilegales, interferir con su funcionamiento, intentar acceder a cuentas o datos ajenos ni publicar información engañosa o dañina. El acceso a funciones administrativas está limitado a las personas autorizadas por Shark Gym.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>6. Disponibilidad y notificaciones</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              Algunas funciones requieren conexión a internet y permisos del dispositivo. La entrega de notificaciones depende de la configuración del dispositivo, la red y los servicios de terceros; por ello, no se garantiza que cada aviso llegue inmediatamente. Shark Gym puede actualizar o interrumpir funciones para mantenimiento o mejoras.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>7. Privacidad</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              El tratamiento de datos personales debe explicarse en un aviso de privacidad separado. Estos términos no sustituyen dicho aviso. Antes de publicar la aplicación, Shark Gym debe completar y poner a disposición su política de privacidad y los medios de contacto correspondientes.
            </ThemedText>

            <ThemedText type="smallBold" style={styles.heading}>8. Cambios y contacto</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              Shark Gym puede actualizar estos términos; la versión vigente estará disponible en la aplicación. Para consultas sobre la cuenta, pagos o estos términos, comunícate directamente con el personal de Shark Gym por los canales oficiales del gimnasio.
            </ThemedText>

            <ThemedText type="small" themeColor="textSecondary" style={styles.updated}>
              Última actualización: 31 de octubre de 2026.
            </ThemedText>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  title: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
  },
  closeButton: {
    padding: Spacing.one,
  },
  content: {
    paddingBottom: Spacing.three,
  },
  notice: {
    marginBottom: Spacing.three,
    fontStyle: 'italic',
  },
  heading: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  paragraph: {
    lineHeight: 21,
  },
  updated: {
    marginTop: Spacing.four,
  },
});
