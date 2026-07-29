// RouteRepository — persistencia de `rutas` y `ruta_paradas`.
// Solo se escribe en Supabase cuando el usuario confirma "Iniciar ruta"; antes de
// eso, la ruta calculada vive en memoria (AppState.reviewData).
const RouteStore = (function () {
  const LS_KEY = 'pg_active_route_id';

  function requireClient() {
    if (!window.sb) throw new Error('Sin conexión a Supabase — configura js/config.js (ver README).');
  }

  async function crearRutaConParadas({ tipo, origen, distanciaTotalMetros, duracionTotalSegundos, polyline, paradas }) {
    requireClient();
    const { data: ruta, error: errRuta } = await window.sb
      .from('rutas')
      .insert({
        tipo,
        estado: 'en_curso',
        origen_lat: origen.lat,
        origen_lng: origen.lon,
        distancia_total_metros: distanciaTotalMetros,
        duracion_total_segundos: duracionTotalSegundos,
        polyline: polyline || null,
        iniciada_at: new Date().toISOString()
      })
      .select()
      .single();
    if (errRuta) throw errRuta;

    const rows = paradas.map((p) => ({
      ruta_id: ruta.id,
      mascota_id: p.mascotaId,
      orden: p.orden,
      estado: 'pendiente',
      distancia_desde_anterior_metros: p.distanciaMetros,
      duracion_desde_anterior_segundos: p.duracionSegundos,
      llegada_estimada: p.llegadaEstimada ? p.llegadaEstimada.toISOString() : null,
      checklist: {},
      latitud_snapshot: p.lat,
      longitud_snapshot: p.lon,
      direccion_snapshot: p.direccion || ''
    }));
    const { data: paradasData, error: errParadas } = await window.sb.from('ruta_paradas').insert(rows).select();
    if (errParadas) throw errParadas;

    setActiveRouteId(ruta.id);
    return { ruta, paradas: paradasData };
  }

  async function getRutaConParadas(rutaId) {
    requireClient();
    const [{ data: ruta, error: errRuta }, { data: paradas, error: errParadas }] = await Promise.all([
      window.sb.from('rutas').select('*').eq('id', rutaId).single(),
      window.sb.from('ruta_paradas').select('*').eq('ruta_id', rutaId).order('orden', { ascending: true })
    ]);
    if (errRuta) throw errRuta;
    if (errParadas) throw errParadas;
    return { ruta, paradas: paradas || [] };
  }

  async function updateParada(id, patch) {
    requireClient();
    const { data, error } = await window.sb.from('ruta_paradas').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function updateRuta(id, patch) {
    requireClient();
    const { data, error } = await window.sb.from('rutas').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  function setActiveRouteId(id) {
    try { localStorage.setItem(LS_KEY, String(id)); } catch (_) {}
  }
  function getActiveRouteId() {
    try { return localStorage.getItem(LS_KEY); } catch (_) { return null; }
  }
  function clearActiveRouteId() {
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
  }

  return {
    crearRutaConParadas,
    getRutaConParadas,
    updateParada,
    updateRuta,
    setActiveRouteId,
    getActiveRouteId,
    clearActiveRouteId
  };
})();
