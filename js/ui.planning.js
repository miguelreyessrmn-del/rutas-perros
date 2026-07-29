// UI: selección de mascotas, 3 modos de ruta, reorden manual y revisión.
const UIPlanning = (function () {
  const MODE_HINTS = {
    optimizada: '⚡ Google calculará el orden más eficiente entre las paradas seleccionadas.',
    seleccion: '🔢 La ruta respetará exactamente el orden en que toques a cada mascota.',
    manual: '✋ Selecciona a las mascotas y luego arrástralas (o usa ↑/↓) para definir el orden.'
  };
  let reorderingReview = false;

  function init() {
    document.getElementById('btn-gps').addEventListener('click', useGps);
    document.getElementById('origin-input').addEventListener('change', applyOriginInput);
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    document.getElementById('btn-calc-route').addEventListener('click', calcRoute);
    document.getElementById('btn-back-to-selection').addEventListener('click', backToSelection);
    document.getElementById('btn-recalc-review').addEventListener('click', calcRoute);
    document.getElementById('btn-toggle-reorder').addEventListener('click', toggleReviewReorder);
    document.getElementById('btn-apply-review-reorder').addEventListener('click', applyReviewReorder);
    document.getElementById('btn-start-route').addEventListener('click', startRoute);
    document.getElementById('origin-input').value = `${AppState.origin.lat}, ${AppState.origin.lon}`;
    tryAutoLocation();
    renderAll();
  }

  function renderAll() {
    if (AppState.stage === 'ejecucion') {
      document.getElementById('stage-seleccion').style.display = 'none';
      document.getElementById('stage-revision').style.display = 'none';
      document.getElementById('stage-ejecucion').style.display = 'block';
      UIExecution.render();
      return;
    }
    document.getElementById('stage-ejecucion').style.display = 'none';
    const showSelection = AppState.stage === 'seleccion';
    document.getElementById('stage-seleccion').style.display = showSelection ? 'block' : 'none';
    document.getElementById('stage-revision').style.display = showSelection ? 'none' : 'block';
    if (showSelection) renderSelectionStage();
    else renderReviewStage();
  }

  // ── Origen ───────────────────────────────────────────────────────────
  function applyOriginInput() {
    const parsed = parseCoords(document.getElementById('origin-input').value);
    if (!parsed) {
      showToast('Coordenadas de origen no válidas. Formato: 19.0654, -98.2558', 'var(--red)');
      return;
    }
    AppState.setOrigin({ lat: parsed.lat, lon: parsed.lon, label: 'Personalizado' });
  }

  function setGpsStatus(msg, color) {
    const el = document.getElementById('gps-status');
    el.textContent = msg;
    el.style.color = color || 'var(--text-soft)';
  }

  function useGps() {
    if (!navigator.geolocation) {
      setGpsStatus('Tu navegador no soporta GPS', 'var(--red)');
      return;
    }
    const btn = document.getElementById('btn-gps');
    const icon = document.getElementById('gps-icon');
    btn.disabled = true;
    icon.style.animation = 'spin 1s linear infinite';
    setGpsStatus('Obteniendo ubicación…', 'var(--orange)');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        document.getElementById('origin-input').value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        AppState.setOrigin({ lat, lon, label: 'Mi ubicación' });
        setGpsStatus('📍 Usando tu ubicación actual', 'var(--sky)');
        btn.disabled = false;
        icon.style.animation = '';
      },
      (err) => {
        let msg = 'No se pudo obtener ubicación';
        if (err.code === 1) msg = 'Permiso de ubicación denegado';
        else if (err.code === 2) msg = 'GPS no disponible';
        else if (err.code === 3) msg = 'Tiempo agotado';
        setGpsStatus(msg + ' — usando el origen configurado', 'var(--text-soft)');
        btn.disabled = false;
        icon.style.animation = '';
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  function tryAutoLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        document.getElementById('origin-input').value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        AppState.setOrigin({ lat, lon, label: 'Mi ubicación' });
        setGpsStatus('📍 Ubicación actual detectada', 'var(--sky)');
      },
      () => setGpsStatus('Toca 📡 para usar tu ubicación actual', 'var(--text-soft)'),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  }

  // ── Selección ────────────────────────────────────────────────────────
  function renderSelectionStage() {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === AppState.mode));
    document.getElementById('mode-hint').textContent = MODE_HINTS[AppState.mode];
    document.getElementById('manual-order-section').style.display = AppState.mode === 'manual' ? 'block' : 'none';

    const grid = document.getElementById('pets-select-grid');
    const pets = PetStore.getAll().filter((p) => p.activa);
    if (pets.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="emoji">🐾</div><p>Primero registra tus mascotas<br>en la pestaña <strong>Mascotas</strong>.</p>
        <button onclick="document.getElementById('tab-dir').click()">Ir a Mascotas</button></div>`;
    } else {
      grid.innerHTML = '';
      pets.forEach((p) => grid.appendChild(renderSelectCard(p)));
    }
    updateSelectedCount();
    if (AppState.mode === 'manual') renderManualList();
  }

  function renderSelectCard(p) {
    const btn = document.createElement('button');
    const selected = AppState.selectedIds.has(p.id);
    btn.className = 'pet-select-btn' + (selected ? ' selected' : '');
    btn.onclick = () => {
      AppState.toggle(p.id);
      renderSelectionStage();
    };
    const orderNum = AppState.orderIndex(p.id);
    const zone = p.address ? (p.address.length > 26 ? p.address.slice(0, 26) + '…' : p.address) : (p.lat != null ? '📍 coords' : 'sin dirección');
    const detail = p.hasLimit
      ? `<span class="psb-limit">⏰ antes de ${esc(p.limitTime)}</span>`
      : `<span style="font-size:0.7rem;color:var(--text-soft);font-family:'Nunito',sans-serif;font-weight:600">sin restricción</span>`;
    const noCoords = p.lat == null || p.lon == null ? '<div class="psb-nocoords">⚠ sin coordenadas</div>' : '';
    btn.innerHTML = `
      <div class="check-circle">${orderNum ? `<span class="order-num">${orderNum}</span>` : ''}</div>
      <div class="psb-name">${esc(p.name)}</div>
      <div class="psb-detail">${esc(zone)}</div>
      <div style="margin-top:5px">${detail}</div>
      ${noCoords}`;
    return btn;
  }

  function updateSelectedCount() {
    const n = AppState.selectedIds.size;
    const el = document.getElementById('selected-count');
    el.innerHTML = n === 0 ? 'Toca las mascotas que van hoy 👆' : `<span>${n}</span> mascota${n > 1 ? 's' : ''} seleccionada${n > 1 ? 's' : ''}`;
  }

  function setMode(m) {
    AppState.setMode(m);
    renderSelectionStage();
  }

  // ── Orden manual (reutilizable en selección y revisión) ─────────────
  function renderManualList(containerId) {
    containerId = containerId || 'manual-order-list';
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    const ids = AppState.manualOrder;
    wrap.innerHTML = '';
    ids.forEach((id, i) => {
      const p = PetStore.getById(id);
      if (!p) return;
      const row = document.createElement('div');
      row.className = 'manual-row';
      row.dataset.id = id;
      row.innerHTML = `
        <span class="manual-drag-handle">⠿</span>
        <span class="manual-order-badge">${i + 1}</span>
        <span class="manual-name">${esc(p.name)}</span>
        <div class="manual-btns">
          <button type="button" class="btn-updown" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn-updown" data-dir="1" ${i === ids.length - 1 ? 'disabled' : ''}>↓</button>
        </div>`;
      row.querySelectorAll('.btn-updown').forEach((b) =>
        b.addEventListener('click', () => {
          AppState.moveManual(id, parseInt(b.dataset.dir, 10));
          renderManualList(containerId);
        })
      );
      wrap.appendChild(row);
    });
    initSortable(wrap, containerId);
  }

  function initSortable(wrap, containerId) {
    if (typeof Sortable === 'undefined') return; // botones ↑/↓ siguen funcionando sin la librería
    if (wrap._sortableInstance) wrap._sortableInstance.destroy();
    wrap._sortableInstance = new Sortable(wrap, {
      handle: '.manual-drag-handle',
      animation: 150,
      onEnd: () => {
        const ids = Array.from(wrap.children).map((el) => (el.dataset.id.match(/^\d+$/) ? parseInt(el.dataset.id, 10) : el.dataset.id));
        AppState.setManualOrder(ids);
        renderManualList(containerId);
      }
    });
  }

  // ── Cálculo de ruta ──────────────────────────────────────────────────
  async function calcRoute() {
    await runCompute(AppState.orderedIdsForMode(), AppState.mode === 'optimizada');
  }

  // Recalcula preservando exactamente el orden manual ajustado dentro de revisión.
  async function applyReviewReorder() {
    await runCompute(AppState.manualOrder, false);
    reorderingReview = false;
    document.getElementById('review-reorder-section').style.display = 'none';
  }

  async function runCompute(orderedIds, optimize) {
    if (orderedIds.length === 0) {
      setStatus('Selecciona al menos una mascota.', 'var(--red)');
      return;
    }
    const allPets = orderedIds.map((id) => PetStore.getById(id)).filter(Boolean);
    const stops = allPets.filter((p) => p.lat != null && p.lon != null);
    const missing = allPets.filter((p) => p.lat == null || p.lon == null);
    if (stops.length === 0) {
      setStatus('Ninguna mascota seleccionada tiene coordenadas.', 'var(--red)');
      return;
    }

    const btns = [document.getElementById('btn-calc-route'), document.getElementById('btn-recalc-review'), document.getElementById('btn-apply-review-reorder')];
    btns.forEach((b) => b && (b.disabled = true));
    setStatus('Calculando ruta…');
    try {
      const origin = AppState.origin;
      const result = await RouteService.computeRoute(origin, stops.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon })), optimize);
      if (missing.length > 0) {
        result.warnings = result.warnings || [];
        result.warnings.unshift(`${missing.length} mascota(s) sin coordenadas no se incluyeron: ${missing.map((m) => m.name).join(', ')}`);
      }
      const stopsById = new Map(stops.map((p) => [String(p.id), p]));
      const orderedPets = result.order.map((id) => stopsById.get(String(id))).filter(Boolean);
      const withEtas = computeEtas(orderedPets, result.legs);
      AppState.setReviewData({ ...result, stops: withEtas });
      AppState.setStage('revision');
      setStatus('');
      renderAll();
    } catch (e) {
      setStatus('Error: ' + e.message, 'var(--red)');
    } finally {
      btns.forEach((b) => b && (b.disabled = false));
    }
  }

  function computeEtas(orderedPets, legs) {
    let cursor = new Date();
    return orderedPets.map((p, i) => {
      const leg = legs[i] || { distanceMeters: 0, durationSeconds: 0 };
      cursor = new Date(cursor.getTime() + leg.durationSeconds * 1000);
      const llegada = new Date(cursor);
      cursor = new Date(cursor.getTime() + (p.minutosAtencion || 5) * 60000);
      let status = 'green';
      if (p.hasLimit && p.limitTime) {
        const [h, m] = p.limitTime.split(':').map(Number);
        const limite = new Date(llegada);
        limite.setHours(h, m, 0, 0);
        const marginMin = (limite - llegada) / 60000;
        if (marginMin < 0) status = 'red';
        else if (marginMin < 15) status = 'yellow';
      }
      return { pet: p, leg, llegadaEstimada: llegada, status };
    });
  }

  // ── Revisión ─────────────────────────────────────────────────────────
  function renderReviewStage() {
    const data = AppState.reviewData;
    if (!data) {
      backToSelection();
      return;
    }
    const totalKm = (data.distanceMeters / 1000).toFixed(1);
    const totalMin = Math.round(data.durationSeconds / 60);
    document.getElementById('review-summary').innerHTML = `
      <div class="review-total"><strong>${totalKm} km</strong> · <strong>${totalMin} min</strong> de recorrido · ${data.stops.length} paradas</div>`;

    const warnBox = document.getElementById('review-warnings');
    const warns = data.warnings || [];
    warnBox.innerHTML = warns.length ? '⚠️ ' + warns.map(esc).join('<br>⚠️ ') : '';
    warnBox.classList.toggle('visible', warns.length > 0);

    const list = document.getElementById('review-list');
    list.innerHTML = '';
    data.stops.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'route-step';
      const badgeClass = { red: 'badge-alert-red', yellow: 'badge-alert-yellow', green: 'badge-free' }[s.status];
      const badgeText = { red: '⛔ fuera de horario', yellow: '⚠ margen ajustado', green: '✓ en horario' }[s.status];
      const timeStr = s.llegadaEstimada.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      row.innerHTML = `
        <div class="step-order">${i + 1}</div>
        <div class="step-info">
          <div class="step-name">${esc(s.pet.name)}</div>
          <div class="step-addr">${esc(s.pet.address || 'Sin dirección')}</div>
          <div class="step-badge ${badgeClass}">${badgeText} · llega ~${timeStr}</div>
        </div>
        <div class="step-travel">+${Math.round(s.leg.durationSeconds / 60)} min<br>${(s.leg.distanceMeters / 1000).toFixed(1)} km</div>`;
      list.appendChild(row);
    });

    renderReviewMap(data);
  }

  async function renderReviewMap(data) {
    const container = document.getElementById('review-map');
    if (!MapsService.isConfigured()) {
      container.innerHTML = '<div class="hint-box">🗺️ Configura GOOGLE_MAPS_BROWSER_KEY en js/config.js para ver el mapa aquí.</div>';
      return;
    }
    try {
      await MapsService.createMap(container, { lat: AppState.origin.lat, lng: AppState.origin.lon });
      const points = [
        { lat: AppState.origin.lat, lon: AppState.origin.lon, label: 'Origen', status: 'origin' },
        ...data.stops.map((s, i) => ({ lat: s.pet.lat, lon: s.pet.lon, label: s.pet.name, status: 'pending', orderLabel: i + 1 }))
      ];
      MapsService.renderMarkers(points);
      MapsService.drawPolyline(data.polyline);
    } catch (e) {
      container.innerHTML = `<div class="hint-box">No se pudo cargar el mapa: ${esc(e.message)}</div>`;
    }
  }

  function toggleReviewReorder() {
    reorderingReview = !reorderingReview;
    const section = document.getElementById('review-reorder-section');
    section.style.display = reorderingReview ? 'block' : 'none';
    if (reorderingReview) {
      AppState.setManualOrder(AppState.reviewData.stops.map((s) => s.pet.id));
      renderManualList('review-manual-order-list');
    }
  }

  function backToSelection() {
    AppState.setStage('seleccion');
    renderAll();
  }

  async function startRoute() {
    const data = AppState.reviewData;
    if (!data) return;
    const btn = document.getElementById('btn-start-route');
    btn.disabled = true;
    btn.textContent = 'Iniciando…';
    try {
      let cumMeters = 0;
      let cumSeconds = 0;
      const paradas = data.stops.map((s, i) => {
        cumMeters += s.leg.distanceMeters;
        cumSeconds += s.leg.durationSeconds;
        return {
          mascotaId: s.pet.id,
          orden: i + 1,
          distanciaMetros: s.leg.distanceMeters,
          duracionSegundos: s.leg.durationSeconds,
          llegadaEstimada: s.llegadaEstimada,
          lat: s.pet.lat,
          lon: s.pet.lon,
          direccion: s.pet.address
        };
      });
      const { ruta, paradas: paradasGuardadas } = await RouteStore.crearRutaConParadas({
        tipo: AppState.mode,
        origen: AppState.origin,
        distanciaTotalMetros: data.distanceMeters,
        duracionTotalSegundos: data.durationSeconds,
        polyline: data.polyline,
        paradas
      });
      const enriched = paradasGuardadas
        .map((p) => ({ ...p, pet: PetStore.getById(p.mascota_id) }))
        .sort((a, b) => a.orden - b.orden);
      AppState.setActiveRoute({ ruta, paradas: enriched });
      RouteStore.setActiveRouteId(ruta.id);
      AppState.setStage('ejecucion');
      showToast('✓ Ruta iniciada', '#22c55e');
      renderAll();
    } catch (e) {
      showToast('Error al iniciar la ruta: ' + e.message, 'var(--red)');
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Iniciar ruta';
    }
  }

  function setStatus(msg, color) {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.style.color = color || 'var(--text-soft)';
  }

  return { init, renderAll };
})();
