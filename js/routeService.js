// RouteService — invoca la Edge Function compute-pet-route (Google Routes API server-side).
const RouteService = (function () {
  // origin: {lat, lon} | stops: [{ id, lat, lon }] | optimize: boolean
  async function computeRoute(origin, stops, optimize) {
    if (!window.sb) throw new Error('Sin conexión a Supabase — configura js/config.js (ver README).');
    if (!stops || stops.length === 0) throw new Error('Selecciona al menos una mascota.');

    const payload = {
      origin: { latitude: origin.lat, longitude: origin.lon },
      stops: stops.map((s) => ({ petId: s.id, latitude: s.lat, longitude: s.lon })),
      optimize: !!optimize
    };

    const { data, error } = await window.sb.functions.invoke('compute-pet-route', { body: payload });
    if (error) {
      const detail = await extractFunctionError(error);
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data; // { order, distanceMeters, durationSeconds, legs, polyline, warnings }
  }

  async function extractFunctionError(error) {
    try {
      if (error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        if (body?.error) return body.error;
      }
    } catch (_) {}
    return error.message || 'No se pudo calcular la ruta (Edge Function compute-pet-route).';
  }

  return { computeRoute };
})();
