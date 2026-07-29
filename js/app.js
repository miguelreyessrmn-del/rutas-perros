// Bootstrap de la app: navegación entre pantallas y carga inicial de datos.
const App = (function () {
  function showScreen(name, btn) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.getElementById('screen-' + name).classList.add('active');
    if (btn) btn.classList.add('active');
    if (name === 'directory') UIPets.renderDirectory();
    if (name === 'today') UIPlanning.renderAll();
  }

  async function init() {
    if (!window.sb) {
      showToast('⚠️ Falta configurar js/config.js (ver README)', 'var(--red)');
      UIPets.renderDirectory();
      UIPlanning.init();
      return;
    }
    try {
      showToast('Cargando mascotas…', '#8fa8b8');
      await PetStore.loadAll();
      showToast('✓ ' + PetStore.getAll().length + ' mascotas cargadas', '#22c55e');
    } catch (e) {
      showToast('Sin conexión — mostrando datos locales', 'var(--orange)');
      PetStore.loadFromCache();
    }
    UIPets.renderDirectory();
    await recoverActiveRoute();
    UIPlanning.init();
  }

  // Si había una ruta en curso al recargar la página, retoma la ejecución donde iba.
  async function recoverActiveRoute() {
    const activeId = RouteStore.getActiveRouteId();
    if (!activeId) return;
    try {
      const { ruta, paradas } = await RouteStore.getRutaConParadas(activeId);
      if (!ruta || ruta.estado !== 'en_curso') {
        RouteStore.clearActiveRouteId();
        return;
      }
      const enriched = paradas.map((p) => ({ ...p, pet: PetStore.getById(p.mascota_id) })).sort((a, b) => a.orden - b.orden);
      AppState.setActiveRoute({ ruta, paradas: enriched });
      AppState.setStage('ejecucion');
    } catch (e) {
      RouteStore.clearActiveRouteId();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { showScreen };
})();
