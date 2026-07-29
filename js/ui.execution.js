// UI: pantalla de ejecución de ruta, enfocada en la parada actual.
const UIExecution = (function () {
  const ARRIVAL_RADIUS_METERS = 30;
  const INCIDENT_TYPES = ['Dirección incorrecta', 'Mascota agresiva', 'Retraso', 'Otra'];
  const WHATSAPP_TEMPLATES = [
    { label: 'Ya llegamos', text: 'Ya llegamos por tu mascota.' },
    { label: 'A 5 minutos', text: 'Estamos a 5 minutos.' },
    { label: 'No encontramos', text: 'No encontramos la dirección.' }
  ];
  let watchId = null;
  let lastPosition = null;
  let currentStopDest = null; // { lat, lon } — usado para refrescar el mini-mapa cuando llega una nueva posición GPS

  function sortedParadas(route) {
    return [...route.paradas].sort((a, b) => a.orden - b.orden);
  }
  function currentParada(route) {
    return sortedParadas(route).find((p) => p.estado === 'pendiente' || p.estado === 'en_curso') || null;
  }

  async function render() {
    const route = AppState.activeRoute;
    const container = document.getElementById('stage-ejecucion');
    if (!route) {
      container.innerHTML = '';
      return;
    }
    const parada = currentParada(route);
    if (!parada) {
      renderCompleted(route);
      return;
    }
    if (parada.estado === 'pendiente') {
      parada.estado = 'en_curso';
      RouteStore.updateParada(parada.id, { estado: 'en_curso' }).catch(() => {});
    }
    await renderCurrentStop(route, parada);
  }

  async function renderCurrentStop(route, parada) {
    const container = document.getElementById('stage-ejecucion');
    const pet = parada.pet || {};
    const ordered = sortedParadas(route);
    const position = ordered.findIndex((p) => p.id === parada.id) + 1;
    const total = ordered.length;
    const checklist = parada.checklist || {};
    const lat = parada.latitud_snapshot != null ? parada.latitud_snapshot : pet.lat;
    const lon = parada.longitud_snapshot != null ? parada.longitud_snapshot : pet.lon;
    const address = parada.direccion_snapshot || pet.address || 'Sin dirección';
    const waPhone = formatPhoneForWhatsapp(pet.phone1);
    const distKm = parada.distancia_desde_anterior_metros != null ? (parada.distancia_desde_anterior_metros / 1000).toFixed(1) : '—';
    const durMin = parada.duracion_desde_anterior_segundos != null ? Math.round(parada.duracion_desde_anterior_segundos / 60) : '—';

    container.innerHTML = `
      <div class="exec-progress">Parada ${position} de ${total}</div>
      <div class="exec-progress-bar"><div class="exec-progress-fill" style="width:${(position / total) * 100}%"></div></div>

      <div class="exec-photo-wrap" id="exec-photo-mascota"><span class="pet-thumb-fallback">🐶</span></div>
      <div class="exec-name">${esc(pet.name || 'Mascota')}</div>
      <div class="exec-owner">${esc(pet.owner || 'Sin propietario')}</div>
      <div class="exec-travel">📍 ${distKm} km · ⏱ ${durMin} min desde la parada anterior</div>

      <div class="exec-map" id="exec-map"><span class="pet-thumb-fallback">🗺️</span></div>
      <div id="exec-map-hint"></div>

      <div class="exec-call-row">
        ${pet.phone1 ? `<a class="btn-call" href="tel:${esc(pet.phone1)}">📞 Llamar</a>` : '<span class="btn-call" style="opacity:.4">📞 Sin teléfono</span>'}
        ${waPhone ? `<button class="btn-whatsapp" id="exec-wa-toggle" type="button">💬 WhatsApp</button>` : '<span class="btn-whatsapp" style="opacity:.4">💬 Sin WhatsApp</span>'}
      </div>
      <div id="exec-wa-templates" class="exec-wa-templates" style="display:none">
        ${WHATSAPP_TEMPLATES.map((t, i) => `<button type="button" class="btn-sm" data-wa-idx="${i}">${esc(t.label)}</button>`).join('')}
      </div>

      <div class="section-label">Dirección</div>
      <div class="profile-text">${esc(address)}</div>
      ${pet.referencias ? `<div class="section-label">Referencias</div><div class="profile-text">${esc(pet.referencias)}</div>` : ''}

      <div class="exec-photo-wrap-lg" id="exec-photo-fachada"><span>🏠 Fachada</span></div>
      <div class="exec-photo-wrap-lg" id="exec-photo-acceso"><span>🚪 Acceso</span></div>

      ${pet.notas ? `<div class="section-label">Notas</div><div class="profile-text">${esc(pet.notas)}</div>` : ''}

      <div class="section-label">Checklist</div>
      <div class="exec-checklist">
        ${checklistItem('marque_cliente', '📞 Marqué al cliente', checklist)}
        ${checklistItem('abri_navegacion', '🧭 Abrí navegación', checklist)}
        ${checklistItem('llegue', '📍 Llegué', checklist)}
        ${checklistItem('mascota_abordo', '🐾 Mascota a bordo', checklist)}
      </div>

      <div class="section-label">GPS</div>
      <div class="exec-gps-row">
        <button class="btn-sm" id="exec-gps-toggle" type="button">${watchId ? '🛰️ Desactivar seguimiento' : '🛰️ Activar seguimiento'}</button>
        <span id="exec-gps-status" class="exec-gps-status"></span>
      </div>

      <button class="btn-maps" id="exec-btn-navegar" style="width:100%;margin-top:14px">🧭 Navegar a esta parada</button>
      <button class="btn-optimize" id="exec-btn-estoy-aqui" style="margin-top:10px">📍 Estoy aquí</button>
      <button class="btn-save" id="exec-btn-completar" style="margin-top:10px">✅ Completar parada</button>
      <button class="btn-cancel" id="exec-btn-no-salio" style="margin-top:10px;color:var(--red);border-color:#fecaca">🚫 No salió</button>

      <div class="section-label">Reportar incidencia</div>
      <div class="exec-incident-chips">
        ${INCIDENT_TYPES.map((t) => `<button type="button" class="btn-sm exec-incident-chip" data-incident="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
      <div id="exec-status" class="exec-status"></div>
    `;

    wireCurrentStopEvents(route, parada, lat, lon, waPhone, pet);
    hydratePhotos(pet);
    currentStopDest = lat != null && lon != null ? { lat, lon } : null;
    if (currentStopDest) renderExecMap(currentStopDest.lat, currentStopDest.lon);
  }

  // Mini-mapa con la posición del chofer + la parada actual y la ruta de manejo entre
  // ambos. Referencia visual rápida; para navegación con voz se usa el botón "Navegar".
  async function renderExecMap(destLat, destLon) {
    const container = document.getElementById('exec-map');
    if (!container) return;
    if (!MapsService.isConfigured()) {
      container.innerHTML = '<div class="hint-box">🗺️ Configura GOOGLE_MAPS_BROWSER_KEY para ver el mapa aquí.</div>';
      return;
    }
    try {
      const driverPos = lastPosition ? { lat: lastPosition.coords.latitude, lon: lastPosition.coords.longitude } : null;
      const center = driverPos || { lat: destLat, lon: destLon };
      await MapsService.createMap(container, { lat: center.lat, lng: center.lon });
      const points = [{ lat: destLat, lon: destLon, label: 'Parada actual', status: 'current' }];
      if (driverPos) points.push({ lat: driverPos.lat, lon: driverPos.lon, label: 'Tú', status: 'origin' });
      MapsService.renderMarkers(points);
      const hint = document.getElementById('exec-map-hint');
      if (driverPos) {
        await MapsService.drawDrivingRoute(driverPos, { lat: destLat, lon: destLon });
        if (hint) hint.innerHTML = '';
      } else if (hint) {
        hint.innerHTML = '<div class="hint-box">Activa el seguimiento GPS para ver la ruta desde tu posición.</div>';
      }
    } catch (e) {
      container.innerHTML = `<div class="hint-box">No se pudo cargar el mapa: ${esc(e.message)}</div>`;
    }
  }

  function checklistItem(key, label, checklist) {
    return `
      <label class="exec-check-row">
        <input type="checkbox" data-check="${key}" ${checklist[key] ? 'checked' : ''}>
        <span>${label}</span>
      </label>`;
  }

  async function hydratePhotos(pet) {
    const map = [
      ['exec-photo-mascota', pet.fotoMascotaPath, '🐶'],
      ['exec-photo-fachada', pet.fotoFachadaPath, '🏠 Fachada'],
      ['exec-photo-acceso', pet.fotoAccesoPath, '🚪 Acceso']
    ];
    for (const [elId, path, fallback] of map) {
      if (!path) continue;
      const url = await StorageService.getSignedUrl(path);
      const el = document.getElementById(elId);
      if (el && url) el.innerHTML = `<img src="${esc(url)}" alt="${esc(fallback)}">`;
    }
  }

  function wireCurrentStopEvents(route, parada, lat, lon, waPhone, pet) {
    const waToggle = document.getElementById('exec-wa-toggle');
    if (waToggle) {
      waToggle.addEventListener('click', () => {
        const wrap = document.getElementById('exec-wa-templates');
        wrap.style.display = wrap.style.display === 'none' ? 'flex' : 'none';
      });
      document.querySelectorAll('[data-wa-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tpl = WHATSAPP_TEMPLATES[parseInt(btn.dataset.waIdx, 10)];
          window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(tpl.text)}`, '_blank');
        });
      });
    }

    document.querySelectorAll('[data-check]').forEach((cb) => {
      cb.addEventListener('change', () => toggleChecklistItem(parada, cb.dataset.check, cb.checked));
    });

    document.getElementById('exec-btn-navegar').addEventListener('click', () => navegarAParada(parada, lat, lon));
    document.getElementById('exec-btn-estoy-aqui').addEventListener('click', () => estoyAqui(parada, lat, lon));
    document.getElementById('exec-btn-completar').addEventListener('click', () => completarParada(parada));
    document.getElementById('exec-btn-no-salio').addEventListener('click', () => noSalio(parada, route));
    document.getElementById('exec-gps-toggle').addEventListener('click', toggleGpsTracking);
    document.querySelectorAll('.exec-incident-chip').forEach((chip) => {
      chip.addEventListener('click', () => reportarIncidencia(parada, route, chip.dataset.incident));
    });
    updateGpsStatusUI();
  }

  async function persistParada(parada, patch) {
    Object.assign(parada, patch);
    try {
      await RouteStore.updateParada(parada.id, patch);
    } catch (e) {
      showToast('No se pudo guardar: ' + e.message, 'var(--red)');
    }
  }

  async function toggleChecklistItem(parada, key, value) {
    const checklist = { ...(parada.checklist || {}), [key]: value };
    await persistParada(parada, { checklist });
  }

  function navegarAParada(parada, lat, lon) {
    if (lat == null || lon == null) {
      showToast('Esta mascota no tiene coordenadas.', 'var(--red)');
      return;
    }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`, '_blank');
    toggleChecklistItem(parada, 'abri_navegacion', true);
    render();
  }

  async function estoyAqui(parada, lat, lon) {
    if (lat == null || lon == null) {
      showToast('Esta mascota no tiene coordenadas para comparar.', 'var(--red)');
      return;
    }
    if (!navigator.geolocation) {
      showToast('Tu navegador no soporta GPS.', 'var(--red)');
      return;
    }
    setExecStatus('Obteniendo tu ubicación…');
    const getPos = () =>
      new Promise((resolve, reject) => {
        if (lastPosition) return resolve(lastPosition);
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 });
      });
    try {
      const pos = await getPos();
      const dist = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, lat, lon));
      if (dist <= ARRIVAL_RADIUS_METERS) {
        await persistParada(parada, { checklist: { ...(parada.checklist || {}), llegue: true }, llegada_real: new Date().toISOString() });
        setExecStatus('✓ Llegada confirmada (a ' + dist + ' m)', 'var(--green)');
        render();
      } else {
        const confirmAnyway = confirm(`Estás a ${dist} m de la mascota (más de ${ARRIVAL_RADIUS_METERS} m). ¿Marcar llegada de todas formas?`);
        if (confirmAnyway) {
          await persistParada(parada, { checklist: { ...(parada.checklist || {}), llegue: true }, llegada_real: new Date().toISOString() });
          render();
        } else {
          setExecStatus(`Estás a ${dist} m — acércate e inténtalo de nuevo.`, 'var(--orange)');
        }
      }
    } catch (e) {
      setExecStatus('No se pudo obtener tu ubicación.', 'var(--red)');
    }
  }

  async function completarParada(parada) {
    const now = new Date().toISOString();
    await persistParada(parada, {
      estado: 'completada',
      completada_at: now,
      llegada_real: parada.llegada_real || now,
      checklist: { ...(parada.checklist || {}), llegue: true, mascota_abordo: true }
    });
    showToast('✓ Parada completada', '#22c55e');
    render();
  }

  async function noSalio(parada, route) {
    const motivo = prompt('¿Motivo? (opcional) — se reintentará al final de la ruta');
    const maxOrden = Math.max(...route.paradas.map((p) => p.orden));
    await persistParada(parada, {
      estado: 'pendiente',
      incidencia: 'no_disponible' + (motivo ? ': ' + motivo : ''),
      notas_operativas: motivo || null,
      orden: maxOrden + 1
    });
    showToast('Parada movida al final de la ruta', 'var(--orange)');
    render();
  }

  async function reportarIncidencia(parada, route, tipo) {
    if (tipo === 'Dirección incorrecta' || tipo === 'Mascota agresiva' || tipo === 'Retraso' || tipo === 'Otra') {
      const nota = prompt('Nota adicional (opcional):') || null;
      await persistParada(parada, { incidencia: tipo, notas_operativas: nota });
      showToast('✓ Incidencia registrada: ' + tipo, 'var(--orange)');
    }
  }

  function setExecStatus(msg, color) {
    const el = document.getElementById('exec-status');
    if (el) { el.textContent = msg; el.style.color = color || 'var(--text-soft)'; }
  }

  // ── GPS tracking ─────────────────────────────────────────────────────
  function toggleGpsTracking() {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      lastPosition = null;
      lastMapDriverPos = null;
      updateGpsStatusUI();
      return;
    }
    if (!navigator.geolocation) {
      showToast('Tu navegador no soporta GPS.', 'var(--red)');
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosition = pos;
        updateGpsStatusUI();
        maybeRefreshExecMap(pos);
      },
      () => { updateGpsStatusUI('Permiso de ubicación denegado o GPS no disponible'); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
    updateGpsStatusUI();
  }

  // Evita recalcular la ruta de manejo en cada tick del GPS: solo si el chofer
  // se movió lo suficiente desde el último cálculo (ahorra llamadas a Directions API).
  let lastMapDriverPos = null;
  function maybeRefreshExecMap(pos) {
    if (!currentStopDest) return;
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    if (lastMapDriverPos && haversineMeters(lastMapDriverPos.lat, lastMapDriverPos.lon, lat, lon) < 40) return;
    lastMapDriverPos = { lat, lon };
    renderExecMap(currentStopDest.lat, currentStopDest.lon);
  }

  function updateGpsStatusUI(errorMsg) {
    const btn = document.getElementById('exec-gps-toggle');
    const status = document.getElementById('exec-gps-status');
    if (btn) btn.textContent = watchId != null ? '🛰️ Desactivar seguimiento' : '🛰️ Activar seguimiento';
    if (!status) return;
    if (errorMsg) { status.textContent = errorMsg; status.style.color = 'var(--red)'; return; }
    if (watchId == null) { status.textContent = 'Seguimiento desactivado'; status.style.color = 'var(--text-soft)'; return; }
    if (lastPosition) {
      status.textContent = `Precisión: ~${Math.round(lastPosition.coords.accuracy)} m`;
      status.style.color = 'var(--sky-dark)';
    } else {
      status.textContent = 'Buscando señal…';
      status.style.color = 'var(--orange)';
    }
  }

  // ── Ruta completada ──────────────────────────────────────────────────
  function renderCompleted(route) {
    const container = document.getElementById('stage-ejecucion');
    const completadas = route.paradas.filter((p) => p.estado === 'completada').length;
    const omitidas = route.paradas.filter((p) => p.estado === 'omitida').length;
    const km = route.ruta.distancia_total_metros ? (route.ruta.distancia_total_metros / 1000).toFixed(1) : '—';
    container.innerHTML = `
      <div class="exec-completed">
        <div class="emoji">🎉</div>
        <h2>¡Ruta completada!</h2>
        <p>${completadas} de ${route.paradas.length} paradas completadas${omitidas ? `, ${omitidas} omitidas` : ''}.<br>${km} km recorridos en total.</p>
        <button class="btn-save" id="exec-btn-finalizar">Finalizar ruta</button>
      </div>`;
    document.getElementById('exec-btn-finalizar').addEventListener('click', finalizarRuta);
  }

  async function finalizarRuta() {
    const route = AppState.activeRoute;
    if (!route) return;
    try {
      await RouteStore.updateRuta(route.ruta.id, { estado: 'completada', finalizada_at: new Date().toISOString() });
    } catch (e) {
      showToast('Error al finalizar: ' + e.message, 'var(--red)');
      return;
    }
    RouteStore.clearActiveRouteId();
    AppState.reset();
    UIPlanning.renderAll();
    showToast('✓ Ruta finalizada', '#22c55e');
  }

  return { render };
})();
