// StorageService — fotos de mascota en el bucket privado "pet-route-images".
// Rutas: mascotas/{mascota_id}/mascota.webp | fachada.webp | acceso.webp
const StorageService = (function () {
  const BUCKET = 'pet-route-images';
  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
  const MAX_DIM = 1600;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const signedUrlCache = new Map(); // path -> { url, expiresAt }

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Formato no permitido. Usa JPEG, PNG o WebP.');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('La imagen pesa más de 8 MB.');
    }
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      img.src = URL.createObjectURL(file);
    });
  }

  async function resizeAndCompressToWebp(file) {
    const img = await loadImage(file);
    let { width, height } = img;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(img.src);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen.'))),
        'image/webp',
        0.82
      );
    });
  }

  function pathFor(mascotaId, kind) {
    const names = { mascota: 'mascota.webp', fachada: 'fachada.webp', acceso: 'acceso.webp' };
    if (!names[kind]) throw new Error('Tipo de foto inválido: ' + kind);
    return `mascotas/${mascotaId}/${names[kind]}`;
  }

  // onStatus(msg) opcional, para mostrar estado de carga en la UI.
  async function uploadPetPhoto(mascotaId, kind, file, onStatus) {
    if (!window.sb) throw new Error('Sin conexión a Supabase — configura js/config.js (ver README).');
    const notify = onStatus || (() => {});
    notify('Validando imagen…');
    validateFile(file);
    notify('Optimizando imagen…');
    const blob = await resizeAndCompressToWebp(file);
    const path = pathFor(mascotaId, kind);
    notify('Subiendo…');
    const { error } = await window.sb.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/webp',
      upsert: true
    });
    if (error) throw new Error('Error al subir la foto: ' + error.message);
    signedUrlCache.delete(path);
    notify('Listo');
    return path;
  }

  async function deletePetPhoto(path) {
    if (!path) return;
    if (!window.sb) throw new Error('Sin conexión a Supabase — configura js/config.js (ver README).');
    const { error } = await window.sb.storage.from(BUCKET).remove([path]);
    if (error) throw new Error('Error al eliminar la foto: ' + error.message);
    signedUrlCache.delete(path);
  }

  async function getSignedUrl(path, expiresIn = 3600) {
    if (!path || !window.sb) return null;
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now() + 30000) return cached.url;
    const { data, error } = await window.sb.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    if (error || !data) return null;
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + expiresIn * 1000 });
    return data.signedUrl;
  }

  return { uploadPetPhoto, deletePetPhoto, getSignedUrl, validateFile, MAX_DIM, MAX_BYTES };
})();
