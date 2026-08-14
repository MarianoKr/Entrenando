const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

initializeApp();
const db = getFirestore();

// La API key de Gemini se guarda como secret, nunca hardcodeada.
// Configurarla una vez con:
//   firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/**
 * Fase 1 — Al crearse usuarios/{uid} (lo hace fbRegistrar en el cliente),
 * copia el campo "rol" como Custom Claim del token de Auth.
 * Esto permite que firestore.rules y storage.rules lean el rol con
 * request.auth.token.rol sin necesidad de un get() extra a Firestore.
 *
 * El usuario tiene que volver a loguearse (o refrescar el token con
 * user.getIdToken(true)) una vez para que el claim nuevo esté disponible
 * en el cliente — es una limitación normal de Firebase Auth.
 */
exports.asignarRolClaim = onDocumentCreated("usuarios/{uid}", async (event) => {
  const data = event.data?.data();
  const uid = event.params.uid;
  if (!data || !data.rol) {
    logger.warn(`usuarios/${uid} creado sin campo "rol", no se asigna claim.`);
    return;
  }
  const rolesValidos = ["alumno", "profesor", "admin"];
  const rol = rolesValidos.includes(data.rol) ? data.rol : "alumno";
  await getAuth().setCustomUserClaims(uid, { rol });
  logger.info(`Custom claim rol="${rol}" asignado a ${uid}`);
});

/**
 * Fase 3 — Cada vez que se cierra un día (nuevo doc en historial),
 * recalcula estadísticas agregadas en usuarios/{uid}.statsAgregadas
 * para que la pantalla de progreso lea 1 documento en vez de todo
 * el historial cada vez que se abre.
 */
exports.recalcularStats = onDocumentCreated(
  "usuarios/{uid}/historial/{sesionId}",
  async (event) => {
    const uid = event.params.uid;
    const historialRef = db.collection("usuarios").doc(uid).collection("historial");

    // Últimas 60 sesiones alcanzan para racha + balance muscular de 30 días,
    // sin tener que leer el historial completo de un usuario con años de datos.
    const snap = await historialRef.orderBy("fecha", "desc").limit(60).get();
    const sesiones = snap.docs.map((d) => d.data());

    // Racha de días consecutivos
    const fechas = [...new Set(sesiones.map((s) => s.fecha))].sort().reverse();
    const hoy = new Date().toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let racha = 0;
    if (fechas[0] === hoy || fechas[0] === ayer) {
      racha = 1;
      for (let i = 0; i < fechas.length - 1; i++) {
        const d1 = new Date(fechas[i] + "T12:00:00");
        const d2 = new Date(fechas[i + 1] + "T12:00:00");
        if (Math.round((d1 - d2) / 86400000) === 1) racha++;
        else break;
      }
    }

    // Balance muscular de los últimos 30 días
    const desde = Date.now() - 30 * 86400000;
    const freq = {};
    sesiones
      .filter((s) => new Date(s.fecha + "T12:00:00").getTime() >= desde)
      .forEach((s) => (s.ejercicios || []).forEach((e) => {
        freq[e.grupo] = (freq[e.grupo] || 0) + 1;
      }));

    await db.collection("usuarios").doc(uid).set(
      {
        statsAgregadas: {
          racha,
          totalSesiones: FieldValue.increment(1),
          ultimaFecha: sesiones[0]?.fecha || null,
          balanceMuscular: freq,
          actualizadoEn: new Date().toISOString(),
        },
      },
      { merge: true }
    );
  }
);
