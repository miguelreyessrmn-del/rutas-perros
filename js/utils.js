// Utilidades compartidas: escapado HTML, toasts, parseo de coordenadas, distancia.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(msg, color) {
  color = color || '#22c55e';
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast-base';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.color = color;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.opacity = '0'), 2500);
}

// "19.0654, -98.2558" -> {lat, lon} | null. Rango amplio de México.
function parseCoords(text) {
  const m = (text || '').trim().match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (lat > 14 && lat < 33 && lon > -118 && lon < -86) return { lat, lon };
  }
  return null;
}

// Distancia en metros entre dos puntos (Haversine). Se usa para "Estoy aquí",
// no para calcular rutas (eso lo hace Google Routes API vía routeService.js).
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPhoneForWhatsapp(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length === 10 ? '52' + digits : digits;
}
