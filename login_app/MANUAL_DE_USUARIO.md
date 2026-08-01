# Manual de Usuario - Shark Gym

Este documento contiene la guía de uso de la aplicación Shark Gym. Describe las funcionalidades de cada módulo según los diferentes roles de acceso y detalla las capturas de pantalla requeridas para completar la documentación.

---

## Indice de Contenidos
1. Introduccion y Roles de Usuario
2. Modulos de la Aplicacion
   * Pantalla de Inicio de Sesion y Registro
   * Dashboard Principal
   * Control de Accesos y Codigo QR
   * Gestion de Rutinas y Reproductor Animado
   * Tienda Virtual y Carrito de Compras
   * Perfil del Usuario y Ajustes Fisicos
   * Planes y Metodos de Pago
3. Guia de Configuracion del Sistema

---

## Introducción y Roles de Usuario
La aplicacion opera bajo tres perfiles de usuario, cada uno con funciones especificas dentro de la plataforma:

* **Cliente / Miembro**: Usuario final orientado al entrenamiento. Tiene acceso a su pase digital QR, rutinas locales y asignadas por su entrenador, catalogo de productos de la tienda, registro fisico personal y configuracion de metodos de pago.
* **Coach / Entrenador**: Encargado del seguimiento deportivo. Puede ver la cantidad de clientes ingresados al gimnasio, consultar el listado de miembros y asignarles rutinas personalizadas de entrenamiento.
* **Administrador**: Encargado del control global. Cuenta con metricas de ventas, descarga de reportes financieros, control de inventario de la tienda y administracion general de accesos.

---

## Modulos de la Aplicacion

### Pantalla de Inicio de Sesión y Registro
Permite el acceso al sistema mediante credenciales de correo electronico y contraseña. Los nuevos clientes pueden registrarse ingresando su nombre, telefono, correo y contraseña. Los roles de Administrador y Coach estan restringidos para registro publico y se preconfiguran en el servidor.

**Funcionalidades Clave**:
* Validacion en tiempo real de campos vacios o formatos incorrectos.
* Creacion de cuentas exclusivas de cliente.
* Persistencia segura de credenciales de inicio de sesion.

![Pantalla de Login y Registro](./manual_media/login_registro.png)

---

### Dashboard Principal
Pantalla de inicio que adapta sus opciones y metricas segun el rol del usuario autenticado:
1. **Vista de Cliente**: Presenta un saludo al usuario con su nombre y muestra el estado de su membresia (Activa o Inactiva) junto con accesos rapidos.
2. **Vista de Coach**: Muestra el contador de personas entrenando hoy dentro del gimnasio y permite buscar en la lista de clientes.
3. **Vista de Administrador**: Incluye graficos y metricas de ventas en colones, el contador de visitas diarias, alertas de inventario bajo y el boton para descargar reportes en PDF.

![Dashboard Principal](./manual_media/dashboard.png)

---

### Control de Accesos y Código QR
Modulo de seguridad para registrar el ingreso y salida del gimnasio en tiempo real:
1. **Pase Digital**: El cliente visualiza un codigo QR dinamico generado por el sistema y su estado actual (Fuera del gimnasio o Entrenando).
2. **Escaner Integrado**: El Coach o Administrador abre la camara dentro de la aplicacion para escanear el QR del cliente, registrando el timestamp de entrada o salida.
3. **Escaneo Externo**: Si el QR es escaneado por una camara convencional, se abre un portal web en el navegador del dispositivo que solicita el PIN de recepcion (1234) para validar y registrar la visita de forma segura.

![Modulo de Accesos QR](./manual_media/accesos_qr.png)

---

### Gestión de Rutinas y Reproductor Animado
Facilita la asignacion y ejecucion de rutinas deportivas:
1. **Creador y Asignador**: El Coach selecciona un cliente de su lista y le asigna una rutina personalizada eligiendo ejercicios de una lista en español organizada por grupos musculares (Pecho, Espalda, Pierna, etc.).
2. **Notificaciones**: Al guardarse una rutina, el cliente recibe una notificacion flotante dentro de la aplicacion y un correo de confirmacion.
3. **Reproductor paso a paso**: El cliente inicia la rutina y visualiza una guia interactiva que contiene la animacion en formato GIF del ejercicio, series, repeticiones, peso y una barra de progreso.

![Gestion de Rutinas y Reproductor](./manual_media/rutinas_reproductor.png)

---

### Tienda Virtual y Carrito de Compras
Punto de venta y comercio electronico de suplementacion deportiva:
1. **Compra del Cliente**: Catalogo de suplementos con tarjetas visuales, control de stock y carrito de compras integrado. Al completar el pago, el cliente recibe un comprobante PDF con precios en colones (₡).
2. **Punto de Venta Administrativo**: El Administrador puede realizar ventas directas en recepcion y actualizar cantidades o precios del inventario.

![Tienda Virtual Shark Store](./manual_media/tienda_store.png)

---

### Perfil del Usuario y Ajustes Físicos
Permite a los usuarios gestionar su informacion personal y fisica:
* **Ficha Fisica**: Campos dedicados para actualizar el peso (kg) y la estatura (cm).
* **Foto Circular**: El usuario puede subir una foto personalizada desde la galeria de su celular (utilizando expo-image-picker con compresion Base64) o seleccionar uno de los avatares preestablecidos de atletas.

![Modulo de Perfil y Ajustes](./manual_media/perfil_ajustes.png)

---

### Planes y Métodos de Pago
Modulo para habilitar el pase digital de acceso:
* **Adquisicion de Membresias**: Opciones para comprar pases diarios, mensuales o anuales.
* **Tarjetas Bancarias**: Formulario de registro seguro con mascara de entrada y enmascaramiento.
* **PayPal**: Al presionar vincular cuenta, se despliega el portal de PayPal en el navegador del dispositivo para simular el inicio de sesion. Al volver al app, el correo se registra de forma automatica.

![Planes y Metodos de Pago](./manual_media/planes_pagos.png)

---

## Guía de Configuración del Sistema

### Variables de Entorno del Servidor (.env)
El backend requiere la siguiente estructura de variables en su archivo de configuracion:
```bash
PORT=3000
JWT_SECRET=gym_secret_key_2026
SCANNER_PIN=1234
DB_HOST=localhost
DB_PORT=3306
DB_NAME=usuarios_gym
```

### Credenciales de Acceso por Defecto para Pruebas

| Rol | Correo Electronico | Contraseña |
| :--- | :--- | :--- |
| Administrador | `admin@correo.com` | `admin123` |
| Coach / Entrenador | `coach@correo.com` | `coach123` |
| Cliente / Miembro | `cliente@correo.com` | `cliente123` |
