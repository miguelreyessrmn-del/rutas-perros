// Inicializa el cliente de Supabase (supabase-js v2, cargado por CDN en index.html).
// Expone window.sb — usado por petStore.js, storageService.js, routeStore.js, routeService.js.
(function () {
  const cfg = window.PETGROUND_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('Falta configurar SUPABASE_URL / SUPABASE_ANON_KEY en js/config.js');
    window.sb = null;
    return;
  }
  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
})();
