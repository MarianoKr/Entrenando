const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

initializeApp();
const db = getFirestore();

<<<<<<< HEAD
// La API key de Anthropic se guarda como secret, nunca hardcodeada.
// Configurarla una vez con:
//   firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
=======
// La API key de Gemini se guarda como secret, nunca hardcodeada.
// Configurarla una vez con:
//   firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
>>>>>>> a1684fc1c1b7880a8bc39d96eaa955ac23f49e8d

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

/**
 * Reemplaza a la vieja función de Netlify (/.netlify/functions/ia).
 * Recibe { system, messages } desde el cliente (preguntarIA en index.html)
<<<<<<< HEAD
 * y hace de proxy hacia la API de Anthropic, para no exponer la API key
 * en el frontend.
=======
 * y hace de proxy hacia la API GRATUITA de Gemini (modelo Flash), para no
 * exponer la API key en el frontend.
>>>>>>> a1684fc1c1b7880a8bc39d96eaa955ac23f49e8d
 *
 * Pensada para llamarse vía Firebase Hosting rewrite en /api/ia (mismo
 * origen que el sitio, así no hace falta lidiar con CORS del lado cliente).
 */
exports.ia = onRequest(
<<<<<<< HEAD
  { secrets: [ANTHROPIC_API_KEY], cors: true },
=======
  { secrets: [GEMINI_API_KEY], cors: true },
>>>>>>> a1684fc1c1b7880a8bc39d96eaa955ac23f49e8d
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Método no permitido" });
      return;
    }

    const { system, messages } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: "Falta el array de messages" });
      return;
    }

<<<<<<< HEAD
    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY.value(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1000,
          system: system || undefined,
          messages,
        }),
      });

      const raw = await anthropicRes.text();

      if (!anthropicRes.ok) {
        logger.error(`Anthropic API respondió ${anthropicRes.status}: ${raw.slice(0, 500)}`);
        res.status(anthropicRes.status).json({
          error: `La API de Anthropic respondió ${anthropicRes.status}`,
=======
    // El cliente manda mensajes estilo Anthropic: {role:'user'|'assistant', content:'...'}
    // Gemini usa {role:'user'|'model', parts:[{text:'...'}]}
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));

    const MODEL = "gemini-3.6-flash"; // modelo Flash: gratis en la capa free de Google AI Studio

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY.value(),
          },
          body: JSON.stringify({
            system_instruction: system ? { parts: [{ text: system }] } : undefined,
            contents,
            generationConfig: { maxOutputTokens: 1000 },
          }),
        }
      );

      const raw = await geminiRes.text();

      if (!geminiRes.ok) {
        logger.error(`Gemini API respondió ${geminiRes.status}: ${raw.slice(0, 500)}`);
        res.status(geminiRes.status).json({
          error: `La API de Gemini respondió ${geminiRes.status}`,
>>>>>>> a1684fc1c1b7880a8bc39d96eaa955ac23f49e8d
        });
        return;
      }

<<<<<<< HEAD
      // Devolvemos tal cual el JSON de Anthropic; el cliente ya sabe
      // leer data.content.filter(x=>x.type==='text').
      res.status(200).type("application/json").send(raw);
    } catch (err) {
      logger.error("Error llamando a la API de Anthropic:", err);
=======
      const data = JSON.parse(raw);
      const texto = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("");

      // Devolvemos la respuesta con el mismo formato que ya espera el
      // cliente (el mismo shape que usaba Anthropic), así no hay que
      // tocar nada en index.html.
      res.status(200).json({ content: [{ type: "text", text: texto }] });
    } catch (err) {
      logger.error("Error llamando a la API de Gemini:", err);
>>>>>>> a1684fc1c1b7880a8bc39d96eaa955ac23f49e8d
      res.status(500).json({ error: "Error interno llamando a la IA" });
    }
  }
);
