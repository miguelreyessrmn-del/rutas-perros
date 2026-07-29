// PetRepository — CRUD sobre mascotas_ruta + migración de compatibilidad.
// Normaliza cada fila de la BD a un objeto "pet" en camelCase que usa el resto de la app.
const PetStore = (function () {
  let pets = [];

  function rowToPet(r) {
    let lat = r.latitud != null ? Number(r.latitud) : null;
    let lon = r.longitud != null ? Number(r.longitud) : null;
    let direccion = r.direccion || '';

    // Compatibilidad: registros viejos solo tienen `coordenadas` (texto).
    if ((lat == null || lon == null) && r.coordenadas) {
      const parsed = parseCoords(r.coordenadas);
      if (parsed) {
        lat = parsed.lat;
        lon = parsed.lon;
      } else if (!direccion) {
        direccion = r.coordenadas; // era una dirección de texto libre
      }
    }

    const hasCoords = lat != null && lon != null;
    const incompleto = !r.propietario_nombre || !r.telefono_principal || !hasCoords;

    return {
      id: r.id,
      name: r.nombre,
      owner: r.propietario_nombre || '',
      phone1: r.telefono_principal || '',
      phone2: r.telefono_secundario || '',
      address: direccion,
      lat,
      lon,
      placeId: r.google_place_id || '',
      referencias: r.referencias || '',
      notas: r.notas || '',
      fotoMascotaPath: r.foto_mascota_path || null,
      fotoFachadaPath: r.foto_fachada_path || null,
      fotoAccesoPath: r.foto_acceso_path || null,
      hasLimit: !!r.tiene_limite,
      limitTime: r.hora_limite || '17:00',
      horaDisponibleDesde: r.hora_disponible_desde || '',
      minutosAtencion: r.minutos_atencion != null ? r.minutos_atencion : 5,
      activa: r.activa !== false,
      incompleto,
      _legacyCoordenadas: r.coordenadas || ''
    };
  }

  function petToRow(p) {
    return {
      nombre: p.name,
      coordenadas: p.lat != null && p.lon != null ? `${p.lat}, ${p.lon}` : p._legacyCoordenadas || '',
      tiene_limite: p.hasLimit,
      hora_limite: p.limitTime || '17:00',
      propietario_nombre: p.owner || null,
      telefono_principal: p.phone1 || null,
      telefono_secundario: p.phone2 || null,
      direccion: p.address || null,
      latitud: p.lat,
      longitud: p.lon,
      google_place_id: p.placeId || null,
      referencias: p.referencias || null,
      notas: p.notas || null,
      foto_mascota_path: p.fotoMascotaPath || null,
      foto_fachada_path: p.fotoFachadaPath || null,
      foto_acceso_path: p.fotoAccesoPath || null,
      hora_disponible_desde: p.horaDisponibleDesde || null,
      minutos_atencion: p.minutosAtencion != null ? p.minutosAtencion : 5,
      activa: p.activa !== false
    };
  }

  function requireClient() {
    if (!window.sb) throw new Error('Sin conexión a Supabase — configura js/config.js (ver README).');
  }

  async function loadAll() {
    requireClient();
    const { data, error } = await window.sb.from('mascotas_ruta').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    pets = (data || []).map(rowToPet);
    try {
      localStorage.setItem('pg_pets', JSON.stringify(pets));
    } catch (_) {}
    return pets;
  }

  function loadFromCache() {
    try {
      const r = localStorage.getItem('pg_pets');
      pets = r ? JSON.parse(r) : [];
    } catch (_) {
      pets = [];
    }
    return pets;
  }

  function getAll() {
    return pets;
  }
  function getById(id) {
    return pets.find((p) => String(p.id) === String(id));
  }

  async function create(petData) {
    requireClient();
    const row = petToRow(petData);
    const { data, error } = await window.sb.from('mascotas_ruta').insert(row).select().single();
    if (error) throw error;
    const pet = rowToPet(data);
    pets.push(pet);
    pets.sort((a, b) => a.name.localeCompare(b.name));
    return pet;
  }

  async function update(id, petData) {
    requireClient();
    const row = petToRow(petData);
    const { data, error } = await window.sb.from('mascotas_ruta').update(row).eq('id', id).select().single();
    if (error) throw error;
    const pet = rowToPet(data);
    const idx = pets.findIndex((p) => String(p.id) === String(id));
    if (idx >= 0) pets[idx] = pet;
    return pet;
  }

  async function remove(id) {
    requireClient();
    const { error } = await window.sb.from('mascotas_ruta').delete().eq('id', id);
    if (error) throw error;
    pets = pets.filter((p) => String(p.id) !== String(id));
  }

  const PHOTO_COLUMNS = {
    mascota: { col: 'foto_mascota_path', prop: 'fotoMascotaPath' },
    fachada: { col: 'foto_fachada_path', prop: 'fotoFachadaPath' },
    acceso: { col: 'foto_acceso_path', prop: 'fotoAccesoPath' }
  };

  // Actualiza solo la columna de una foto (evita pisar otros campos en edición concurrente).
  async function updatePhotoPath(id, kind, path) {
    requireClient();
    const map = PHOTO_COLUMNS[kind];
    if (!map) throw new Error('Tipo de foto inválido: ' + kind);
    const { data, error } = await window.sb
      .from('mascotas_ruta')
      .update({ [map.col]: path })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    const pet = rowToPet(data);
    const idx = pets.findIndex((p) => String(p.id) === String(id));
    if (idx >= 0) pets[idx] = pet;
    return pet;
  }

  return { loadAll, loadFromCache, getAll, getById, create, update, remove, updatePhotoPath };
})();
