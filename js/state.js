// AppState — selección de mascotas, modo de ruta, orden manual y datos de revisión.
// selectedIds (Set) + selectedOrder (array) en vez de solo un Set, para poder
// ofrecer "orden de selección" y "orden manual" además de la ruta optimizada.
const AppState = (function () {
  let selectedIds = new Set();
  let selectedOrder = []; // ids en el orden en que se fueron tocando
  let manualOrder = []; // copia reordenable para el modo manual
  let mode = 'optimizada'; // 'optimizada' | 'seleccion' | 'manual'
  let origin = { lat: 19.05101951225774, lon: -98.23568593352047, label: 'PetGround (base)' };
  let stage = 'seleccion'; // 'seleccion' | 'revision'
  let reviewData = null; // resultado normalizado de RouteService.computeRoute + horarios

  function select(id) {
    if (selectedIds.has(id)) return;
    selectedIds.add(id);
    selectedOrder.push(id);
    manualOrder.push(id);
  }
  function deselect(id) {
    selectedIds.delete(id);
    selectedOrder = selectedOrder.filter((x) => x !== id);
    manualOrder = manualOrder.filter((x) => x !== id);
  }
  function toggle(id) {
    selectedIds.has(id) ? deselect(id) : select(id);
  }
  function clearSelection() {
    selectedIds = new Set();
    selectedOrder = [];
    manualOrder = [];
  }
  function orderIndex(id) {
    const i = selectedOrder.indexOf(id);
    return i === -1 ? null : i + 1;
  }

  function setManualOrder(ids) {
    manualOrder = ids.slice();
  }
  function moveManual(id, dir) {
    const i = manualOrder.indexOf(id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= manualOrder.length) return;
    [manualOrder[i], manualOrder[j]] = [manualOrder[j], manualOrder[i]];
  }

  function setMode(m) {
    mode = m;
  }
  function setOrigin(o) {
    origin = o;
  }
  function setStage(s) {
    stage = s;
  }
  function setReviewData(d) {
    reviewData = d;
  }

  // Ids en el orden correcto según el modo activo (antes de llamar a Google).
  function orderedIdsForMode() {
    if (mode === 'manual') return manualOrder.slice();
    if (mode === 'seleccion') return selectedOrder.slice();
    return selectedOrder.slice(); // 'optimizada': el orden de envío no importa, Google decide
  }

  function reset() {
    clearSelection();
    mode = 'optimizada';
    stage = 'seleccion';
    reviewData = null;
  }

  return {
    get selectedIds() { return selectedIds; },
    get selectedOrder() { return selectedOrder.slice(); },
    get manualOrder() { return manualOrder.slice(); },
    get mode() { return mode; },
    get origin() { return origin; },
    get stage() { return stage; },
    get reviewData() { return reviewData; },
    select,
    deselect,
    toggle,
    clearSelection,
    orderIndex,
    setManualOrder,
    moveManual,
    setMode,
    setOrigin,
    setStage,
    setReviewData,
    orderedIdsForMode,
    reset
  };
})();
