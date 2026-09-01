(function registerPocketiaWorkspace() {
  const KEYS = {
    savedDecks: "pocketia_saved_decks_v1",
    importedMetaDecks: "pocketia_imported_meta_decks_v1",
    trades: "pocketia_trades_v1"
  };

  function read(key, fallback) {
    try {
      const value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  async function loadCards() {
    const response = await fetch("./data/consolidated/cards-adapted.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Nao foi possivel carregar o catalogo de cartas.");
    const cards = await response.json();
    return Array.isArray(cards) ? cards : [];
  }

  function nextId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getSavedDecks() {
    const decks = read(KEYS.savedDecks, []);
    return Array.isArray(decks) ? decks : [];
  }

  function saveSavedDecks(decks) {
    write(KEYS.savedDecks, decks);
  }

  function getImportedMetaDecks() {
    const decks = read(KEYS.importedMetaDecks, []);
    return Array.isArray(decks) ? decks : [];
  }

  function saveImportedMetaDecks(decks) {
    write(KEYS.importedMetaDecks, decks);
  }

  function getTradeState() {
    const state = read(KEYS.trades, { available: [], wanted: [], combos: [] });
    return {
      available: Array.isArray(state?.available) ? state.available : [],
      wanted: Array.isArray(state?.wanted) ? state.wanted : [],
      combos: Array.isArray(state?.combos) ? state.combos : []
    };
  }

  function saveTradeState(state) {
    write(KEYS.trades, state);
  }

  window.PocketiaWorkspace = {
    nextId,
    loadCards,
    getSavedDecks,
    saveSavedDecks,
    getImportedMetaDecks,
    saveImportedMetaDecks,
    getTradeState,
    saveTradeState
  };
})();
