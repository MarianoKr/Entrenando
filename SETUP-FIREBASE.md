# Puesta en marcha de Firebase — Fase 0 + Fase 1

Ya escribí todo el código (login/registro en la app, reglas de seguridad, Cloud
Functions). Lo que sigue son pasos que **solo vos podés hacer**, porque
requieren tu cuenta de Google y no tengo acceso a tu consola de Firebase.

## 1. Crear el proyecto

1. Andá a https://console.firebase.google.com → **Agregar proyecto**.
2. Nombre sugerido: `gymwork` (o el que prefieras). Google Analytics: opcional, no lo necesitamos.
3. Dentro del proyecto, click en el ícono **`</>`** ("Agregar app" → Web) para registrar la app web.
4. Te va a mostrar un bloque `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`. **Copialo.**

## 2. Pegar la configuración en el código

Abrí `index.html`, buscá el comentario:
```js
// ═══ TODO: reemplazá esto con la config de TU proyecto ═══
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  ...
```
y reemplazá esos valores por los que copiaste en el paso 1. Esta clave `apiKey`
**no es secreta** (identifica el proyecto, no autoriza nada por sí sola) —
la seguridad real la dan las reglas de Firestore/Storage, que ya están escritas.

## 3. Habilitar los servicios en la consola

Dentro de tu proyecto en Firebase Console:

- **Authentication** → pestaña "Sign-in method" → habilitar **Email/contraseña**.
- **Firestore Database** → **Crear base de datos** → modo **producción** → elegir región (recomendado: `southamerica-east1` si tus usuarios son de Argentina/región cercana, por latencia).
- **Storage** → **Comenzar** → modo producción, misma región.
- **Upgrade a plan Blaze** (Configuración del proyecto → Uso y facturación): **es obligatorio para Cloud Functions**. El plan sigue siendo gratuito hasta pasar cuotas muy altas (2M invocaciones/mes gratis) — para esta app, con cientos o pocos miles de usuarios, es muy improbable que pagues algo mientras no factures.

## 4. Instalar Firebase CLI y conectar el proyecto

En tu computadora, dentro de la carpeta `firebase-project` que te entrego:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # elegí tu proyecto de la lista, alias "default"
```

## 5. Copiar la app dentro de la carpeta `public`

Firebase Hosting sirve lo que esté en la carpeta `public/`:

```bash
mkdir public
cp /ruta/a/tu/index.html public/index.html
```

## 6. Instalar dependencias de las Cloud Functions

```bash
cd functions
npm install
cd ..
```

## 7. Desplegar todo

```bash
firebase deploy
```

Esto sube en un solo comando: Hosting (la app), Firestore rules + índices,
Storage rules, y las 2 Cloud Functions (`asignarRolClaim`, `recalcularStats`).

Al terminar te va a dar una URL tipo `https://gymwork-xxxx.web.app` — ahí ya
está la app funcionando con login real.

## 8. Probar

1. Abrí la URL, registrate como "Alumno", completá el onboarding.
2. En Firebase Console → Firestore Database, deberías ver la colección
   `usuarios` con un documento nuevo.
3. En Authentication → Users, deberías ver la cuenta creada.
4. (Opcional, para confirmar el custom claim) En Firestore, el documento del
   usuario tiene `rol: "alumno"`. Los claims no se ven en la consola, pero
   podés confirmarlos corriendo en la consola del navegador, ya logueado:
   `await firebase.auth().currentUser.getIdTokenResult()` → mirá `claims.rol`.
   *(Si usás la versión modular como la que escribí, es
   `(await window.fbAuth.currentUser.getIdTokenResult()).claims`.)*

## 9. Dominio propio (opcional)

Si querés seguir usando `rutinas2026.netlify.app` (o un dominio propio) en vez
de `.web.app`: Hosting → Agregar dominio personalizado → seguir las
instrucciones de verificación DNS. Podés tener Netlify y Firebase Hosting
apuntando al mismo dominio en paralelo mientras probás, y recién ahí apagar Netlify.

## Qué falta después de esto (ya lo tenemos planeado, no lo hacemos hoy)

- Migrar el historial/ejercicios que ya tenga guardados un usuario en su
  `localStorage` hacia Firestore la primera vez que se loguea (Fase 2).
- Pantalla de profesor: lista de alumnos y asignación de rutinas (Fase 4).
- Storage para foto de perfil y notificaciones push (Fase 5).

Avisame cuando tengas el proyecto creado y la config pegada, y seguimos con la Fase 2.
