# 🐱 MeowBase - Aplicación Móvil Expo

Este archivo contiene la documentación técnica del proyecto, comandos de construcción y el estado de desarrollo actual para guiar a futuros agentes de IA o desarrolladores.

## 🛠️ Comandos de Desarrollo

### Ejecutar el Proyecto
```bash
# Iniciar servidor de desarrollo de Expo
npx expo start

# Iniciar directamente en Web
npx expo start --web

# Iniciar directamente en Android (requiere emulador encendido)
npx expo start --android

# Iniciar directamente en iOS (requiere macOS)
npx expo start --ios
```

### Limpiar Cache (Útil si hay errores de sincronización)
```bash
npx expo start --clear
```

---

## 🏛️ Arquitectura del Proyecto

* **`/src/app/`**: Sistema de enrutamiento basado en archivos (Expo Router).
  * `_layout.tsx`: Layout principal. Controla si el usuario va al flujo de autenticación o al panel de pestañas (`AppTabs`) dependiendo de su estado de autenticación.
  * `index.tsx`: Pantalla principal (Home) mostrada tras iniciar sesión. Muestra datos del perfil y botón de cerrar sesión.
  * `explore.tsx`: Pantalla de gestión de usuarios ("Shark Users") que lista los usuarios consumiendo la API del backend.
* **`/src/components/`**: Componentes reutilizables de UI.
  * `LoginScreen.tsx`: Pantalla y formulario de inicio de sesión.
  * `RegisterScreen.tsx`: Pantalla y formulario de creación de cuenta.
  * `themed-view.tsx` y `themed-text.tsx`: Componentes adaptables al tema claro/oscuro.
  * `web-badge.tsx`: Indicador flotante para desarrollo en la web.
* **`/src/context/`**:
  * `AuthContext.tsx`: Proveedor de estado global de autenticación. Controla el login, registro, logout y persiste el token de seguridad.
* **`/src/services/`**:
  * `api.ts`: Cliente de red usando Axios. Apunta a la IP local del backend en el puerto `3000`.

---

## 📝 Cambios Recientes (Bitácora de Desarrollo)

1. **Corrección de Almacenamiento en Web:**
   * Se abstrajeron las llamadas de `expo-secure-store` (que no es compatible con navegadores) mediante funciones adaptables que hacen fallback a `window.localStorage` en la Web y usan `SecureStore` nativo en móviles.
 2. **Diseño de Fondo Personalizado:**
    * Se configuró la imagen gráfica de Shark Gym (`background-shark.jpg`) como fondo con `ImageBackground` y `resizeMode="cover"` en las pantallas de login, registro, inicio y las secciones de la app.
    * Se configuró el color `#121212` (gris oscuro/negro) como fondo plano de respaldo.
 3. **Mejoras de Visibilidad:**
    * Se cambiaron los colores de texto de los títulos y subtítulos del encabezado en `HomeScreen` y `UserManagementScreen` a **color blanco / gris claro** para garantizar legibilidad óptima sobre el fondo oscuro.
    * Se eliminó el fondo opaco de la etiqueta de la versión (`WebBadge`), haciéndola transparente.
 4. **Renombramiento del Proyecto:**
    * Se cambió el título de la pantalla de gestión de usuarios a **`"Shark Users"`** para adaptarlo al nuevo tema.

---

## 🔌 Integración con el Backend
* El cliente Axios apunta a: `http://192.168.100.2:3000/api/v1` (modificable en [api.ts](file:///c:/Users/jorda/Documents/IV%20Gen/login_app/src/services/api.ts)).
* **Endpoints consumidos:**
  * `POST /auth/login` - Inicio de sesión (Retorna token JWT y datos de usuario).
  * `POST /auth/register` - Registro de usuario nuevo.
  * `GET /auth/profile` - Verificación del perfil con el token JWT.
  * `GET /users` - Lista de usuarios registrados (se muestra en la pantalla "Shark Users").
