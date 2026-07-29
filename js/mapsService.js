// GoogleMapsService — carga async del SDK, mapa con marcadores/ruta, y Street View con fallback.
const MapsService = (function () {
  let loadPromise = null;
  let map = null;
  let markers = [];
  let polyline = null;
  let infoWindow = null;
  let driverMarker = null;

  function isConfigured() {
    return !!(window.PETGROUND_CONFIG && window.PETGROUND_CONFIG.GOOGLE_MAPS_BROWSER_KEY);
  }

  function load() {
    if (loadPromise) return loadPromise;
    if (!isConfigured()) {
      loadPromise = Promise.reject(new Error('Falta configurar GOOGLE_MAPS_BROWSER_KEY en js/config.js'));
      return loadPromise;
    }
    loadPromise = new Promise((resolve, reject) => {
      const cbName = '__petgroundMapsReady';
      window[cbName] = () => resolve(window.google.maps);
      const script = document.createElement('script');
      const key = window.PETGROUND_CONFIG.GOOGLE_MAPS_BROWSER_KEY;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry,marker&loading=async&callback=${cbName}`;
      script.async = true;
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps JavaScript API.'));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  async function createMap(container, center) {
    const maps = await load();
    map = new maps.Map(container, {
      center,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      mapId: 'PETGROUND_ROUTE_MAP'
    });
    infoWindow = new maps.InfoWindow();
    return map;
  }

  function clearMarkers() {
    markers.forEach((m) => m.setMap(null));
    markers = [];
  }

  // points: [{ lat, lon, label, status: 'pending'|'current'|'completed'|'origin', onClick }]
  function renderMarkers(points) {
    if (!map) return;
    clearMarkers();
    const colors = { origin: '#22c55e', pending: '#2AABDE', current: '#F5640A', completed: '#8fa8b8' };
    points.forEach((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lon },
        map,
        label: p.orderLabel ? { text: String(p.orderLabel), color: '#fff', fontWeight: '800', fontSize: '11px' } : undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: p.status === 'origin' ? 9 : 12,
          fillColor: colors[p.status] || colors.pending,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2
        }
      });
      marker.addListener('click', () => {
        infoWindow.setContent(`<div style="font-family:'Nunito',sans-serif;font-weight:700;font-size:13px;padding:2px 4px">${esc(p.label || '')}</div>`);
        infoWindow.open(map, marker);
        if (p.onClick) p.onClick();
      });
      markers.push(marker);
    });
    fitToMarkers(points);
  }

  function fitToMarkers(points) {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lon }));
    map.fitBounds(bounds, 48);
  }

  function drawPolyline(encoded) {
    if (!map) return;
    if (polyline) polyline.setMap(null);
    if (!encoded) return;
    const path = google.maps.geometry.encoding.decodePath(encoded);
    polyline = new google.maps.Polyline({
      path,
      strokeColor: '#2AABDE',
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map
    });
  }

  function centerOnDriver(lat, lon) {
    if (!map) return;
    if (!driverMarker) {
      driverMarker = new google.maps.Marker({
        position: { lat, lng: lon },
        map,
        zIndex: 999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#F5640A',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3
        }
      });
    } else {
      driverMarker.setPosition({ lat, lng: lon });
    }
    map.panTo({ lat, lng: lon });
  }

  // Street View embebido con fallback claro si no hay panorama cercano.
  async function renderStreetView(container, lat, lon) {
    const maps = await load();
    return new Promise((resolve) => {
      const svc = new maps.StreetViewService();
      svc.getPanorama({ location: { lat, lng: lon }, radius: 60 }, (data, status) => {
        if (status === 'OK') {
          new maps.StreetViewPanorama(container, {
            position: data.location.latLng,
            pov: { heading: 0, pitch: 0 },
            zoomControl: false,
            addressControl: false,
            fullscreenControl: false
          });
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  return { isConfigured, load, createMap, renderMarkers, drawPolyline, fitToMarkers, centerOnDriver, renderStreetView };
})();
