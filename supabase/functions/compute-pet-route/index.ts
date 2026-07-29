// Supabase Edge Function: compute-pet-route
//
// Recibe un origen + una lista de paradas (mascotas) y devuelve una ruta real
// calculada con Google Routes API (computeRoutes). La llave GOOGLE_ROUTES_API_KEY
// vive solo aquí (variable de entorno de la función) — nunca se expone al navegador.
//
// Body esperado:
// {
//   "origin": { "latitude": number, "longitude": number },
//   "stops": [ { "petId": string|number, "latitude": number, "longitude": number }, ... ],
//   "optimize": boolean
// }
//
// Respuesta:
// {
//   "order": [petId, ...],            // orden final de paradas (destino incluido, al final)
//   "distanceMeters": number,
//   "durationSeconds": number,
//   "legs": [{ "distanceMeters": number, "durationSeconds": number }, ...],
//   "polyline": string,
//   "warnings": string[]
// }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
// Algunas organizaciones de Google Cloud fuerzan una restricción de llave y
// quitan la opción "Ninguna". Como esta función no tiene una IP fija que
// registrar, la llave queda restringida por "Sitios web" y aquí simulamos ese
// referrer — debe coincidir exactamente con el patrón dado de alta en la llave.
const GOOGLE_REFERER = `${Deno.env.get('SUPABASE_URL') || 'https://rekegzxcypltnlxhsevc.supabase.co'}/`;
const FIELD_MASK =
  'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.optimizedIntermediateWaypointIndex,routes.warnings';
const MAX_INTERMEDIATE_WAYPOINTS = 25; // límite documentado de Google Routes API
const REQUEST_TIMEOUT_MS = 15000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

function isValidLatLng(lat: unknown, lng: unknown) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

function parseDurationSeconds(duration: unknown): number {
  // Google devuelve duraciones como string "1234s"
  if (typeof duration !== 'string') return 0;
  const n = parseFloat(duration.replace('s', ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido. Usa POST.' }, 405);
  }

  const apiKey = Deno.env.get('GOOGLE_ROUTES_API_KEY');
  if (!apiKey) {
    return jsonResponse(
      { error: 'Falta configurar GOOGLE_ROUTES_API_KEY en los secrets de la función.' },
      500
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Body inválido: se esperaba JSON.' }, 400);
  }

  const origin = payload?.origin;
  const stops = payload?.stops;
  const optimize = !!payload?.optimize;

  if (!origin || !isValidLatLng(origin.latitude, origin.longitude)) {
    return jsonResponse({ error: 'Coordenadas de origen inválidas o faltantes.' }, 400);
  }
  if (!Array.isArray(stops) || stops.length === 0) {
    return jsonResponse({ error: 'Se requiere al menos una parada.' }, 400);
  }
  for (const s of stops) {
    if (!isValidLatLng(s?.latitude, s?.longitude)) {
      return jsonResponse(
        { error: `Coordenadas inválidas en la parada ${s?.petId ?? '(sin id)'}.` },
        400
      );
    }
  }
  if (stops.length - 1 > MAX_INTERMEDIATE_WAYPOINTS) {
    return jsonResponse(
      { error: `Demasiadas paradas (${stops.length}). Máximo soportado: ${MAX_INTERMEDIATE_WAYPOINTS + 1}.` },
      400
    );
  }

  // La última parada se usa como "destino" (no se reordena); el resto son
  // intermedias. Es una simplificación intencional para v1 (sin solver de
  // ventanas de tiempo): igual que el botón "Abrir en Google Maps" original,
  // el punto final de la ruta es la última parada de la lista.
  const destination = stops[stops.length - 1];
  const intermediates = stops.slice(0, -1);

  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
    destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    polylineQuality: 'OVERVIEW'
  };
  if (intermediates.length > 0) {
    body.intermediates = intermediates.map((s: any) => ({
      location: { latLng: { latitude: s.latitude, longitude: s.longitude } }
    }));
    if (optimize) body.optimizeWaypointOrder = true;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let googleRes: Response;
  try {
    googleRes = await fetch(ROUTES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
        'Referer': GOOGLE_REFERER
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === 'AbortError') {
      return jsonResponse({ error: 'Tiempo de espera agotado al consultar Google Routes API.' }, 504);
    }
    return jsonResponse({ error: 'No se pudo conectar con Google Routes API: ' + (err as Error).message }, 502);
  }
  clearTimeout(timeout);

  if (!googleRes.ok) {
    let detail = '';
    try {
      const errBody = await googleRes.json();
      detail = errBody?.error?.message || JSON.stringify(errBody);
    } catch {
      detail = await googleRes.text();
    }
    return jsonResponse({ error: `Google Routes API respondió ${googleRes.status}: ${detail}` }, 502);
  }

  let data: any;
  try {
    data = await googleRes.json();
  } catch {
    return jsonResponse({ error: 'Respuesta de Google Routes API no es JSON válido.' }, 502);
  }

  const route = data?.routes?.[0];
  if (!route) {
    return jsonResponse({ error: 'No se encontró una ruta posible entre los puntos indicados.' }, 422);
  }
  if (route.distanceMeters == null || route.duration == null) {
    return jsonResponse({ error: 'Respuesta incompleta de Google Routes API (faltan distancia/duración).' }, 502);
  }

  // Reconstruir el orden final: índices de `intermediates` en el orden óptimo + destino al final.
  const optimizedIdx: number[] | undefined = route.optimizedIntermediateWaypointIndex;
  let intermediateOrder: number[];
  if (optimize && Array.isArray(optimizedIdx) && optimizedIdx.length === intermediates.length) {
    intermediateOrder = optimizedIdx;
  } else {
    intermediateOrder = intermediates.map((_: unknown, i: number) => i);
  }
  const order = [...intermediateOrder.map((i) => intermediates[i].petId), destination.petId];

  const legs = Array.isArray(route.legs)
    ? route.legs.map((leg: any) => ({
        distanceMeters: leg.distanceMeters ?? 0,
        durationSeconds: parseDurationSeconds(leg.duration)
      }))
    : [];

  const warnings: string[] = Array.isArray(route.warnings) ? route.warnings : [];
  if (legs.length !== stops.length) {
    warnings.push('El número de tramos devueltos no coincide con el número de paradas; revisa la ruta manualmente.');
  }

  return jsonResponse({
    order,
    distanceMeters: route.distanceMeters,
    durationSeconds: parseDurationSeconds(route.duration),
    legs,
    polyline: route.polyline?.encodedPolyline || null,
    warnings
  });
});
