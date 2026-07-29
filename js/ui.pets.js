// UI: directorio de mascotas, ficha (perfil) y formulario extendido con fotos.
const UIPets = (function () {
  let editingId = null;
  let profileId = null;
  const PHOTO_KINDS = [
    { kind: 'mascota', label: 'Foto de la mascota', emoji: '🐶' },
    { kind: 'fachada', label: 'Foto de la fachada', emoji: '🏠' },
    { kind: 'acceso', label: 'Foto del acceso / portón', emoji: '🚪' }
  ];

  // ── Directorio ───────────────────────────────────────────────────────
  function renderDirectory() {
    const grid = document.getElementById('pet-grid');
    const pets = PetStore.getAll();
    if (pets.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="emoji">🐶</div><p>Aún no tienes mascotas registradas.<br>Agrega la primera aquí abajo.</p></div>`;
      return;
    }
    grid.innerHTML = '';
    pets.forEach((p) => grid.appendChild(renderPetCard(p)));
    pets.forEach((p) => hydrateCardThumb(p));
  }

  function renderPetCard(p) {
    const d = document.createElement('div');
    d.className = 'pet-item' + (p.hasLimit ? ' has-limit' : '') + (p.activa ? '' : ' inactive');
    const badge = p.hasLimit
      ? `<span class="pet-item-badge badge-limit">⏰ antes de ${esc(p.limitTime)}</span>`
      : `<span class="pet-item-badge badge-free">✓ libre</span>`;
    const incompleteBadge = p.incompleto ? `<span class="pet-item-badge badge-incomplete">⚠ Perfil incompleto</span>` : '';
    const zone = p.address ? (p.address.length > 30 ? p.address.slice(0, 30) + '…' : p.address) : 'Sin dirección';
    d.innerHTML = `
      <div class="pet-thumb" id="thumb-${p.id}"><span class="pet-thumb-fallback">🐾</span></div>
      <div class="pet-item-name">${esc(p.name)}${p.activa ? '' : ' <span class="inactive-tag">(inactiva)</span>'}</div>
      <div class="pet-item-owner">${esc(p.owner || 'Sin propietario')}</div>
      <div class="pet-item-addr">${esc(zone)}</div>
      ${p.phone1 ? `<div class="pet-item-phone">📞 ${esc(p.phone1)}</div>` : ''}
      ${badge}${incompleteBadge}
      <div class="pet-actions">
        <button class="btn-sm" onclick="UIPets.openProfile(${p.id})">👁 Ver perfil</button>
        <button class="btn-sm" onclick="UIPets.editPet(${p.id})">✏️ Editar</button>
      </div>`;
    return d;
  }

  async function hydrateCardThumb(p) {
    if (!p.fotoMascotaPath) return;
    const url = await StorageService.getSignedUrl(p.fotoMascotaPath);
    if (!url) return;
    const el = document.getElementById('thumb-' + p.id);
    if (el) el.innerHTML = `<img src="${esc(url)}" alt="${esc(p.name)}">`;
  }

  // ── Ficha / perfil ───────────────────────────────────────────────────
  async function openProfile(id) {
    const p = PetStore.getById(id);
    if (!p) return;
    profileId = id;
    const modal = document.getElementById('profile-modal');
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
    renderProfileContent(p, { mascota: null, fachada: null, acceso: null });
    const [mascotaUrl, fachadaUrl, accesoUrl] = await Promise.all([
      StorageService.getSignedUrl(p.fotoMascotaPath),
      StorageService.getSignedUrl(p.fotoFachadaPath),
      StorageService.getSignedUrl(p.fotoAccesoPath)
    ]);
    renderProfileContent(p, { mascota: mascotaUrl, fachada: fachadaUrl, acceso: accesoUrl });
  }

  function closeProfile() {
    document.getElementById('profile-modal').classList.remove('visible');
    document.body.style.overflow = '';
    profileId = null;
  }

  function photoBlock(url, emoji, label, large) {
    if (url) {
      return `<img class="${large ? 'profile-photo-lg' : 'profile-photo'}" src="${esc(url)}" alt="${esc(label)}">`;
    }
    return `<div class="${large ? 'profile-photo-lg' : 'profile-photo'} profile-photo-empty">${emoji}<span>${esc(label)}</span></div>`;
  }

  function renderProfileContent(p, urls) {
    const body = document.getElementById('profile-body');
    const waPhone = formatPhoneForWhatsapp(p.phone1);
    const hasCoords = p.lat != null && p.lon != null;
    const mapsUrl = hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
      : p.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`
      : null;
    const streetViewUrl = hasCoords ? `https://www.google.com/maps?layer=c&cbll=${p.lat},${p.lon}` : null;

    body.innerHTML = `
      <div class="profile-header">
        ${photoBlock(urls.mascota, '🐶', 'Mascota', false)}
        <div class="profile-header-info">
          <h2>${esc(p.name)}${p.activa ? '' : ' <span class="inactive-tag">(inactiva)</span>'}</h2>
          <p>${esc(p.owner || 'Sin propietario registrado')}</p>
          ${p.incompleto ? '<span class="pet-item-badge badge-incomplete">⚠ Perfil incompleto</span>' : ''}
        </div>
      </div>

      <div class="profile-call-row">
        ${p.phone1 ? `<a class="btn-call" href="tel:${esc(p.phone1)}">📞 Llamar</a>` : ''}
        ${waPhone ? `<a class="btn-whatsapp" href="https://wa.me/${waPhone}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
      </div>
      ${!p.phone1 ? '<div class="hint-box">Sin teléfono principal registrado.</div>' : ''}

      <div class="section-label">Fachada</div>
      ${photoBlock(urls.fachada, '🏠', 'Fachada', true)}
      <div class="section-label">Acceso / portón</div>
      ${photoBlock(urls.acceso, '🚪', 'Acceso', true)}

      <div class="section-label">Dirección</div>
      <div class="profile-text">${esc(p.address || 'Sin dirección registrada')}</div>
      ${p.referencias ? `<div class="section-label">Referencias</div><div class="profile-text">${esc(p.referencias)}</div>` : ''}
      ${p.notas ? `<div class="section-label">Notas</div><div class="profile-text">${esc(p.notas)}</div>` : ''}

      <div class="profile-map-row">
        ${mapsUrl ? `<a class="btn-sm" href="${esc(mapsUrl)}" target="_blank" rel="noopener">📍 Ver en mapa</a>` : ''}
        ${streetViewUrl
          ? `<a class="btn-sm" href="${esc(streetViewUrl)}" target="_blank" rel="noopener">🧭 Street View</a>`
          : `<span class="btn-sm" style="opacity:.5;cursor:default">🧭 Street View (agrega coordenadas)</span>`}
      </div>

      <button class="btn-save" style="margin-top:14px" onclick="UIPets.closeProfile();UIPets.editPet(${p.id})">✏️ Editar mascota</button>
    `;
  }

  // ── Formulario ───────────────────────────────────────────────────────
  function showAddForm(reset = true) {
    if (reset) {
      editingId = null;
      document.getElementById('form-title').textContent = 'Nueva mascota';
      resetFormFields();
    }
    document.getElementById('add-form').style.display = 'block';
    document.getElementById('btn-add-pet').style.display = 'none';
    setTimeout(() => document.getElementById('f-name').focus(), 50);
  }

  function hideAddForm() {
    document.getElementById('add-form').style.display = 'none';
    document.getElementById('btn-add-pet').style.display = 'flex';
    editingId = null;
  }

  function resetFormFields() {
    const ids = ['f-name', 'f-owner', 'f-phone1', 'f-phone2', 'f-address', 'f-latlon', 'f-lat', 'f-lon', 'f-place-id', 'f-referencias', 'f-notas', 'f-available-from'];
    ids.forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('f-has-limit').checked = false;
    document.getElementById('f-limit-time').value = '17:00';
    document.getElementById('f-time-wrap').classList.remove('visible');
    document.getElementById('f-minutos-atencion').value = 5;
    document.getElementById('f-activa').checked = true;
    renderPhotosSection(null);
  }

  function toggleFormLimit(v) {
    document.getElementById('f-time-wrap').classList.toggle('visible', v);
  }

  function applyQuickCoords() {
    const raw = document.getElementById('f-latlon').value;
    const parsed = parseCoords(raw);
    if (!parsed) {
      showToast('No reconocí esas coordenadas. Formato: 19.0654, -98.2558', 'var(--red)');
      return;
    }
    document.getElementById('f-lat').value = parsed.lat;
    document.getElementById('f-lon').value = parsed.lon;
    showToast('✓ Coordenadas aplicadas', '#22c55e');
  }

  function collectFormData() {
    const name = document.getElementById('f-name').value.trim();
    const latRaw = document.getElementById('f-lat').value;
    const lonRaw = document.getElementById('f-lon').value;
    return {
      name,
      owner: document.getElementById('f-owner').value.trim(),
      phone1: document.getElementById('f-phone1').value.trim(),
      phone2: document.getElementById('f-phone2').value.trim(),
      address: document.getElementById('f-address').value.trim(),
      lat: latRaw !== '' ? parseFloat(latRaw) : null,
      lon: lonRaw !== '' ? parseFloat(lonRaw) : null,
      placeId: document.getElementById('f-place-id').value.trim(),
      referencias: document.getElementById('f-referencias').value.trim(),
      notas: document.getElementById('f-notas').value.trim(),
      hasLimit: document.getElementById('f-has-limit').checked,
      limitTime: document.getElementById('f-limit-time').value || '17:00',
      horaDisponibleDesde: document.getElementById('f-available-from').value || '',
      minutosAtencion: parseInt(document.getElementById('f-minutos-atencion').value, 10) || 5,
      activa: document.getElementById('f-activa').checked
    };
  }

  async function savePet() {
    const data = collectFormData();
    if (!data.name) {
      showToast('Escribe el nombre de la mascota.', 'var(--red)');
      return;
    }
    const btn = document.querySelector('#add-form .btn-save');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      if (editingId !== null) {
        const existing = PetStore.getById(editingId);
        const merged = { ...existing, ...data };
        await PetStore.update(editingId, merged);
        showToast('✓ ' + data.name + ' actualizado', '#22c55e');
      } else {
        const created = await PetStore.create(data);
        editingId = created.id;
        showToast('✓ ' + data.name + ' agregado — ahora puedes subir fotos', '#22c55e');
        document.getElementById('form-title').textContent = 'Editar — ' + data.name;
        renderPhotosSection(created);
      }
      renderDirectory();
    } catch (e) {
      showToast('Error: ' + e.message, 'var(--red)');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar mascota';
    }
  }

  function editPet(id) {
    const p = PetStore.getById(id);
    if (!p) return;
    editingId = id;
    document.getElementById('form-title').textContent = 'Editar — ' + p.name;
    document.getElementById('f-name').value = p.name;
    document.getElementById('f-owner').value = p.owner;
    document.getElementById('f-phone1').value = p.phone1;
    document.getElementById('f-phone2').value = p.phone2;
    document.getElementById('f-address').value = p.address;
    document.getElementById('f-latlon').value = '';
    document.getElementById('f-lat').value = p.lat != null ? p.lat : '';
    document.getElementById('f-lon').value = p.lon != null ? p.lon : '';
    document.getElementById('f-place-id').value = p.placeId;
    document.getElementById('f-referencias').value = p.referencias;
    document.getElementById('f-notas').value = p.notas;
    document.getElementById('f-has-limit').checked = p.hasLimit;
    document.getElementById('f-limit-time').value = p.limitTime || '17:00';
    document.getElementById('f-time-wrap').classList.toggle('visible', p.hasLimit);
    document.getElementById('f-available-from').value = p.horaDisponibleDesde || '';
    document.getElementById('f-minutos-atencion').value = p.minutosAtencion != null ? p.minutosAtencion : 5;
    document.getElementById('f-activa').checked = p.activa !== false;
    renderPhotosSection(p);
    showAddForm(false);
    document.getElementById('add-form').scrollIntoView({ behavior: 'smooth' });
  }

  async function deletePet(id) {
    const p = PetStore.getById(id);
    if (!p || !confirm('¿Eliminar a ' + p.name + '? Esto no se puede deshacer.')) return;
    try {
      await PetStore.remove(id);
      showToast('🗑 ' + p.name + ' eliminado', '#8fa8b8');
      renderDirectory();
    } catch (e) {
      showToast('Error eliminando: ' + e.message, 'var(--red)');
    }
  }

  // ── Fotos dentro del formulario ──────────────────────────────────────
  function renderPhotosSection(pet) {
    const wrap = document.getElementById('form-photos');
    if (!pet) {
      wrap.innerHTML = '<div class="hint-box">💡 Guarda la mascota primero; después podrás subir sus fotos aquí mismo.</div>';
      return;
    }
    wrap.innerHTML = PHOTO_KINDS.map(
      (pk) => `
      <div class="photo-widget" data-kind="${pk.kind}">
        <div class="photo-widget-label">${pk.emoji} ${pk.label}</div>
        <div class="photo-preview" id="photo-preview-${pk.kind}"><span>${pk.emoji}</span></div>
        <input type="file" accept="image/jpeg,image/png,image/webp" id="photo-input-${pk.kind}" style="display:none">
        <div class="photo-actions">
          <button type="button" class="btn-sm" onclick="document.getElementById('photo-input-${pk.kind}').click()">⬆ Subir / reemplazar</button>
          <button type="button" class="btn-sm danger" onclick="UIPets.removePhoto('${pk.kind}')">🗑 Quitar</button>
        </div>
        <div class="photo-status" id="photo-status-${pk.kind}"></div>
      </div>`
    ).join('');

    PHOTO_KINDS.forEach((pk) => {
      const input = document.getElementById('photo-input-' + pk.kind);
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) uploadPhoto(pk.kind, file);
        e.target.value = '';
      };
      hydrateFormPhotoPreview(pk.kind, pet);
    });
  }

  async function hydrateFormPhotoPreview(kind, pet) {
    const prop = { mascota: 'fotoMascotaPath', fachada: 'fotoFachadaPath', acceso: 'fotoAccesoPath' }[kind];
    const path = pet[prop];
    const preview = document.getElementById('photo-preview-' + kind);
    if (!preview) return;
    if (!path) return;
    const url = await StorageService.getSignedUrl(path);
    if (url) preview.innerHTML = `<img src="${esc(url)}" alt="${kind}">`;
  }

  async function uploadPhoto(kind, file) {
    if (editingId === null) {
      showToast('Guarda la mascota primero.', 'var(--red)');
      return;
    }
    const statusEl = document.getElementById('photo-status-' + kind);
    try {
      const path = await StorageService.uploadPetPhoto(editingId, kind, file, (msg) => {
        if (statusEl) statusEl.textContent = msg;
      });
      await PetStore.updatePhotoPath(editingId, kind, path);
      const url = await StorageService.getSignedUrl(path);
      const preview = document.getElementById('photo-preview-' + kind);
      if (preview && url) preview.innerHTML = `<img src="${esc(url)}" alt="${kind}">`;
      if (statusEl) statusEl.textContent = '✓ Foto guardada';
      renderDirectory();
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      showToast(e.message, 'var(--red)');
    }
  }

  async function removePhoto(kind) {
    if (editingId === null) return;
    const pet = PetStore.getById(editingId);
    const prop = { mascota: 'fotoMascotaPath', fachada: 'fotoFachadaPath', acceso: 'fotoAccesoPath' }[kind];
    const path = pet && pet[prop];
    if (!path) return;
    if (!confirm('¿Quitar esta foto?')) return;
    try {
      await StorageService.deletePetPhoto(path);
      await PetStore.updatePhotoPath(editingId, kind, null);
      const preview = document.getElementById('photo-preview-' + kind);
      const kindInfo = PHOTO_KINDS.find((p) => p.kind === kind);
      if (preview) preview.innerHTML = `<span>${kindInfo.emoji}</span>`;
      renderDirectory();
      showToast('Foto eliminada', '#8fa8b8');
    } catch (e) {
      showToast(e.message, 'var(--red)');
    }
  }

  return {
    renderDirectory,
    openProfile,
    closeProfile,
    showAddForm,
    hideAddForm,
    toggleFormLimit,
    applyQuickCoords,
    savePet,
    editPet,
    deletePet,
    removePhoto
  };
})();
